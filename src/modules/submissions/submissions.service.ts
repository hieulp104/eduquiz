import { prisma } from "@/shared/prisma/prisma.service";

/** Cho phép nộp trễ vài giây do mạng chậm / đồng hồ máy học sinh lệch. */
const SUBMIT_GRACE_MS = 30 * 1000;

/** Hạn làm bài thực tế = sớm hơn giữa (giờ bắt đầu + thời gian làm) và hạn nộp (null = không giới hạn). */
export function submissionDeadline(startedAt: Date, durationMinutes: number, dueAt: Date | null): Date {
  const byDuration = startedAt.getTime() + durationMinutes * 60 * 1000;
  return new Date(dueAt ? Math.min(byDuration, dueAt.getTime()) : byDuration);
}

export async function isClassMember(classId: string, studentId: string) {
  const row = await prisma.classMember.findUnique({
    where: { classId_studentId: { classId, studentId } },
    select: { classId: true },
  });
  return Boolean(row);
}

type AudienceConfig = { publishedAt: Date | null; audience: string; studentIds: string[] } | null;

/**
 * Học sinh có được làm bài giao này không:
 * bài gắn lớp → phải là học sinh của lớp; bài "link chung" → theo đối tượng của đề đã xuất bản.
 */
export async function canTakeAssignment(
  studentId: string,
  assignment: { classId: string | null; exam: { onlineConfig: AudienceConfig } },
): Promise<boolean> {
  if (assignment.classId) return isClassMember(assignment.classId, studentId);
  const config = assignment.exam.onlineConfig;
  if (!config?.publishedAt) return false;
  return config.audience === "ALL" || (config.audience === "STUDENTS" && config.studentIds.includes(studentId));
}

/** Lượt làm gần nhất của học sinh (đang làm dở hoặc đã nộp). */
export async function findLatestSubmission(assignmentId: string, studentId: string) {
  return prisma.submission.findFirst({
    where: { assignmentId, studentId },
    orderBy: { attempt: "desc" },
  });
}

/** Các lượt ĐÃ NỘP của học sinh, lượt mới trước. */
export async function listSubmittedAttempts(assignmentId: string, studentId: string) {
  return prisma.submission.findMany({
    where: { assignmentId, studentId, submittedAt: { not: null } },
    orderBy: { attempt: "desc" },
    select: { id: true, attempt: true, score: true, maxScore: true, submittedAt: true },
  });
}

/**
 * Tạo lượt làm bài. Đang có lượt làm dở thì trả lượt đó.
 * Hết lượt (`maxAttempts`, 0 = không giới hạn) → trả null.
 */
export async function startSubmission(assignmentId: string, examId: string, studentId: string, maxAttempts = 1) {
  const latest = await findLatestSubmission(assignmentId, studentId);
  if (latest && !latest.submittedAt) return latest;
  const attempt = (latest?.attempt ?? 0) + 1;
  if (maxAttempts > 0 && attempt > maxAttempts) return null;

  const agg = await prisma.question.aggregate({ where: { examId }, _sum: { points: true } });
  try {
    return await prisma.submission.create({
      data: { assignmentId, studentId, attempt, maxScore: agg._sum.points ?? 0 },
    });
  } catch {
    // Bấm 2 lần cùng lúc → khóa unique (assignment, student, attempt) chặn lượt trùng; dùng lượt vừa tạo.
    return findLatestSubmission(assignmentId, studentId);
  }
}

/** Câu hỏi để làm bài — KHÔNG kèm isCorrect, tránh lộ đáp án ra client. */
export async function getQuestionsForTaking(examId: string) {
  return prisma.question.findMany({
    where: { examId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      content: true,
      points: true,
      fixedOptions: true,
      audioFileId: true,
      group: { select: { id: true, content: true, fixedOrder: true, audioFileId: true } },
      options: { orderBy: { order: "asc" }, select: { id: true, content: true } },
    },
  });
}

export async function getSubmissionContext(submissionId: string) {
  return prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: {
        select: {
          dueAt: true,
          showAnswer: true,
          exam: { select: { id: true, durationMinutes: true, onlineConfig: true } },
        },
      },
    },
  });
}

/**
 * Chấm và chốt bài. Trả false nếu bài đã nộp trước đó (chống bấm nộp 2 lần).
 * Nộp sau hạn (quá thời gian ân hạn) thì bỏ qua đáp án — tính như nộp giấy trắng.
 * Câu đã trả lời trước đó (chế độ Luyện tập ghi từng câu) được giữ nguyên, không ghi đè.
 */
export async function gradeAndSubmit(
  submissionId: string,
  answers: Record<string, string>,
): Promise<boolean> {
  const ctx = await getSubmissionContext(submissionId);
  if (!ctx || ctx.submittedAt) return false;

  const deadline = submissionDeadline(
    ctx.startedAt,
    ctx.assignment.exam.durationMinutes,
    ctx.assignment.dueAt,
  );
  const now = new Date();
  const accepted = now.getTime() <= deadline.getTime() + SUBMIT_GRACE_MS ? answers : {};

  const [questions, recorded] = await Promise.all([
    prisma.question.findMany({
      where: { examId: ctx.assignment.exam.id },
      select: { id: true, points: true, options: { select: { id: true, isCorrect: true } } },
    }),
    prisma.answer.findMany({ where: { submissionId }, select: { questionId: true, isCorrect: true } }),
  ]);
  const done = new Map(recorded.map((a) => [a.questionId, a.isCorrect]));

  let score = 0;
  const rows: { submissionId: string; questionId: string; optionId: string | null; isCorrect: boolean }[] = [];
  for (const q of questions) {
    if (done.has(q.id)) {
      if (done.get(q.id)) score += q.points;
      continue;
    }
    const chosen = q.options.find((o) => o.id === accepted[q.id]);
    const isCorrect = Boolean(chosen?.isCorrect);
    if (isCorrect) score += q.points;
    rows.push({ submissionId, questionId: q.id, optionId: chosen?.id ?? null, isCorrect });
  }

  return prisma.$transaction(async (tx) => {
    // Chốt có điều kiện submittedAt = null → 2 request nộp cùng lúc chỉ 1 cái thắng.
    const locked = await tx.submission.updateMany({
      where: { id: submissionId, submittedAt: null },
      data: { submittedAt: now, score },
    });
    if (locked.count === 0) return false;
    await tx.answer.createMany({ data: rows, skipDuplicates: true });
    return true;
  });
}

/**
 * Luyện tập: ghi 1 câu trả lời và báo đúng/sai ngay. Mỗi câu chỉ trả lời 1 lần (unique submission + question).
 * Trả null nếu câu / phương án không thuộc đề hoặc câu đã trả lời rồi.
 */
export async function answerPracticeQuestion(submissionId: string, examId: string, questionId: string, optionId: string) {
  const question = await prisma.question.findFirst({
    where: { id: questionId, examId },
    select: { options: { select: { id: true, isCorrect: true } } },
  });
  const chosen = question?.options.find((o) => o.id === optionId);
  const correct = question?.options.find((o) => o.isCorrect);
  if (!chosen || !correct) return null;
  const answered = await prisma.answer.findUnique({
    where: { submissionId_questionId: { submissionId, questionId } },
    select: { id: true },
  });
  if (answered) return null;
  try {
    // Bấm 2 lần cùng lúc → khóa unique chặn bản ghi thứ hai.
    await prisma.answer.create({ data: { submissionId, questionId, optionId, isCorrect: chosen.isCorrect } });
  } catch {
    return null;
  }
  return { isCorrect: chosen.isCorrect, correctOptionId: correct.id };
}

/** Luyện tập đang làm dở: các câu đã trả lời kèm đáp án đúng (đã lộ cho học sinh lúc trả lời). */
export async function getPracticeProgress(submissionId: string) {
  const rows = await prisma.answer.findMany({
    where: { submissionId },
    select: {
      questionId: true,
      optionId: true,
      isCorrect: true,
      question: { select: { options: { where: { isCorrect: true }, select: { id: true } } } },
    },
  });
  return Object.fromEntries(
    rows.map((r) => [
      r.questionId,
      { optionId: r.optionId, isCorrect: r.isCorrect, correctOptionId: r.question.options[0]?.id ?? null },
    ]),
  );
}

/** Giám sát: ghi thêm 1 lần rời trang cho lượt đang làm. */
export async function addLeave(submissionId: string) {
  await prisma.submission.updateMany({
    where: { id: submissionId, submittedAt: null },
    data: { leaveCount: { increment: 1 } },
  });
}

/**
 * Hết giờ mà chưa nộp (đóng tab giữa chừng) → chốt bài, các câu chưa trả lời tính bỏ trống.
 * Trả true nếu bài đã được chốt.
 */
export async function finalizeIfExpired(submissionId: string, deadline: Date): Promise<boolean> {
  if (deadline.getTime() > Date.now()) return false;
  await gradeAndSubmit(submissionId, {});
  return true;
}

/** Kết quả chi tiết một bài làm, kèm đáp án đúng. Page tự quyết định có hiện đáp án hay không. */
export async function getSubmissionResult(submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      student: { select: { id: true, fullName: true } },
      answers: { select: { questionId: true, optionId: true, isCorrect: true } },
      assignment: {
        select: {
          id: true,
          showAnswer: true,
          dueAt: true,
          classroom: { select: { id: true, name: true, teacherId: true } },
          exam: {
            select: {
              id: true,
              title: true,
              teacherId: true,
              priceMode: true,
              price: true,
              priceNote: true,
              onlineConfig: true,
            },
          },
        },
      },
    },
  });
  if (!submission) return null;

  const questions = await prisma.question.findMany({
    where: { examId: submission.assignment.exam.id },
    orderBy: { order: "asc" },
    include: { options: { orderBy: { order: "asc" } }, group: { select: { id: true, content: true, audioFileId: true } } },
  });

  return { submission, questions };
}
