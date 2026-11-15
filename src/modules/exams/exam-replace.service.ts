import { prisma } from "@/shared/prisma/prisma.service";
import { scopeOf, type SessionUser } from "@/common/permissions/permissions";
import { stripTags } from "@/lib/inline-format";
import type { Prisma } from "@/generated/prisma/client";
import type { ReplaceCandidate } from "@/modules/exams/exam-replace.types";

/**
 * "Đổi câu khác": tìm câu trắc nghiệm tương tự để thay cho một câu trong đề đang soạn.
 * Nguồn: câu trong các đề của chính giáo viên (OWN) + ngân hàng câu hỏi chung.
 * Tương tự = trùng từ khóa (lấy từ nội dung câu / đáp án hoặc ô tìm kiếm), ưu tiên cùng môn / khối.
 */

const STOP = new Set(["the", "and", "for", "with", "that", "this", "from", "which", "what", "của", "các", "những", "được", "trong", "là"]);

/** Tối đa 5 từ khóa dài nhất (≥ 3 ký tự, bỏ từ quá phổ biến). */
export function keywords(text: string): string[] {
  const words = stripTags(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
  return [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, 5);
}

const score = (text: string, words: string[]) => {
  const t = stripTags(text).toLowerCase();
  return words.filter((w) => t.includes(w)).length;
};

type Input = { text: string; grade: number | null; subject: string | null; excludeExamId: string | null; exclude: string };

export async function findReplacementQuestions(user: SessionUser, input: Input): Promise<ReplaceCandidate[]> {
  const words = keywords(input.text);
  const contains = (w: string) => ({ contains: w, mode: "insensitive" as const });

  const ownExam: Prisma.ExamWhereInput = {
    deletedAt: null,
    ...(scopeOf(user, "exam.view") === "ALL" ? {} : { teacherId: user.id }),
    ...(input.excludeExamId ? { id: { not: input.excludeExamId } } : {}),
  };
  const [own, bank] = await Promise.all([
    prisma.question.findMany({
      where: {
        exam: ownExam,
        ...(words.length
          ? { OR: words.flatMap((w) => [{ content: contains(w) }, { options: { some: { content: contains(w) } } }]) }
          : input.subject
            ? { exam: { ...ownExam, subject: input.subject } }
            : {}),
      },
      take: 40,
      orderBy: { exam: { createdAt: "desc" } },
      select: {
        id: true,
        content: true,
        options: { orderBy: { order: "asc" }, select: { content: true, isCorrect: true } },
        exam: { select: { title: true, grade: true, subject: true } },
      },
    }),
    prisma.bankQuestion.findMany({
      where: words.length
        ? { OR: words.map((w) => ({ content: contains(w) })) }
        : input.subject
          ? { node: { parent: { parent: { parent: { subject: input.subject } } } } }
          : {},
      take: 40,
      select: {
        id: true,
        content: true,
        options: true,
        correctIndex: true,
        node: { select: { parent: { select: { parent: { select: { parent: { select: { title: true, grade: true, subject: true } } } } } } } },
      },
    }),
  ]);

  const exclude = stripTags(input.exclude).trim().toLowerCase();
  const list: (ReplaceCandidate & { rank: number })[] = [
    ...own.map((q) => ({
      id: `q:${q.id}`,
      source: q.exam.title,
      content: q.content,
      options: q.options.map((o) => o.content),
      correctIndex: Math.max(0, q.options.findIndex((o) => o.isCorrect)),
      grade: q.exam.grade,
      subject: q.exam.subject,
      rank: 0,
    })),
    ...bank.map((q) => {
      const book = q.node.parent?.parent?.parent;
      return {
        id: `b:${q.id}`,
        source: book ? `Ngân hàng: ${book.title}` : "Ngân hàng chung",
        content: q.content.replace(/\.{6}/g, "____"),
        options: q.options,
        correctIndex: q.correctIndex,
        grade: book?.grade ?? null,
        subject: book?.subject ?? null,
        rank: 0,
      };
    }),
  ];

  // Không câu nào trùng từ khóa → gợi ý câu cùng môn.
  if (list.length === 0 && words.length) return findReplacementQuestions(user, { ...input, text: "" });

  const seen = new Set<string>();
  return list
    .filter((c) => {
      const key = stripTags(c.content).trim().toLowerCase() + "|" + c.options.join("|");
      if (seen.has(key) || (exclude && stripTags(c.content).trim().toLowerCase() === exclude)) return false;
      seen.add(key);
      return c.options.length >= 2;
    })
    .map((c) => ({
      ...c,
      rank:
        score(`${c.content} ${c.options.join(" ")}`, words) * 10 +
        (input.subject && c.subject === input.subject ? 5 : 0) +
        (input.grade !== null && c.grade === input.grade ? 2 : 0),
    }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 12)
    .map((c) => ({
      id: c.id,
      source: c.source,
      content: c.content,
      options: c.options,
      correctIndex: c.correctIndex,
      grade: c.grade,
      subject: c.subject,
    }));
}
