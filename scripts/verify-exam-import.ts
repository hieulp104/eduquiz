/**
 * Kiểm thử bộ đọc đề từ file (không cần DB).
 * Chạy: npm run verify
 */
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { htmlToMarkup, parseExamDocx, parseExamTex, parseExamText, parseExamXlsx } from "@/modules/exams/exam-import";
import {
  questionBlock,
  removeQuestion,
  replaceQuestion,
  serializeExam,
  setCorrectOption,
  setGroupMeta,
  setLevel,
  setQuestionMeta,
  tidyImportedText,
} from "@/modules/exams/exam-text";
import { distributePoints } from "@/modules/exams/exam-points";
import { fromRuns, toRuns } from "@/lib/inline-format";
import { exportWorksheetDocx } from "@/modules/worksheet/worksheet.docx";

const correctOf = (q: { options: { content: string; isCorrect: boolean }[] }) => q.options.find((o) => o.isCorrect)?.content;

async function main() {
  // 1. Mỗi đáp án 1 dòng, * đánh dấu đáp án đúng, nội dung nhiều dòng, dòng "Đáp án:"
  const a = parseExamText(`ĐỀ KIỂM TRA 15 PHÚT
Họ và tên: ........
Câu 1: Thủ đô của Việt Nam là
thành phố nào?
A. Hồ Chí Minh
*B. Hà Nội
C. Đà Nẵng
Câu 2. 2 + 3 = ?
A. 4
B. 5
C. 6
Đáp án: B
Câu 3: Thiếu đáp án
A. chỉ một`);
  assert.equal(a.questions.length, 2);
  assert.equal(a.questions[0].content, "Thủ đô của Việt Nam là\nthành phố nào?");
  assert.equal(correctOf(a.questions[0]), "Hà Nội");
  assert.equal(correctOf(a.questions[1]), "5");
  assert.ok(a.warnings.some((w) => w.startsWith("Câu 3")), "Câu thiếu đáp án phải có cảnh báo");

  // 2. Nhiều đáp án trên 1 dòng + bảng đáp án cuối đề
  const b = parseExamText(`Câu 1: Số liền sau của 4 là:
A. 3    B. 5    C. 6    D. 4
Câu 2: 10 - 7 = ?
A. 2\tB. 4\tC. 3\tD. 17
ĐÁP ÁN
1.B  2.C`);
  assert.equal(b.questions.length, 2);
  assert.deepEqual(b.questions[0].options.map((o) => o.content), ["3", "5", "6", "4"]);
  assert.equal(correctOf(b.questions[0]), "5");
  assert.equal(correctOf(b.questions[1]), "3");

  // 3. Đọc ngược file docx do trang "Tạo phiếu bài tập" xuất ra
  const blob = await exportWorksheetDocx(
    "Phiếu thử",
    [
      { id: "1", nodeId: "n", type: "MCQ", content: "Số liền sau của 4 là:", options: ["3", "5", "6", "4"], correctIndex: 1 },
      { id: "2", nodeId: "n", type: "MCQ", content: "8 + 2 = ?", options: ["9", "11", "10"], correctIndex: 2 },
    ],
    { includeAnswerKey: true, includeStudentInfo: true, examMinutes: 45 },
  );
  const c = await parseExamDocx(Buffer.from(await blob.arrayBuffer()), "Phiếu thử");
  assert.equal(c.questions.length, 2, `docx: ${JSON.stringify(c)}`);
  assert.equal(correctOf(c.questions[0]), "5");
  assert.equal(correctOf(c.questions[1]), "10");

  // 4. Excel đúng mẫu
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("De thi");
  ws.addRow(["STT", "Câu hỏi", "Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D", "Đáp án đúng", "Điểm"]);
  ws.addRow([1, "1 + 1 = ?", "1", "2", "3", "4", "B", 2]);
  ws.addRow([2, "Màu của lá cây?", "Đỏ", "Xanh", "", "", "b", ""]);
  ws.addRow([3, "Thiếu đáp án", "Chỉ A", "", "", "", "A", 1]);
  const d = await parseExamXlsx(Buffer.from(await wb.xlsx.writeBuffer()), "Excel thử");
  assert.equal(d.questions.length, 2);
  assert.equal(correctOf(d.questions[0]), "2");
  assert.equal(d.questions[0].points, 2);
  assert.equal(correctOf(d.questions[1]), "Xanh", "đáp án chữ thường vẫn nhận");
  assert.ok(d.warnings.some((w) => w.startsWith("Dòng 4")));

  // 5. Đề cấu trúc 2025: PHẦN I–IV + bảng đáp án dạng bảng sau "HẾT" (Word đọc ra mỗi ô 1 dòng) + Lời giải
  const e = parseExamText(`Hướng dẫn: đọc kỹ đề.
PHẦN I. Câu trắc nghiệm một đáp án đúng
Câu 1. Số nào là số nguyên tố?
\tA. 4\tB. 6
\tC. 7\tD. 9
Câu 2. 10 : 2 = ?
 A. 2   B. 5   C. 8   D. 20
PHẦN II. Câu trắc nghiệm nhiều đáp án đúng
Câu 1. Số nào chẵn?
A. 2  B. 3  C. 4  D. 5
PHẦN III. Câu trắc nghiệm đúng sai.
Câu 1. Cho tam giác vuông.
a) Có một góc vuông.
---------------------------HẾT------------------------
PHẦN I
Câu
1
2
Chọn
C
B
Lời giải
Câu 1: A đúng vì…
PHẦN II
Câu 1. A|C`);
  assert.equal(e.questions.length, 2, JSON.stringify(e));
  assert.equal(correctOf(e.questions[0]), "7");
  assert.equal(correctOf(e.questions[1]), "5");
  assert.equal(e.description, "Hướng dẫn: đọc kỹ đề.");
  assert.ok(e.warnings.some((w) => w.startsWith("PHẦN II (nhiều đáp án đúng): bỏ qua 1")));
  assert.ok(e.warnings.some((w) => w.startsWith("PHẦN III (đúng/sai): bỏ qua 1")));

  // 6. Tiếng Anh: đoạn văn chung, đáp án trên cùng dòng "Question n.", Lời giải, câu tìm lỗi sai, câu điền từ
  const f = parseExamText(`Read the passage and choose the best option.
We usually (1)_____ early.
Question 1.  \t *A. arrive\t B. arrives\t C. arriving\t D. to arrive
Lời giải
Chủ ngữ We → arrive.
B. đây là dòng giải thích, không phải đáp án
Question 2. She have lived here since 2018.
\t\tA\t\t*B\t\tC\t\tD
Question 3. She is highly ______ for the job.
Lời giải
qualified`);
  assert.equal(f.questions.length, 2);
  assert.equal(f.questions[0].options.length, 4, "đáp án cùng dòng với Question 1");
  assert.equal(correctOf(f.questions[0]), "arrive");
  assert.equal(f.groups.length, 1, "đoạn văn chung thành 1 nhóm");
  assert.match(f.groups[0].content, /Read the passage[\s\S]*\(1\)/);
  assert.ok(f.questions.every((q) => q.groupIndex === 0));
  assert.equal(correctOf(f.questions[1]), "B");
  assert.ok(f.warnings.some((w) => w.includes("Câu 2: câu tìm lỗi sai")));
  assert.ok(f.warnings.some((w) => w.includes("Câu 3: bỏ qua vì không có đáp án")));

  // 7. LaTeX (gói ex_test)
  const g = parseExamTex(String.raw`% Chú thích có chữ \begin{ex} ... \end{ex} không được tính là câu
Giảm 10\% giá
\begin{ex}%Câu 1
Nguyên hàm của $f(x)=e^x$ là
\choice
{$\dfrac{e^{x+1}}{x+1}+C$}
{\True $e^x+C$}
{$x e^{x}$}
{$e^{2x}$}
\end{ex}
\begin{ex}%Câu 2 đúng/sai
Xét tính đúng sai
\choiceTF
{\True a}{b}{c}{d}
\end{ex}`, "tex");
  assert.equal(g.questions.length, 1);
  assert.equal(correctOf(g.questions[0]), "$e^x+C$");
  assert.equal(g.questions[0].options[0].content, "$\\frac{e^{x+1}}{x+1}+C$", "ngoặc lồng nhau + \\dfrac→\\frac");
  assert.ok(g.warnings.some((w) => w.includes("Bỏ qua 1 câu đúng/sai")));

  // 8. Excel bảng đáp án theo mã đề (đề offline) → báo đúng loại file
  const wb2 = new ExcelJS.Workbook();
  const ws2 = wb2.addWorksheet("S");
  ws2.addRow(["Câu hỏi", "Mã đề thi", "Mã đề thi"]);
  ws2.addRow(["Câu hỏi", "0001", "0002"]);
  ws2.addRow(["1", "C", "D"]);
  const h = await parseExamXlsx(Buffer.from(await wb2.xlsx.writeBuffer()), "offline");
  assert.equal(h.questions.length, 0);
  assert.match(h.warnings[0], /bảng đáp án theo mã đề/);

  // 9. Định dạng <b> <i> <u>: cân bằng thẻ, gộp thẻ thừa
  assert.equal(fromRuns(toRuns("<b><i>Choose </i></b><b><i>the</i></b> word")), "<b><i>Choose the</i></b> word");
  assert.equal(fromRuns(toRuns("<b>a <i>c</i> d")), "<b>a <i>c</i> d</b>", "thẻ thiếu đóng được đóng lại");
  assert.equal(fromRuns(toRuns("x < y và <p>")), "x < y và <p>", "chữ < khác thẻ b/i/u giữ nguyên");
  assert.equal(
    htmlToMarkup("<p><strong><em>Choose</em></strong> it</p><p>1. A. miss<u>es</u>\tB. fix<u>es</u></p><p>a &lt; b &amp; c</p>"),
    "<b><i>Choose</i></b> it\n1. A. miss<u>es</u>\tB. fix<u>es</u>\na < b & c\n",
  );

  // 10. Đề kiểu tiếng Anh: số câu "1." không có chữ "Câu", tiêu đề nhóm, đáp án cùng dòng số câu,
  //     đoạn văn lặp lại cho từng câu (gộp 1 nhóm), bảng đáp án "ĐÁP ÁN", đầu trang bị bỏ.
  const passage = "Read the passage and choose True or False.\nI live in a big house with my family.";
  const english = tidyImportedText(`TEST UNIT 2

<b><i>Choose the word whose underlined part is pronounced differently.</i></b>
1. A. miss<u>es</u>\tB. fix<u>es</u>\tC. lik<u>es</u>\tD. watch<u>es</u>
2. A. apartment<u>s</u>\tB. cupboard<u>s</u>\tC. kitchen<u>s</u>\tD. bathroom<u>s</u>
<b><i>Choose the best answer.</i></b>
3. There are three ______ in my school.
A.  library\tB. libraries\tC. librarys\tD. libraryes
4. He lives in a <b><i>villa</i></b>.
\tA. big house\tB. small house
\tC. old house\tD. new house
IV. READING
${passage}
5. The house is big.
A. True    \t\t\tB. False
      ${passage}
6. He lives alone.
A. True\t\tB. False
<b><i>Choose the sentence closest in meaning.</i></b>
7. <i>Hoa has no bookshelf.</i>
A. There is a bookshelf.
B. There isn’t a bookshelf.
ĐÁP ÁN
1.C
2.A
3.B
4.A
5.A
6.B
7.B`);
  assert.ok(!english.startsWith("TEST UNIT"), "dòng tên đề viết hoa ở đầu bị bỏ");
  const en = parseExamText(english);
  assert.equal(en.questions.length, 7, JSON.stringify(en.warnings));
  assert.deepEqual(en.warnings, []);
  assert.deepEqual(
    en.questions.map((q) => q.groupIndex),
    [0, 0, 1, 1, 2, 2, 3],
    "câu 5–6 chung đoạn văn lặp lại → 1 nhóm",
  );
  assert.equal(en.groups.length, 4);
  assert.match(en.groups[2].content, /^IV\. READING\nRead the passage/);
  assert.equal(en.questions[0].content, "", "câu phát âm không có nội dung riêng");
  assert.deepEqual(en.questions[0].options.map((o) => o.content), ["miss<u>es</u>", "fix<u>es</u>", "lik<u>es</u>", "watch<u>es</u>"]);
  assert.equal(correctOf(en.questions[0]), "lik<u>es</u>");
  assert.equal(en.questions[3].content, "He lives in a <b><i>villa</i></b>.");
  assert.equal(en.questions[3].options.length, 4, "4 đáp án trên 2 dòng có tab đầu dòng");
  assert.equal(correctOf(en.questions[4]), "True");
  assert.equal(correctOf(en.questions[6]), "There isn’t a bookshelf.");
  assert.ok(en.questions.every((q) => q.answerFrom === "key"));

  // 11. Bấm chọn đáp án ở cột trái → sửa bảng đáp án (giữ nguyên phần còn lại)
  const changed = setCorrectOption(english, en, 2, 3);
  const en2 = parseExamText(changed);
  assert.equal(correctOf(en2.questions[2]), "libraryes");
  assert.equal(correctOf(en2.questions[0]), "lik<u>es</u>", "câu khác giữ đáp án");
  assert.equal(changed.split("ĐÁP ÁN")[0], english.split("ĐÁP ÁN")[0], "phần đề không đổi");
  // … câu ghi "Đáp án: X" thì sửa đúng dòng đó; câu dùng dấu * thì bỏ dấu * và ghi vào bảng đáp án
  const lineText = "Câu 1: A?\nA. x\nB. y\nĐáp án: A";
  const withLine = setCorrectOption(lineText, parseExamText(lineText), 0, 1);
  assert.equal(withLine, "Câu 1: A?\nA. x\nB. y\nĐáp án: B");
  const starText = "Câu 1. Hỏi?\n*A. x\tB. y\nCâu 2. Hỏi 2?\nA. m\t*B. n";
  const star = setCorrectOption(starText, parseExamText(starText), 0, 1);
  assert.equal(star, "Câu 1. Hỏi?\nA. x\tB. y\nCâu 2. Hỏi 2?\nA. m\t*B. n\nĐÁP ÁN\n1.B | 2.B");
  const s2 = parseExamText(star);
  assert.deepEqual(s2.questions.map(correctOf), ["y", "n"]);
  // … câu chưa có đáp án
  const none = parseExamText("1. Hỏi?\nA. x\nB. y");
  assert.equal(none.questions[0].answerFrom, null);
  assert.ok(none.warnings.some((w) => w.includes("chưa có đáp án đúng")));
  assert.equal(correctOf(parseExamText(setCorrectOption("1. Hỏi?\nA. x\nB. y", none, 0, 0)).questions[0]), "x");

  // 12. Đề lưu trong DB → văn bản → đọc lại phải ra đúng như cũ (trang Sửa đề)
  const roundTrip = parseExamText(serializeExam({ groups: en.groups, questions: en.questions }));
  assert.deepEqual(
    roundTrip.questions.map((q) => [q.content, q.groupIndex, q.options]),
    en.questions.map((q) => [q.content, q.groupIndex, q.options]),
  );
  assert.deepEqual(roundTrip.groups.map((g) => g.content), en.groups.map((g) => g.content));

  // 13. Số trơn trong đề có "Câu n" không bị nhầm là câu mới; số phải tăng dần
  const listed = parseExamText("Câu 1. Cho các phát biểu:\n1. Hà Nội là thủ đô.\n2. Huế ở miền Bắc.\nSố phát biểu đúng là\nA. 0\tB. 1\tC. 2\tD. 3\nĐáp án: B");
  assert.equal(listed.questions.length, 1);
  assert.match(listed.questions[0].content, /2\. Huế ở miền Bắc\./);

  // 14. Chia điểm: điểm nhập tay giữ nguyên, phần còn lại chia đều, tổng khớp
  const pts = distributePoints(3, [null, 4, null], 10).points;
  assert.deepEqual(pts, [3, 4, 3]);
  const thirds = distributePoints(3, [], 10).points;
  assert.equal(Math.round(thirds.reduce((x, y) => x + y, 0) * 100) / 100, 10);
  assert.ok(distributePoints(2, [6, 5], 10).error === null, "nhập tay hết thì tổng = tổng nhập tay");
  assert.ok(distributePoints(3, [6, 5], 10).error, "nhập tay vượt tổng điểm → lỗi");

  // 15. Thẻ câu / nhóm: mức độ, cố định, audio — đọc, ghi, giữ nguyên khi sinh lại văn bản
  const tagged = `[cố định nhóm] [audio:aud1]
<b>Listen and choose.</b>
1. [TH] [cố định] [audio:aud2] What is it?
A. a cat\tB. a dog
2. Where is it?
A. here\tB. there
ĐÁP ÁN
1.A | 2.B`;
  const tg = parseExamText(tagged);
  assert.deepEqual(tg.warnings, []);
  assert.deepEqual([tg.groups[0].fixedOrder, tg.groups[0].audioId, tg.groups[0].content], [true, "aud1", "<b>Listen and choose.</b>"]);
  assert.deepEqual([tg.questions[0].level, tg.questions[0].fixedOptions, tg.questions[0].audioId], ["TH", true, "aud2"]);
  assert.equal(tg.questions[0].content, "What is it?", "thẻ không lọt vào nội dung");
  assert.deepEqual([tg.questions[1].level, tg.questions[1].fixedOptions, tg.questions[1].audioId], [null, false, null]);

  const lv = setLevel(tagged, 0, "VD", true);
  assert.deepEqual(parseExamText(lv).questions.map((q) => q.level), ["VD", "VD"], "đặt mức độ cho câu này và các câu dưới");
  const unfixed = setGroupMeta(tagged, tg, 0, { fixedOrder: false, audioId: null });
  assert.ok(unfixed.startsWith("<b>Listen"), "bỏ hết thẻ nhóm → bỏ dòng thẻ");
  const g2 = parseExamText(unfixed);
  assert.deepEqual([g2.groups[0].fixedOrder, g2.groups[0].audioId, g2.questions.length], [false, null, 2]);
  const qm = setQuestionMeta(tagged, tg, 1, { audioId: "aud3", fixedOptions: true });
  assert.deepEqual([parseExamText(qm).questions[1].audioId, parseExamText(qm).questions[1].fixedOptions], ["aud3", true]);
  assert.deepEqual(
    parseExamText(serializeExam({ groups: tg.groups, questions: tg.questions })).questions.map((q) => [q.level, q.fixedOptions, q.audioId]),
    tg.questions.map((q) => [q.level, q.fixedOptions, q.audioId]),
    "sinh lại văn bản giữ thẻ",
  );
  assert.equal(questionBlock(tagged, tg, 1), "2. Where is it?\nA. here\tB. there");

  // 16. Xóa câu: đánh số lại câu sau (cả số trơn) + bảng đáp án khớp số mới
  const three = "1. Một?\nA. a\tB. b\n2. Hai?\nA. a\tB. b\n3. Ba?\nA. a\tB. b\nĐÁP ÁN\n1.A | 2.B | 3.B";
  const del = removeQuestion(three, parseExamText(three), 0);
  assert.equal(del, "1. Hai?\nA. a\tB. b\n2. Ba?\nA. a\tB. b\nĐÁP ÁN\n1.B | 2.B");
  // 17. Đổi câu khác: giữ số câu, đáp án ghi dòng "Đáp án"
  const swapped = replaceQuestion(three, parseExamText(three), 1, { content: "Mới?", options: ["x", "y", "z"], correctIndex: 2 });
  const sw = parseExamText(swapped);
  assert.equal(sw.questions.length, 3);
  assert.equal(sw.questions[1].content, "Mới?");
  assert.equal(correctOf(sw.questions[1]), "z");
  assert.equal(correctOf(sw.questions[2]), "b", "câu sau giữ đáp án");

  // 18. Đề trộn "1." và "Question 40:" — số trơn vẫn nhận (trước đây cả đề bị bỏ qua); bảng đáp án "Answer:"
  const mixed = parseExamText(`<b>Choose the best answer.</b>
1. I ___ a student.
A. am\tB. is\tC. are\tD. be
2. She ___ tall.
A. am\tB. is\tC. are\tD. be
<b>Question 3: <i>He is my brother.</i></b>
A. He is my sister.\tB. He is my brother.
Answer:
1. A
2.B
3B`);
  assert.equal(mixed.questions.length, 3, JSON.stringify(mixed.warnings));
  assert.deepEqual(mixed.questions.map(correctOf), ["am", "is", "He is my brother."]);
  assert.equal(mixed.questions[2].content, "<b><i>He is my brother.</i></b>");

  // 19. Mất số câu (Word tự đánh số): dòng "A. … B. …" sau câu đã đủ đáp án → câu mới, có cảnh báo
  const lost2 = parseExamText("1. A. bus\tB. cat\nA. book\tB. wall\n3. A. a\tB. b\nĐÁP ÁN\n1.A 2.B 3.A");
  assert.deepEqual(lost2.questions.map((q) => q.no), [1, 2, 3]);
  assert.equal(correctOf(lost2.questions[1]), "wall");
  assert.ok(lost2.warnings.some((w) => w.includes("tự đánh số")));

  // 20. Word đánh số tự động (<ol><li>) → gắn lại "1." "2." cho mục giống câu hỏi, nối tiếp số đã có
  assert.equal(
    htmlToMarkup("<p><strong>Find.</strong></p><ol><li>A. b<u>u</u>s\tB. comp<u>u</u>ter</li><li>A. book<u>s</u>\tB. wall<u>s</u></li></ol><p>3.\tA. x\tB. y</p><ol><li>Hello</li></ol>"),
    "<b>Find.</b>\n1. A. b<u>u</u>s\tB. comp<u>u</u>ter\n2. A. book<u>s</u>\tB. wall<u>s</u>\n3.\tA. x\tB. y\nHello\n",
  );

  // 21. Phương án cách 1 dấu cách; đáp án đánh dấu bằng gạch chân / in đậm nhãn; bảng đáp án không tiêu đề
  const loose = parseExamText("1. I ___ to school.\nA. go B. goes C. going D. to go\n2. Pick one.\nA. red\t<u>B.</u> blue\tC. green\n3. Vitamin C. is good?\nA. yes\tB. no");
  assert.deepEqual(loose.questions[0].options.map((o) => o.content), ["go", "goes", "going", "to go"]);
  assert.equal(correctOf(loose.questions[1]), "blue", "nhãn B gạch chân = đáp án đúng");
  assert.equal(loose.questions[2].content, "Vitamin C. is good?", "chữ 'C.' trong câu không bị tách");
  const table = parseExamText("1. Q?\nA. a\tB. b\n2. Q?\nA. a\tB. b\nĐÁP ÁN THAM KHẢO\n1\n2\nB\nA");
  assert.deepEqual(table.questions.map(correctOf), ["b", "a"]);

  // 22. Đoạn văn lặp lại nhưng có bản thiếu vài dòng → vẫn 1 nhóm
  const pass = "From: a@x.com\nHi Nick,\nShe (26) ___ here.";
  const rep = parseExamText(`${pass}\n26. A. lives\tB. works\nHi Nick,\nShe (26) ___ here.\n27. A. at\tB. on\n${pass}\n28. A. x\tB. y`);
  assert.deepEqual(rep.questions.map((q) => q.groupIndex), [0, 0, 0]);

  console.log("✔ verify-exam-import: chữ, docx, đề 2025, tiếng Anh (nhóm câu, gạch chân, đề trộn số, Word tự đánh số), sửa đáp án, thẻ câu/nhóm, xóa/đổi câu, LaTeX, Excel, chia điểm");
}

main().catch((e) => {
  console.error("✘ verify-exam-import:", e.message);
  process.exitCode = 1;
});
