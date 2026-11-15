import type { PrismaClient } from "../../src/generated/prisma/client";
import { generateQuestions, TOAN1_KNTT } from "./toan1-kntt";

/** Số câu tối đa mỗi dạng (bộ sinh có ít biến thể thì ra ít hơn). */
const PER_LEAF = 40;

/**
 * Nạp cây kiến thức + câu hỏi. Idempotent: nút upsert theo `key`, câu hỏi xóa và sinh lại
 * (RNG có seed cố định nên ra đúng bộ cũ). Đề đã tạo từ phiếu không bị ảnh hưởng vì đề
 * chép nội dung câu hỏi sang bảng questions riêng.
 */
export async function seedQuestionBank(prisma: PrismaClient) {
  const book = TOAN1_KNTT;
  const root = await prisma.questionBankNode.upsert({
    where: { key: book.key },
    create: { key: book.key, grade: book.grade, subject: book.subject, title: book.title, order: 1 },
    update: { grade: book.grade, subject: book.subject, title: book.title },
  });

  const upsertNode = (key: string, parentId: string, title: string, order: number) =>
    prisma.questionBankNode.upsert({
      where: { key },
      create: { key, parentId, title, order },
      update: { parentId, title, order },
    });

  let seed = 1;
  let total = 0;
  for (const [ti, topic] of book.topics.entries()) {
    const topicNode = await upsertNode(`${book.key}/cd${ti + 1}`, root.id, `Chủ đề ${ti + 1}: ${topic.title}`, ti + 1);

    for (const [li, lesson] of topic.lessons.entries()) {
      const lessonKey = `${book.key}/cd${ti + 1}/b${li + 1}`;
      const lessonNode = await upsertNode(lessonKey, topicNode.id, lesson.title, li + 1);

      const leaves = [
        { key: "tn", title: "Trắc nghiệm", gens: lesson.mcq },
        { key: "dien", title: "Điền vào chỗ trống", gens: lesson.fill },
      ];
      for (const [fi, leaf] of leaves.entries()) {
        seed++;
        if (!leaf.gens?.length) continue;
        const leafNode = await upsertNode(`${lessonKey}/${leaf.key}`, lessonNode.id, leaf.title, fi + 1);
        const questions = generateQuestions(leaf.gens, PER_LEAF, seed * 7919);
        await prisma.bankQuestion.deleteMany({ where: { nodeId: leafNode.id } });
        await prisma.bankQuestion.createMany({
          data: questions.map((q) => ({ nodeId: leafNode.id, ...q })),
        });
        total += questions.length;
      }
    }
  }
  return { book: book.title, total };
}
