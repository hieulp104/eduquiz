import { prisma } from "@/shared/prisma/prisma.service";
import { scopeOf, type SessionUser } from "@/common/permissions/permissions";
import type { Prisma } from "@/generated/prisma/client";
import type { QuestionLevel } from "@/generated/prisma/enums";
import type { ExamInput, ExamSettingsInput } from "@/modules/exams/exams.schema";
import { sanitizeRichText } from "@/modules/homework/homework.sanitize";

/** ALL → mọi đề · OWN → đề mình soạn. */
function examVisibilityWhere(user: SessionUser): Prisma.ExamWhereInput {
  const base: Prisma.ExamWhereInput = { deletedAt: null };
  return scopeOf(user, "exam.view") === "ALL" ? base : { ...base, teacherId: user.id };
}

/** Đề kèm đáp án đúng + nhóm câu — CHỈ dùng cho người soạn đề, không trả cho học sinh. */
export async function getExamWithAnswers(user: SessionUser, examId: string) {
  return prisma.exam.findFirst({
    where: { id: examId, ...examVisibilityWhere(user) },
    include: {
      groups: { orderBy: { order: "asc" } },
      questions: {
        orderBy: { order: "asc" },
        include: { options: { orderBy: { order: "asc" } } },
      },
      _count: { select: { assignments: { where: { deletedAt: null } } } },
    },
  });
}

export async function getExamOwner(examId: string) {
  return prisma.exam.findFirst({
    where: { id: examId, deletedAt: null },
    select: { id: true, teacherId: true, folderId: true, _count: { select: { assignments: true } } },
  });
}

/** Dữ liệu tạo đề — groups không bắt buộc (đề từ ma trận / phiếu bài tập không có nhóm). */
type Pricing = Pick<ExamInput, "priceMode" | "price" | "priceNote">;

/** purpose là mã trong EXAM_PURPOSE_GROUPS — đã kiểm ở schema, hoặc chép từ đề có sẵn. */
type Loose = { purpose?: string | null } & Partial<Pricing>;

export type ExamCreateData = Omit<ExamInput, "groups" | "purpose" | keyof Pricing> & { groups?: ExamInput["groups"] } & Loose;

type SettingsData = Omit<ExamSettingsInput, "purpose" | keyof Pricing> & Loose;

const settingsData = (input: SettingsData) => ({
  title: input.title,
  description: input.description,
  durationMinutes: input.durationMinutes,
  grade: input.grade ?? null,
  subject: input.subject || null,
  purpose: input.purpose ?? null,
  // Không gửi cấu hình giá (đề từ ma trận / ngân hàng…) thì giữ nguyên giá đang có.
  ...(input.priceMode
    ? {
        priceMode: input.priceMode,
        price: input.priceMode === "FREE" ? 0 : (input.price ?? 0),
        priceNote: input.priceMode === "FREE" ? "" : sanitizeRichText(input.priceNote ?? ""),
      }
    : {}),
});

/** Ghi nhóm + câu hỏi của đề trong transaction (đề đã có thì phải xóa câu cũ trước). */
async function writeQuestions(tx: Prisma.TransactionClient, examId: string, input: ExamCreateData) {
  const groupIds: string[] = [];
  for (const [i, g] of (input.groups ?? []).entries()) {
    const row = await tx.questionGroup.create({
      data: {
        examId,
        order: i + 1,
        content: g.content,
        fixedOrder: g.fixedOrder ?? false,
        audioFileId: g.audioFileId ?? null,
      },
      select: { id: true },
    });
    groupIds.push(row.id);
  }
  for (const [qi, q] of input.questions.entries()) {
    await tx.question.create({
      data: {
        examId,
        groupId: q.groupIndex != null ? (groupIds[q.groupIndex] ?? null) : null,
        order: qi + 1,
        content: q.content,
        points: q.points,
        level: q.level ?? null,
        fixedOptions: q.fixedOptions ?? false,
        audioFileId: q.audioFileId ?? null,
        options: {
          create: q.options.map((o, oi) => ({ order: oi + 1, content: o.content, isCorrect: o.isCorrect })),
        },
      },
    });
  }
}

export async function createExam(teacherId: string, input: ExamCreateData) {
  return prisma.$transaction(
    async (tx) => {
      const exam = await tx.exam.create({
        data: { teacherId, folderId: input.folderId ?? null, ...settingsData(input) },
        select: { id: true },
      });
      await writeQuestions(tx, exam.id, input);
      return exam;
    },
    { timeout: 30_000 },
  );
}

/** Ghi đè toàn bộ câu hỏi. Chỉ gọi khi đề CHƯA được giao (đã có bài làm thì không sửa được). */
export async function replaceExam(examId: string, input: ExamCreateData) {
  return prisma.$transaction(
    async (tx) => {
      await tx.question.deleteMany({ where: { examId } });
      await tx.questionGroup.deleteMany({ where: { examId } });
      const exam = await tx.exam.update({ where: { id: examId }, data: settingsData(input), select: { id: true } });
      await writeQuestions(tx, examId, input);
      return exam;
    },
    { timeout: 30_000 },
  );
}

/** Sửa thông tin chung (tên, khối, môn, thời gian…) — được cả khi đề đã giao vì không đụng tới câu hỏi. */
export async function updateExamSettings(examId: string, input: SettingsData) {
  return prisma.exam.update({ where: { id: examId }, data: settingsData(input), select: { id: true } });
}

export async function softDeleteExam(examId: string) {
  await prisma.exam.update({ where: { id: examId }, data: { deletedAt: new Date() } });
}

/** Đề của giáo viên để chọn khi giao bài. */
export async function listExamOptions(user: SessionUser) {
  return prisma.exam.findMany({
    where: examVisibilityWhere(user),
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true },
  });
}

/**
 * Trang chi tiết đề: thông tin, các lớp được giao và mọi bài đã nộp.
 * Chỉ trả về nếu user thấy được đề (OWN: đề mình soạn).
 */
export async function getExamOverview(user: SessionUser, examId: string) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, ...examVisibilityWhere(user) },
    include: {
      teacher: { select: { fullName: true } },
      questions: { orderBy: { order: "asc" }, select: { id: true, points: true, groupId: true } },
      onlineConfig: true,
      assignments: {
        where: { deletedAt: null },
        orderBy: { openAt: "desc" },
        select: {
          id: true,
          classId: true,
          openAt: true,
          dueAt: true,
          showAnswer: true,
          classroom: { select: { id: true, name: true, _count: { select: { members: true } } } },
        },
      },
    },
  });
  if (!exam) return null;

  const submissions = await prisma.submission.findMany({
    where: { assignment: { examId: exam.id, deletedAt: null }, submittedAt: { not: null } },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      startedAt: true,
      submittedAt: true,
      score: true,
      maxScore: true,
      attempt: true,
      leaveCount: true,
      takerClass: true,
      takerNumber: true,
      comment: true,
      studentId: true,
      student: { select: { id: true, fullName: true, email: true, phone: true, isGuest: true } },
      assignment: { select: { classroom: { select: { name: true } } } },
    },
  });
  return { exam, submissions };
}

/**
 * Gán mức độ cho các câu của đề (chỉ câu thuộc đúng đề này). Không ảnh hưởng điểm nên làm được cả khi đề đã giao.
 * Trả số câu đã đổi.
 */
export async function updateQuestionLevels(examId: string, levels: Record<string, QuestionLevel | null>) {
  const questions = await prisma.question.findMany({ where: { examId }, select: { id: true, level: true } });
  const changed = questions.filter((q) => q.id in levels && levels[q.id] !== q.level);
  await prisma.$transaction(changed.map((q) => prisma.question.update({ where: { id: q.id }, data: { level: levels[q.id] } })));
  return changed.length;
}
