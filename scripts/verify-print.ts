/**
 * Kiểm thử "Phân tích cấu trúc đề" + "In đề + phiếu trả lời" (không cần DB).
 * - Tổng hợp theo mức độ / nhóm.
 * - Mã đề: cùng mã → cùng thứ tự; nhóm giữ chỗ; đáp án đúng đi theo phương án khi đảo.
 * - File .docx đọc lại được (mammoth): đủ mã đề, phiếu trả lời, bảng đáp án khớp.
 */
import assert from "node:assert/strict";
import mammoth from "mammoth";
import { summarizeGroups, summarizeLevels } from "@/modules/exams/exam-analysis";
import { buildPrintDocx } from "@/modules/exams/exam-print";
import { buildVersions, defaultCodes, parseCodes, printOptionsSchema } from "@/modules/exams/exam-print.types";

const o = (content: string, isCorrect = false) => ({ content, isCorrect });
const exam = {
  id: "exam-verify",
  title: "Đề verify in",
  grade: 8,
  subject: "Tiếng Anh",
  durationMinutes: 40,
  groups: [
    { id: "g1", content: "Choose the word whose <u>underlined</u> part differs.", fixedOrder: true },
    { id: "g2", content: "Read the passage.\nThen answer the questions.", fixedOrder: false },
  ],
  questions: [
    { id: "q1", groupId: "g1", content: "", fixedOptions: false, options: [o("s<u>e</u>rvice", true), o("provide"), o("maturity"), o("orphanage")] },
    { id: "q2", groupId: "g1", content: "", fixedOptions: false, options: [o("donated"), o("provided"), o("flooded"), o("changed", true)] },
    { id: "q3", groupId: "g2", content: "What is the passage about?", fixedOptions: false, options: [o("A long answer that needs its own line to fit", true), o("Short"), o("Other"), o("None")] },
    { id: "q4", groupId: "g2", content: "Who wrote it?", fixedOptions: false, options: [o("Lan"), o("Nam", true), o("Hoa"), o("Mai")] },
    { id: "q5", groupId: null, content: "She ___ to school.", fixedOptions: true, options: [o("go"), o("goes", true), o("Cả A và B"), o("Không có")] },
    { id: "q6", groupId: null, content: "They ___ football.", fixedOptions: false, options: [o("play", true), o("plays"), o("playing"), o("played")] },
  ],
};

function verifyAnalysis() {
  const qs = [
    { points: 2, level: "RECOGNITION" as const, groupId: "g1" },
    { points: 2, level: "RECOGNITION" as const, groupId: "g1" },
    { points: 3, level: "APPLICATION" as const, groupId: null },
    { points: 3, level: null, groupId: null },
  ];
  const s = summarizeLevels(qs);
  assert.deepEqual(s.rows.map((r) => [r.key, r.count, r.points, r.percent]), [
    ["RECOGNITION", 2, 4, 40],
    ["COMPREHENSION", 0, 0, 0],
    ["APPLICATION", 1, 3, 30],
    ["NONE", 1, 3, 30],
  ]);
  assert.deepEqual([s.count, s.points], [4, 10]);
  assert.equal(summarizeLevels(qs.slice(0, 3)).rows.length, 3, "không có câu chưa gán thì không có dòng 'Chưa gán'");
  const g = summarizeGroups(qs);
  assert.deepEqual(g.map((r) => [r.label, r.from, r.to, r.count, r.points]), [
    ["Nhóm 1", 1, 2, 2, 4],
    ["Câu đứng riêng", 3, 4, 2, 6],
  ]);
  assert.deepEqual(g[1].levels, { RECOGNITION: 0, COMPREHENSION: 0, APPLICATION: 1, NONE: 1 });
}

function verifyVersions() {
  assert.deepEqual(defaultCodes(3), ["101", "102", "103"]);
  assert.deepEqual(parseCodes(" 201, 202;203\n204 "), ["201", "202", "203", "204"]);
  const base = { count: 2, codes: [], shuffleQuestions: true, shuffleOptions: true, sheet: "BUBBLE", includeKey: true, school: "", examName: "" };
  assert.equal(printOptionsSchema.safeParse(base).success, true);
  assert.equal(printOptionsSchema.safeParse({ ...base, codes: ["A1"] }).success, false, "số mã đề phải khớp số đề");
  assert.equal(printOptionsSchema.safeParse({ ...base, codes: ["a1", "A1"] }).success, false, "mã đề trùng");
  assert.equal(printOptionsSchema.safeParse({ ...base, count: 25 }).success, false);

  const questions = exam.questions.map((q) => ({ ...q, group: exam.groups.find((g) => g.id === q.groupId) ?? null }));
  const opts = { count: 12, codes: [] as string[], shuffleQuestions: true, shuffleOptions: true };
  const versions = buildVersions(exam.id, questions, opts);
  assert.deepEqual(buildVersions(exam.id, questions, opts), versions, "in lại cùng mã đề → cùng thứ tự");
  let differs = false;
  for (const v of versions) {
    const ids = v.questions.map((q) => q.id);
    assert.deepEqual(ids.slice(0, 2), ["q1", "q2"], "nhóm cố định giữ chỗ + thứ tự");
    assert.deepEqual(ids.slice(2, 4).sort(), ["q3", "q4"], "nhóm 2 giữ chỗ");
    assert.deepEqual(ids.slice(4).sort(), ["q5", "q6"]);
    const q5 = v.questions.find((q) => q.id === "q5")!;
    assert.deepEqual(q5.options.map((x) => x.content), ["go", "goes", "Cả A và B", "Không có"], "câu cố định đáp án không đảo");
    v.questions.forEach((q, i) => assert.equal(q.options["ABCD".indexOf(v.key[i])].isCorrect, true, "đáp án đúng đi theo phương án"));
    if (v.key.join("") !== versions[0].key.join("")) differs = true;
  }
  assert.ok(differs, "các mã đề phải khác nhau");
  const plain = buildVersions(exam.id, questions, { ...opts, count: 1, shuffleQuestions: false, shuffleOptions: false })[0];
  assert.deepEqual([plain.code, plain.key.join("")], ["101", "ADABBA"], "không đảo → đúng đề gốc");
  return versions;
}

async function verifyDocx() {
  const opts = printOptionsSchema.parse({
    count: 2,
    codes: ["A01", "B02"],
    shuffleQuestions: true,
    shuffleOptions: true,
    sheet: "LETTER",
    includeKey: true,
    school: "Trường THCS Verify",
    examName: "Kiểm tra giữa kỳ I",
  });
  const questions = exam.questions.map((q) => ({ ...q, group: exam.groups.find((g) => g.id === q.groupId) ?? null }));
  const versions = buildVersions(exam.id, questions, opts);
  const buffer = Buffer.from(await buildPrintDocx(exam, opts));
  const text = (await mammoth.extractRawText({ buffer })).value;

  for (const piece of ["Mã đề: A01", "Mã đề: B02", "TRƯỜNG THCS VERIFY", "Kiểm tra giữa kỳ I", "Thời gian làm bài: 40 phút", "PHIẾU TRẢ LỜI TRẮC NGHIỆM", "Số báo danh", "ĐÁP ÁN", "------ HẾT ------"]) {
    assert.ok(text.includes(piece), `file in thiếu: ${piece}`);
  }
  assert.equal(text.split("Câu 6. ").length - 1, 2, "mỗi mã đề đủ 6 câu");
  assert.equal(text.split("Read the passage.").length - 1, 2, "lời dẫn nhóm in ở mỗi mã đề");
  for (const v of versions) {
    const section = text.slice(text.lastIndexOf(`Mã đề ${v.code}`));
    v.key.forEach((letter, i) => assert.ok(section.includes(`${i + 1}. ${letter}`), `bảng đáp án mã ${v.code} câu ${i + 1}`));
  }
  const html = (await mammoth.convertToHtml({ buffer }, { styleMap: ["u => u"] })).value;
  assert.ok(/<u>e<\/u>|<u>underlined<\/u>/.test(html), "giữ gạch chân trong file in");

  const bare = (await mammoth.extractRawText({ buffer: Buffer.from(await buildPrintDocx(exam, { ...opts, count: 1, codes: [], sheet: "NONE", includeKey: false })) })).value;
  assert.ok(!bare.includes("PHIẾU TRẢ LỜI") && !bare.includes("ĐÁP ÁN") && bare.includes("Mã đề: 101"));
  const bubbles = (await mammoth.extractRawText({ buffer: Buffer.from(await buildPrintDocx(exam, { ...opts, sheet: "BUBBLE" })) })).value;
  assert.ok(bubbles.includes("Ⓐ  Ⓑ  Ⓒ  Ⓓ") && bubbles.includes("06."), "phiếu tô có đủ ô tròn cho 6 câu");
}

async function main() {
  verifyAnalysis();
  verifyVersions();
  await verifyDocx();
  console.log("✔ verify-print: phân tích cấu trúc đề, mã đề đảo cố định theo mã, file in đọc lại được (đề + phiếu + đáp án)");
}

main().catch((e) => {
  console.error("✘ verify-print:", e.message);
  process.exitCode = 1;
});
