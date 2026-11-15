/**
 * Kiểm thử luồng làm bài → chấm điểm trên DB dev (cần đã chạy db:seed).
 * Chạy: npm run verify
 *
 * - Chọn đúng 3/4 câu (mỗi câu 2,5đ) → phải được 7,5/10
 * - Nộp lần 2 → phải bị từ chối, điểm giữ nguyên
 * Dữ liệu thử bị xóa sau khi chạy.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "@/shared/prisma/prisma.service";
import {
  getSubmissionResult,
  gradeAndSubmit,
  startSubmission,
} from "@/modules/submissions/submissions.service";
import { listAssignmentsForStudent } from "@/modules/assignments/assignments.service";
import { orderForTaking } from "@/modules/submissions/exam-order";

/** Đảo đề: nhóm đi liền khối, nhóm cố định giữ thứ tự, câu cố định đáp án giữ A–D, cùng seed → cùng thứ tự. */
function verifyShuffle() {
  const mk = (id: string, group: { id: string; fixedOrder: boolean } | null, fixedOptions = false) => ({
    id,
    group,
    fixedOptions,
    options: ["a", "b", "c", "d"],
  });
  const g1 = { id: "g1", fixedOrder: true };
  const g2 = { id: "g2", fixedOrder: false };
  const qs = [mk("1", null), mk("2", g1), mk("3", g1), mk("4", g1), mk("5", g2), mk("6", g2), mk("7", null, true), mk("8", null)];
  const opts = { shuffleQuestions: true, shuffleOptions: true };
  for (let s = 0; s < 30; s++) {
    const out = orderForTaking(qs, `seed-${s}`, opts);
    assert.deepEqual(out.map((q) => q.id).sort(), qs.map((q) => q.id), "đủ câu, không trùng");
    const pos = (id: string) => out.findIndex((q) => q.id === id);
    assert.deepEqual([pos("3") - pos("2"), pos("4") - pos("3")], [1, 1], "nhóm cố định: liền nhau, đúng thứ tự");
    assert.equal(Math.abs(pos("5") - pos("6")), 1, "nhóm không cố định vẫn đi liền khối");
    assert.deepEqual(out[pos("7")].options, ["a", "b", "c", "d"], "câu cố định đáp án không đảo");
    assert.deepEqual(orderForTaking(qs, `seed-${s}`, opts), out, "cùng lượt làm → cùng thứ tự");
  }
  assert.deepEqual(orderForTaking(qs, "x", { shuffleQuestions: false, shuffleOptions: false }), qs, "tắt đảo → giữ nguyên");

  // Không đảo vị trí nhóm: nhóm đứng yên, câu đứng riêng liền nhau chỉ đảo tại chỗ.
  const still = { shuffleQuestions: true, shuffleOptions: false, shuffleGroups: false };
  let innerMoved = false;
  let groupsMoved = false;
  for (let s = 0; s < 30; s++) {
    const ids = orderForTaking(qs, `still-${s}`, still).map((q) => q.id);
    assert.equal(ids[0], "1", "câu đứng riêng đầu đề giữ chỗ");
    assert.deepEqual(ids.slice(1, 4), ["2", "3", "4"], "nhóm cố định giữ chỗ + thứ tự");
    assert.deepEqual(ids.slice(4, 6).sort(), ["5", "6"], "nhóm 2 giữ chỗ");
    assert.deepEqual(ids.slice(6).sort(), ["7", "8"], "2 câu đứng riêng cuối đề chỉ đảo với nhau");
    if (ids[4] === "6") innerMoved = true;
    const moved = orderForTaking(qs, `move-${s}`, { ...still, shuffleGroups: true }).map((q) => q.id);
    if (moved[0] !== "1") groupsMoved = true;
  }
  assert.ok(innerMoved, "câu trong nhóm không cố định phải được đảo");
  assert.ok(groupsMoved, "bật đảo vị trí nhóm thì các khối phải đổi chỗ");
}

async function main() {
  verifyShuffle();
  const student = await prisma.user.findUniqueOrThrow({ where: { email: "hs.cuong@eduquiz.vn" } });
  // Lấy đúng bài mẫu của seed — giáo viên có thể đã giao thêm đề khác cho lớp mẫu khi dùng thử.
  const assignment = (await listAssignmentsForStudent(student.id)).find((a) => a.exam.title === "Kiểm tra 15 phút — Toán 10");
  assert.ok(assignment, "Học sinh mẫu chưa có bài được giao — chạy npm run db:seed");

  // Dọn lượt làm cũ nếu lần chạy trước bị ngắt giữa chừng.
  await prisma.submission.deleteMany({ where: { assignmentId: assignment.id, studentId: student.id } });
  const sub = await startSubmission(assignment.id, assignment.examId, student.id);
  assert.ok(sub, "Phải tạo được lượt làm đầu tiên");

  try {
    const questions = await prisma.question.findMany({
      where: { examId: assignment.examId },
      orderBy: { order: "asc" },
      include: { options: true },
    });
    const answers: Record<string, string> = {};
    questions.forEach((q, i) => {
      answers[q.id] = q.options.find((o) => (i < 3 ? o.isCorrect : !o.isCorrect))!.id;
    });

    assert.equal(await gradeAndSubmit(sub.id, answers), true, "Lần nộp đầu phải thành công");
    assert.equal(await gradeAndSubmit(sub.id, {}), false, "Nộp lần 2 phải bị từ chối");

    const result = await getSubmissionResult(sub.id);
    assert.equal(result?.submission.score, 7.5);
    assert.equal(result?.submission.maxScore, 10);
    assert.equal(result?.submission.answers.length, 4);
    console.log("✔ verify-grading: chấm điểm đúng, chặn nộp 2 lần, đảo đề giữ nhóm / câu cố định");
  } finally {
    await prisma.submission.delete({ where: { id: sub.id } });
  }
}

main()
  .catch((e) => {
    console.error("✘ verify-grading:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
