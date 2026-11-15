import { randomInt } from "node:crypto";
import { prisma } from "@/shared/prisma/prisma.service";
import { scopeOf, type SessionUser } from "@/common/permissions/permissions";
import type { Prisma } from "@/generated/prisma/client";
import { sanitizeRichText } from "@/modules/homework/homework.sanitize";
import { sharedClassWhere } from "@/modules/teachers/class-sharing.service";
import type { OnlineSettingsInput } from "@/modules/publish/publish.schema";

export async function getOnlineConfig(examId: string) {
  return prisma.examOnlineConfig.findUnique({ where: { examId } });
}

/** Lớp giáo viên được giao bài, kèm học sinh — cho ô "Giao theo lớp / theo học sinh". */
export async function listClassesWithStudents(user: SessionUser) {
  return prisma.classroom.findMany({
    where: {
      deletedAt: null,
      ...(scopeOf(user, "assignment.create") === "ALL" ? {} : { OR: [{ teacherId: user.id }, sharedClassWhere(user.id)] }),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      members: {
        orderBy: { student: { fullName: "asc" } },
        select: { student: { select: { id: true, fullName: true } } },
      },
    },
  });
}

/** Mã link 6 ký tự, bỏ ký tự dễ nhầm (0/o, 1/l/i). */
function randomCode() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
}

async function newCode(tx: Prisma.TransactionClient) {
  for (let i = 0; i < 10; i++) {
    const code = randomCode();
    if (!(await tx.examOnlineConfig.findUnique({ where: { code }, select: { examId: true } }))) return code;
  }
  throw new Error("Không tạo được mã đề — thử lại.");
}

/**
 * Đồng bộ bài giao (Assignment) theo cấu hình vừa xuất bản:
 * - Giao theo lớp → mỗi lớp 1 bài giao; còn lại → 1 bài giao không gắn lớp ("link chung").
 * - Bài giao cũ không còn trong đối tượng: chưa ai làm thì gỡ; đã có bài làm thì GIỮ để không mất kết quả.
 */
async function syncAssignments(tx: Prisma.TransactionClient, examId: string, input: OnlineSettingsInput, now: Date) {
  const practice = input.mode === "PRACTICE";
  const fields = {
    dueAt: practice ? null : input.dueAt,
    showAnswer: practice || input.showAnswers !== "NEVER",
    shuffleQuestions: input.shuffle,
    shuffleOptions: input.shuffle,
    shuffleGroups: input.shuffleGroups,
  };
  const openAt = practice ? null : input.openAt;
  const targets: (string | null)[] = input.audience === "CLASSES" ? [...new Set(input.classIds)] : [null];

  const active = await tx.assignment.findMany({
    where: { examId, deletedAt: null },
    select: { id: true, classId: true, openAt: true, _count: { select: { submissions: true } } },
  });
  for (const classId of targets) {
    const existing = active.find((a) => a.classId === classId);
    if (existing) {
      // Không đặt giờ mở → giữ giờ mở cũ, nhưng không để bài đang "chưa mở".
      const keep = existing.openAt > now ? now : existing.openAt;
      await tx.assignment.update({ where: { id: existing.id }, data: { ...fields, openAt: openAt ?? keep } });
    } else {
      await tx.assignment.create({ data: { examId, classId, ...fields, openAt: openAt ?? now } });
    }
  }
  const stale = active.filter((a) => !targets.includes(a.classId) && a._count.submissions === 0).map((a) => a.id);
  if (stale.length) await tx.assignment.updateMany({ where: { id: { in: stale } }, data: { deletedAt: now } });
}

/** Lưu cấu hình (kèm thông tin chung + giá của đề). `input.publish` → đồng bộ bài giao. Trả mã link. */
export async function saveOnlineSettings(input: OnlineSettingsInput) {
  const now = new Date();
  const config = {
    mode: input.mode,
    openAt: input.openAt,
    dueAt: input.dueAt,
    audience: input.audience,
    classIds: [...new Set(input.classIds)],
    studentIds: [...new Set(input.studentIds)],
    labMode: input.labMode,
    maxAttempts: input.maxAttempts,
    password: input.password || null,
    monitorLeave: input.monitorLeave,
    shuffle: input.shuffle,
    shuffleGroups: input.shuffleGroups,
    hideGroupTitles: input.hideGroupTitles,
    showScore: input.showScore,
    showAnswers: input.showAnswers,
    minScoreForAnswers: input.showAnswers === "MIN_SCORE" ? input.minScoreForAnswers : null,
    hideWrongAnswers: input.hideWrongAnswers,
    retryWrong: input.retryWrong,
    headerNote: input.headerNote,
    preNotice: input.preNotice,
  };

  return prisma.$transaction(async (tx) => {
    await tx.exam.update({
      where: { id: input.examId },
      data: {
        title: input.title,
        grade: input.grade,
        subject: input.subject || null,
        purpose: input.purpose,
        durationMinutes: input.durationMinutes,
        priceMode: input.priceMode,
        price: input.priceMode === "FREE" ? 0 : input.price,
        priceNote: input.priceMode === "FREE" ? "" : sanitizeRichText(input.priceNote),
      },
    });
    const existing = await tx.examOnlineConfig.findUnique({
      where: { examId: input.examId },
      select: { code: true, publishedAt: true },
    });
    const publishedAt = input.publish ? (existing?.publishedAt ?? now) : (existing?.publishedAt ?? null);
    const saved = existing
      ? await tx.examOnlineConfig.update({ where: { examId: input.examId }, data: { ...config, publishedAt } })
      : await tx.examOnlineConfig.create({ data: { examId: input.examId, code: await newCode(tx), ...config, publishedAt } });
    if (input.publish) await syncAssignments(tx, input.examId, input, now);
    return { code: saved.code, published: Boolean(saved.publishedAt) };
  });
}

/** Đề đã xuất bản theo mã link — cho trang /thi/<code>. */
export async function findPublishedByCode(code: string) {
  return prisma.examOnlineConfig.findFirst({
    where: { code: code.toLowerCase(), publishedAt: { not: null }, exam: { deletedAt: null } },
    select: {
      examId: true,
      audience: true,
      studentIds: true,
      exam: { select: { teacherId: true } },
    },
  });
}

/**
 * Bài giao mà học sinh này làm được qua link chung của đề:
 * ưu tiên lớp học sinh đang học; không có thì bài giao "link chung" nếu học sinh thuộc đối tượng.
 */
export async function resolveAssignmentForStudent(
  config: { examId: string; audience: string; studentIds: string[] },
  studentId: string,
): Promise<string | null> {
  const viaClass = await prisma.assignment.findFirst({
    where: {
      examId: config.examId,
      deletedAt: null,
      classroom: { deletedAt: null, members: { some: { studentId } } },
    },
    orderBy: { openAt: "desc" },
    select: { id: true },
  });
  if (viaClass) return viaClass.id;
  const allowed = config.audience === "ALL" || (config.audience === "STUDENTS" && config.studentIds.includes(studentId));
  if (!allowed) return null;
  const open = await prisma.assignment.findFirst({
    where: { examId: config.examId, deletedAt: null, classId: null },
    select: { id: true },
  });
  return open?.id ?? null;
}

/** Điều kiện Prisma: bài giao không gắn lớp mà học sinh này thuộc đối tượng. */
export function openAssignmentWhere(studentId: string, includeAll: boolean): Prisma.AssignmentWhereInput {
  const audiences: Prisma.ExamOnlineConfigWhereInput[] = [{ audience: "STUDENTS", studentIds: { has: studentId } }];
  if (includeAll) audiences.push({ audience: "ALL" });
  return { classId: null, exam: { deletedAt: null, onlineConfig: { publishedAt: { not: null }, OR: audiences } } };
}
