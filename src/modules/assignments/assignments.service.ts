import { prisma } from "@/shared/prisma/prisma.service";
import { classVisibilityWhere } from "@/modules/classes/classes.service";
import type { SessionUser } from "@/common/permissions/permissions";
import type { CreateAssignmentInput } from "@/modules/assignments/assignments.schema";
import { openAssignmentWhere } from "@/modules/publish/publish.service";

export async function createAssignment(input: CreateAssignmentInput) {
  return prisma.assignment.create({
    data: {
      classId: input.classId,
      examId: input.examId,
      openAt: input.openAt,
      dueAt: input.dueAt,
      showAnswer: input.showAnswer,
    },
  });
}

/**
 * Bài được giao kèm lớp + cấu hình online của đề. Bài gắn lớp: chỉ trả về nếu user thấy được lớp đó.
 * Bài không gắn lớp ("link chung"): ai đăng nhập cũng tìm thấy — quyền làm bài kiểm ở canTakeAssignment().
 */
export async function getVisibleAssignment(user: SessionUser, assignmentId: string) {
  return prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      deletedAt: null,
      exam: { deletedAt: null },
      OR: [{ classroom: classVisibilityWhere(user) }, { classId: null }],
    },
    include: {
      classroom: { select: { id: true, name: true, teacherId: true } },
      exam: {
        select: {
          id: true,
          title: true,
          description: true,
          durationMinutes: true,
          teacherId: true,
          priceMode: true,
          price: true,
          priceNote: true,
          onlineConfig: true,
          _count: { select: { questions: true } },
        },
      },
    },
  });
}

/** Kết quả cả lớp cho một bài — học sinh chưa làm vẫn hiện để giáo viên biết. */
export async function getAssignmentResults(assignmentId: string, classId: string) {
  const [members, submissions] = await Promise.all([
    prisma.classMember.findMany({
      where: { classId },
      orderBy: { student: { fullName: "asc" } },
      select: { student: { select: { id: true, fullName: true, email: true } } },
    }),
    prisma.submission.findMany({
      where: { assignmentId },
      orderBy: { attempt: "asc" },
      select: { id: true, studentId: true, startedAt: true, submittedAt: true, score: true, maxScore: true },
    }),
  ]);

  // Làm nhiều lượt → lấy lượt điểm cao nhất; chưa nộp lượt nào thì lấy lượt đang làm.
  const byStudent = new Map<string, (typeof submissions)[number]>();
  for (const s of submissions) {
    const cur = byStudent.get(s.studentId);
    if (!cur || bestFirst(s, cur) < 0) byStudent.set(s.studentId, s);
  }
  return members.map(({ student }) => ({ student, submission: byStudent.get(student.id) ?? null }));
}

type Scored = { submittedAt: Date | null; score: number | null };

/** So sánh 2 lượt làm: lượt đã nộp trước lượt đang làm, điểm cao trước. */
export function bestFirst(a: Scored, b: Scored): number {
  if (Boolean(a.submittedAt) !== Boolean(b.submittedAt)) return a.submittedAt ? -1 : 1;
  return (b.score ?? 0) - (a.score ?? 0);
}

/**
 * Bài được giao cho học sinh: theo lớp đang học + bài giao đích danh ("Giao theo học sinh").
 * Đề "Tất cả mọi người" không liệt kê ở đây — học sinh vào bằng link.
 * `submissions`: mọi lượt làm, lượt đã nộp điểm cao nhất đứng đầu.
 */
export async function listAssignmentsForStudent(studentId: string) {
  const rows = await prisma.assignment.findMany({
    where: {
      deletedAt: null,
      exam: { deletedAt: null },
      OR: [{ classroom: { deletedAt: null, members: { some: { studentId } } } }, openAssignmentWhere(studentId, false)],
    },
    orderBy: { dueAt: { sort: "asc", nulls: "last" } },
    include: {
      classroom: { select: { name: true } },
      exam: {
        select: {
          title: true,
          durationMinutes: true,
          onlineConfig: { select: { maxAttempts: true, mode: true, publishedAt: true } },
        },
      },
      submissions: {
        where: { studentId },
        select: { id: true, submittedAt: true, score: true, maxScore: true },
      },
    },
  });
  return rows.map((a) => ({ ...a, submissions: [...a.submissions].sort(bestFirst) }));
}
