import { prisma } from "@/shared/prisma/prisma.service";
import { getBookTree, listBooks } from "@/modules/worksheet/worksheet.service";

/** Khối / môn đang dạy đã lưu của giáo viên. */
export async function getTeachingProfile(userId: string) {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { teachingGrades: true, teachingSubjects: true },
  });
  return { grades: row?.teachingGrades ?? [], subjects: row?.teachingSubjects ?? [] };
}

export async function saveTeachingProfile(userId: string, grades: number[], subjects: string[]) {
  await prisma.user.update({
    where: { id: userId },
    data: { teachingGrades: grades, teachingSubjects: subjects },
  });
}

/** Sách trong ngân hàng chung, kèm số câu và cờ "khớp khối/môn giáo viên dạy". */
export async function listSharedBooks(profile: { grades: number[]; subjects: string[] }) {
  const books = await listBooks();
  const withCounts = await Promise.all(
    books.map(async (b) => {
      const tree = await getBookTree(b.id);
      const subject = "Toán"; // listBooks hiện chỉ lấy sách Toán
      return {
        ...b,
        subject,
        topicCount: tree.length,
        questionCount: tree.reduce((s, n) => s + n.count, 0),
        matches: profile.grades.includes(b.grade) && profile.subjects.includes(subject),
      };
    }),
  );
  return withCounts.sort((a, b) => Number(b.matches) - Number(a.matches) || a.grade - b.grade);
}
