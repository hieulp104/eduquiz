/**
 * Kiểm thử Ngân hàng câu hỏi riêng trên DB dev (cần đã chạy db:seed).
 * Chạy: npm run verify
 *
 * - Tạo cấu trúc theo sách (chủ đề → bài), thêm / đổi chỗ / xóa mục (câu về "Chưa xếp bài")
 * - Nhập câu từ văn bản đề (bộ đọc đề) giữ mức độ + đáp án; nhóm câu ghép lời dẫn
 * - Ma trận: bốc đúng số câu theo (bài, mức độ), thiếu câu thì báo lỗi
 * - Tạo đề từ câu chọn: giữ thứ tự, đáp án, tổng 10 điểm
 * - Copy ngân hàng: đủ cấu trúc + câu, câu vẫn đúng bài
 * Dữ liệu thử bị xóa sau khi chạy.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "@/shared/prisma/prisma.service";
import { parseExamText } from "@/modules/exams/exam-text";
import { importItemsSchema } from "@/modules/banks/banks.schema";
import {
  addItems,
  addSections,
  buildSectionsFromBook,
  copyBank,
  createBank,
  createExamFromItems,
  deleteSection,
  listItems,
  listSections,
  matrixAvailability,
  moveSection,
  pickMatrixItems,
} from "@/modules/banks/banks.service";
import { buildSectionTree } from "@/modules/banks/banks.types";

const TEXT = `Read and choose.
Câu 1. [NB] I ___ a student.
A. am
B. is
C. are
D. be
Đáp án: A
Câu 2. [TH] 5 + 3 = ?
A. 7\tB. 8\tC. 9\tD. 10
Câu 3. Câu chưa có đáp án
A. x
B. y
ĐÁP ÁN
2.B`;

async function main() {
  const teacher = await prisma.user.findUniqueOrThrow({ where: { username: "gv.lan" } });
  const book = await prisma.questionBankNode.findFirstOrThrow({ where: { parentId: null }, select: { id: true } });
  const banks: string[] = [];
  const exams: string[] = [];

  try {
    const bank = await createBank(teacher.id, { name: "NH verify", grade: 1, subject: "Toán", bookId: book.id });
    banks.push(bank.id);

    // 1. Cấu trúc theo sách
    const made = await buildSectionsFromBook(bank.id, book.id);
    const topics = await prisma.questionBankNode.count({ where: { parentId: book.id } });
    let sections = await listSections(bank.id);
    assert.equal(sections.length, made);
    assert.equal(buildSectionTree(sections).length, topics, "Chương = chủ đề của sách");
    const chapter = buildSectionTree(sections)[0];
    const lesson = chapter.children[0];
    assert.ok(lesson, "Chương có bài con");

    await addSections(bank.id, chapter.id, ["Bài thêm A", "Bài thêm B"]);
    sections = await listSections(bank.id);
    const a = sections.find((s) => s.title === "Bài thêm A")!;
    const b = sections.find((s) => s.title === "Bài thêm B")!;
    assert.ok(b.order === a.order + 1);
    await moveSection({ ...b, bankId: bank.id }, "up");
    sections = await listSections(bank.id);
    assert.ok(sections.find((s) => s.id === b.id)!.order < sections.find((s) => s.id === a.id)!.order, "Đổi chỗ lên trên");

    // 2. Nhập câu từ văn bản
    const parsed = parseExamText(TEXT);
    const drafts = parsed.questions.map((q) => ({
      content: [q.groupIndex != null ? parsed.groups[q.groupIndex].content : "", q.content].filter(Boolean).join("\n"),
      options: q.options.map((o) => o.content),
      correctIndex: q.options.findIndex((o) => o.isCorrect),
      level: q.level,
    }));
    assert.equal(drafts[2].correctIndex, -1, "Câu 3 chưa có đáp án");
    assert.equal(importItemsSchema.safeParse({ bankId: bank.id, sectionId: null, items: drafts }).success, false, "Câu thiếu đáp án bị chặn");
    const good = drafts.slice(0, 2);
    assert.deepEqual(good.map((d) => [d.correctIndex, d.level]), [[0, "NB"], [1, "TH"]]);
    await addItems(bank.id, lesson.id, good);
    await addItems(bank.id, a.id, [{ content: "Câu ở bài A", options: ["1", "2"], correctIndex: 1, level: "NB" }]);
    let items = await listItems(bank.id);
    assert.equal(items.length, 3);

    // 3. Ma trận
    const avail = await matrixAvailability(bank.id);
    assert.equal(avail[`${lesson.id}:NB`], 1);
    assert.equal(avail[`${lesson.id}:TH`], 1);
    const tooMany = await pickMatrixItems(bank.id, [{ sectionId: lesson.id, level: "NB", count: 2 }]);
    assert.ok(tooMany.error, "Thiếu câu phải báo lỗi");
    const pick = await pickMatrixItems(bank.id, [
      { sectionId: lesson.id, level: "TH", count: 1 },
      { sectionId: a.id, level: "NB", count: 1 },
    ]);
    assert.equal(pick.error, null);
    assert.equal(pick.ids.length, 2);

    // 4. Tạo đề
    const order = [items[2].id, items[0].id];
    const exam = await createExamFromItems({ id: bank.id, grade: 1, subject: "Toán" }, teacher.id, order, { title: "Đề verify NH", durationMinutes: 15 });
    assert.ok(exam);
    exams.push(exam.id);
    const qs = await prisma.question.findMany({ where: { examId: exam.id }, orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } });
    assert.deepEqual(qs.map((q) => q.content), ["Câu ở bài A", items[0].content], "Giữ thứ tự chọn");
    assert.equal(qs[0].options.find((o) => o.isCorrect)?.content, "2");
    assert.equal(Math.round(qs.reduce((s, q) => s + q.points, 0) * 100) / 100, 10, "Tổng 10 điểm");
    assert.equal(qs[1].level, "RECOGNITION");
    const foreign = await createExamFromItems({ id: bank.id, grade: 1, subject: "Toán" }, teacher.id, ["khong-ton-tai"], { title: "x", durationMinutes: 5 });
    assert.equal(foreign, null, "Câu không thuộc ngân hàng bị từ chối");

    // 5. Copy
    const copy = await copyBank(bank.id, teacher.id);
    banks.push(copy.id);
    const [cs, ci] = await Promise.all([listSections(copy.id), listItems(copy.id)]);
    assert.equal(cs.length, sections.length);
    assert.equal(ci.length, 3);
    const copiedLesson = cs.find((s) => s.title === lesson.title && s.parentId === cs.find((x) => x.title === chapter.title && !x.parentId)?.id);
    assert.equal(ci.filter((i) => i.sectionId === copiedLesson?.id).length, 2, "Câu vẫn nằm đúng bài");

    // 6. Xóa chương → câu về "Chưa xếp bài"
    await deleteSection(bank.id, chapter.id);
    items = await listItems(bank.id);
    assert.equal(items.filter((i) => !i.sectionId).length, 3, "Không mất câu khi xóa chương");
    assert.ok(!(await listSections(bank.id)).some((s) => s.id === lesson.id), "Xóa cả bài con");
  } finally {
    await prisma.exam.deleteMany({ where: { id: { in: exams } } });
    await prisma.questionBank.deleteMany({ where: { id: { in: banks } } });
  }
  console.log("✔ verify-banks: cấu trúc theo sách, nhập câu từ văn bản, ma trận, tạo đề, copy ngân hàng, xóa mục giữ câu");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
