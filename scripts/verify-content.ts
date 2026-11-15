/**
 * Kiểm thử Kho nội dung trên DB dev (cần đã chạy db:seed).
 * Chạy: npm run verify
 *
 * - Link video: chỉ nhận http(s), lưu link (không file)
 * - Đóng góp đề / file / video → hiện trong kho; giáo viên khác đọc được file; học sinh thì không
 * - "Lưu về thư viện": chép đủ nhóm + câu + đáp án thành đề mới của người lưu
 * - Xuất đề ra .docx, nhập lại được bằng bộ đọc đề
 * - Gỡ khỏi kho → ẩn, file lại riêng tư
 * Dữ liệu thử bị xóa sau khi chạy.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "@/shared/prisma/prisma.service";
import type { SessionUser } from "@/common/permissions/permissions";
import { createContentSchema } from "@/modules/content/content.schema";
import {
  copyContentExam,
  createContentItem,
  getContentDetail,
  listContent,
  removeContentItem,
} from "@/modules/content/content.service";
import { buildExamDocx } from "@/modules/content/exam-docx";
import { docxToMarkup } from "@/modules/exams/exam-import";
import { parseExamText } from "@/modules/exams/exam-text";
import { createExam } from "@/modules/exams/exams.service";
import { canReadFile, findFile, saveUploadedFile } from "@/modules/files/files.service";
import { deleteObject } from "@/shared/storage/storage.service";

const asUser = (u: { id: string; email: string; fullName: string; role: SessionUser["role"] }): SessionUser => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName,
  role: u.role,
});

async function main() {
  // 1. Link video
  const base = { title: "x", description: "", grade: 10, subject: "Toán" };
  assert.equal(createContentSchema.safeParse({ kind: "VIDEO", url: "javascript:alert(1)", ...base }).success, false);
  assert.equal(createContentSchema.safeParse({ kind: "VIDEO", url: "youtube.com/abc", ...base }).success, false);
  assert.equal(createContentSchema.safeParse({ kind: "VIDEO", url: "https://www.youtube.com/watch?v=abc", ...base }).success, true);

  const teacher = await prisma.user.findUniqueOrThrow({ where: { username: "gv.lan" } });
  const student = await prisma.user.findUniqueOrThrow({ where: { username: "hs.an" } });
  const other = await prisma.user.create({
    data: { email: `verify-content-${Date.now()}@eduquiz.local`, fullName: "GV khác (verify)", passwordHash: "x", role: "TEACHER" },
  });
  const created: { exams: string[]; files: string[]; items: string[] } = { exams: [], files: [], items: [] };

  try {
    // 2. Đề có nhóm + định dạng
    const exam = await createExam(teacher.id, {
      title: "Đề verify kho",
      description: "",
      durationMinutes: 15,
      grade: 10,
      subject: "Tiếng Anh",
      purpose: null,
      folderId: null,
      groups: [{ content: "Choose the word whose <u>underlined</u> part is pronounced differently.", fixedOrder: true }],
      questions: [
        { content: "", points: 5, groupIndex: 0, options: [{ content: "h<u>a</u>t", isCorrect: false }, { content: "c<u>a</u>ke", isCorrect: true }, { content: "m<u>a</u>p", isCorrect: false }, { content: "b<u>a</u>g", isCorrect: false }] },
        { content: "2 + <b>3</b> = ?", points: 5, options: [{ content: "4", isCorrect: false }, { content: "5", isCorrect: true }, { content: "6", isCorrect: false }, { content: "7", isCorrect: false }] },
      ],
    });
    created.exams.push(exam.id);
    const examItem = await createContentItem(teacher.id, { kind: "EXAM", examId: exam.id, ...base, title: "Đề verify kho" });
    created.items.push(examItem.id);

    // 3. File + video
    const up = await saveUploadedFile(teacher.id, new File(["%PDF-1.4 verify"], "tai-lieu.pdf", { type: "application/pdf" }));
    assert.ok(up.ok);
    created.files.push(up.file.id);
    const fileId = up.file.id;
    const fileOf = async () => (await findFile(fileId))!;
    assert.equal(await canReadFile(asUser(other), await fileOf()), false, "Chưa chia sẻ thì người khác không đọc được file");
    const fileItem = await createContentItem(teacher.id, { kind: "REFERENCE", fileId, ...base });
    const videoItem = await createContentItem(teacher.id, { kind: "VIDEO", url: "https://www.youtube.com/watch?v=abc", ...base });
    created.items.push(fileItem.id, videoItem.id);

    assert.equal(await canReadFile(asUser(other), await fileOf()), true, "Đã lên kho thì giáo viên khác đọc được");
    assert.equal(await canReadFile(asUser(student), await fileOf()), false, "Học sinh không xem kho");
    const mine = await listContent({ ownerId: teacher.id, q: "verify" });
    assert.ok(mine.items.some((i) => i.id === examItem.id && i.extra === "2 câu"));
    const videos = await listContent({ kind: "VIDEO", grade: 10 });
    assert.ok(videos.items.some((i) => i.id === videoItem.id && i.extra === "youtube.com"));
    assert.ok((await getContentDetail(videoItem.id))?.url?.startsWith("https://"));

    // 4. Lưu về thư viện
    const detail = (await getContentDetail(examItem.id))!;
    const copy = await copyContentExam(detail, other.id);
    created.exams.push(copy.id);
    const copied = await prisma.exam.findUniqueOrThrow({
      where: { id: copy.id },
      include: { groups: true, questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } } },
    });
    assert.equal(copied.teacherId, other.id);
    assert.equal(copied.groups.length, 1);
    assert.equal(copied.questions[0].groupId, copied.groups[0].id, "Câu 1 vẫn thuộc nhóm");
    assert.equal(copied.questions[1].options.find((o) => o.isCorrect)?.content, "5");
    assert.equal((await prisma.contentItem.findUniqueOrThrow({ where: { id: examItem.id } })).downloadCount, 1);

    // 5. docx → đọc lại
    const docx = await buildExamDocx(detail.exam!, detail.title);
    const { text } = await docxToMarkup(Buffer.from(docx));
    const parsed = parseExamText(text);
    assert.equal(parsed.questions.length, 2, `Đọc lại docx phải ra 2 câu:\n${text}`);
    assert.deepEqual(
      parsed.questions.map((q) => q.options.findIndex((o) => o.isCorrect)),
      [1, 1],
      "Đáp án đúng giữ nguyên",
    );
    assert.ok(text.includes("<u>a</u>"), "Giữ gạch chân");

    // 6. Gỡ khỏi kho
    await removeContentItem(fileItem.id);
    assert.equal(await canReadFile(asUser(other), await fileOf()), false, "Gỡ rồi thì file lại riêng tư");
    assert.equal(await getContentDetail(fileItem.id), null);
  } finally {
    await prisma.contentItem.deleteMany({ where: { id: { in: created.items } } });
    await prisma.exam.deleteMany({ where: { id: { in: created.exams } } });
    for (const id of created.files) {
      const f = await prisma.storedFile.findUnique({ where: { id } });
      if (f) {
        await prisma.storedFile.delete({ where: { id } });
        await deleteObject(f.objectKey);
      }
    }
    await prisma.user.delete({ where: { id: other.id } });
  }
  console.log("✔ verify-content: link video, đóng góp đề/file/video, quyền đọc file, lưu về thư viện, xuất docx đọc lại được, gỡ khỏi kho");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
