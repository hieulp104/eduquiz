/**
 * Kiểm thử module Bài tập trên DB dev (cần đã chạy db:seed).
 * Chạy: npm run verify
 *
 * - HTML độc (script, onerror, javascript:) bị lọc khi lưu; định dạng hợp lệ được giữ
 * - Chỉ gắn được file do chính giáo viên tải lên và chưa thuộc bài nào
 * - Quyền xem file: giáo viên + học sinh trong lớp được giao; người ngoài lớp thì không
 * Dữ liệu thử bị xóa sau khi chạy.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "@/shared/prisma/prisma.service";
import { createHomework } from "@/modules/homework/homework.service";
import { canReadFile, findFile, saveUploadedFile } from "@/modules/files/files.service";
import { deleteObject } from "@/shared/storage/storage.service";
import { sanitizeRichText } from "@/modules/homework/homework.sanitize";
import { loadSessionUser } from "@/modules/auth/auth.service";

async function main() {
  // 1. Lọc HTML
  const dirty =
    '<p style="text-align: center">Đề <strong>bài</strong> <mark data-color="#fef08a" style="background-color: #fef08a">quan trọng</mark></p>' +
    '<script>alert(1)</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">x</a><p style="position:fixed">y</p>';
  const clean = sanitizeRichText(dirty);
  assert.ok(!/script|onerror|javascript:|<img|<a |position/i.test(clean), `Còn mã độc: ${clean}`);
  assert.ok(clean.includes('style="text-align:center"'), `Mất căn lề: ${clean}`);
  assert.ok(clean.includes("<strong>bài</strong>") && clean.includes("<mark"), `Mất định dạng: ${clean}`);

  // 2–3. Gắn file + quyền xem
  const teacher = await prisma.user.findUniqueOrThrow({ where: { username: "gv.lan" } });
  const student = await prisma.user.findUniqueOrThrow({ where: { username: "hs.an" } });
  const outsider = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
  const classroom = await prisma.classroom.findUniqueOrThrow({ where: { joinCode: "TOAN10" } });

  const own = await saveUploadedFile(teacher.id, new File(["noi dung"], "de-bai.pdf", { type: "application/pdf" }));
  const foreign = await saveUploadedFile(student.id, new File(["cua hs"], "hs.pdf", { type: "application/pdf" }));
  const bad = await saveUploadedFile(teacher.id, new File(["<svg/>"], "x.html", { type: "text/html" }));
  assert.ok(own.ok && foreign.ok, "Tải file hợp lệ phải thành công");
  assert.equal(bad.ok, false, "File HTML phải bị từ chối");

  // Lớp không có học sinh nào ngoài lớp mẫu → tạo lớp trống để thử "học sinh ngoài lớp".
  const emptyClass = await prisma.classroom.create({
    data: { name: "Lớp thử verify", joinCode: `V${Date.now().toString(36).slice(-5).toUpperCase()}`, teacherId: teacher.id },
  });

  let homeworkId = "";
  try {
    const hw = await createHomework(teacher.id, {
      title: "Bài tập verify",
      grade: 10,
      subject: "Toán",
      purpose: "HOMEWORK",
      startAt: null,
      dueAt: null,
      contentHtml: dirty,
      showResult: true,
      requireLogin: false,
      classIds: [classroom.id],
      fileIds: [own.ok ? own.file.id : "", foreign.ok ? foreign.file.id : ""],
    });
    homeworkId = hw.id;

    const saved = await prisma.homework.findUniqueOrThrow({ where: { id: hw.id }, include: { files: true } });
    assert.ok(!/script|onerror/i.test(saved.contentHtml), "contentHtml lưu vào DB phải đã lọc");
    assert.deepEqual(saved.files.map((f) => f.originalName), ["de-bai.pdf"], "Chỉ gắn file của chính giáo viên");

    const file = (await findFile(saved.files[0].id))!;
    const asUser = async (id: string) => (await loadSessionUser(id))!;
    assert.equal(await canReadFile(await asUser(teacher.id), file), true, "Giáo viên xem được");
    assert.equal(await canReadFile(await asUser(student.id), file), true, "Học sinh trong lớp xem được");

    // Đổi sang giao cho lớp trống → hs.an không còn trong lớp được giao.
    await prisma.homeworkClass.deleteMany({ where: { homeworkId: hw.id } });
    await prisma.homeworkClass.create({ data: { homeworkId: hw.id, classId: emptyClass.id } });
    assert.equal(await canReadFile(await asUser(student.id), (await findFile(file.id))!), false, "Học sinh ngoài lớp không xem được");
    // Admin xem được (quyền ALL) — "outsider" ở đây để chắc quyền ALL hoạt động.
    assert.equal(await canReadFile(await asUser(outsider.id), (await findFile(file.id))!), true, "Admin xem được");

    console.log("✔ verify-homework: lọc HTML, gắn file đúng chủ, phân quyền xem file");
  } finally {
    const files = await prisma.storedFile.findMany({
      where: { OR: [{ homeworkId: homeworkId || undefined }, { id: { in: [own, foreign].flatMap((r) => (r.ok ? [r.file.id] : [])) } }] },
    });
    for (const f of files) await deleteObject(f.objectKey);
    await prisma.storedFile.deleteMany({ where: { id: { in: files.map((f) => f.id) } } });
    if (homeworkId) await prisma.homework.delete({ where: { id: homeworkId } });
    await prisma.classroom.delete({ where: { id: emptyClass.id } });
  }
}

main()
  .catch((e) => {
    console.error("✘ verify-homework:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
