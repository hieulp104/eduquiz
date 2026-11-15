/**
 * Đọc đề từ file (CHỈ chạy ở server — dùng mammoth / exceljs):
 *   .docx → văn bản giữ đậm / nghiêng / gạch chân (<b> <i> <u>)
 *   .txt  → văn bản
 *   .tex  (gói ex_test) / .xlsx → câu hỏi → văn bản (serializeExam)
 * Kết quả là VĂN BẢN cho trình soạn đề (định dạng ở exam-text.ts) — chưa lưu gì.
 */
import path from "node:path";
import { normalizeInline, stripTags } from "@/lib/inline-format";
import {
  parseExamText,
  serializeExam,
  tidyImportedText,
  type ImportResult,
  type ImportedQuestion,
  type ParsedExam,
} from "@/modules/exams/exam-text";
import type { ExamDraftPayload } from "@/modules/exams/exam-draft";

export { parseExamText };
export type { ImportResult };

const LETTERS = "ABCDEFGH";

// ═══════════════════ Word ═══════════════════

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** HTML của mammoth → văn bản: mỗi đoạn / ô bảng 1 dòng, chỉ giữ <b> <i> <u>. */
export function htmlToMarkup(html: string): string {
  // Danh sách đánh số tự động của Word (<ol><li>) mất số khi đọc → đánh dấu mục để đánh số lại bên dưới.
  const stack: string[] = [];
  const marked = html.replace(/<(\/?)(ol|ul|li)(\s[^>]*)?>/gi, (m, close: string, tag: string) => {
    const t = tag.toLowerCase();
    if (t === "li") return close ? m : stack.at(-1) === "ol" ? `${m}${OL_ITEM}` : m;
    if (close) stack.pop();
    else stack.push(t);
    return m;
  });
  const text = marked
    .replace(/<(strong|b)(\s[^>]*)?>/gi, "<b>")
    .replace(/<\/(strong|b)>/gi, "</b>")
    .replace(/<em(\s[^>]*)?>/gi, "<i>")
    .replace(/<\/em>/gi, "</i>")
    .replace(/<u\s[^>]*>/gi, "<u>")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|td|th|tr|table)>/gi, "\n")
    .replace(/<(?!\/?[biu]>)[^>]*>/gi, "")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1));
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    });
  // Chuẩn hóa thẻ từng dòng nhưng giữ tab / khoảng trắng đầu dòng (đáp án "\tA. …\tB. …").
  let lastNo = 0;
  return text
    .split("\n")
    .map((raw) => {
      const isItem = raw.includes(OL_ITEM);
      const l = raw.replaceAll(OL_ITEM, "");
      const lead = l.match(/^\s*/)![0];
      let line = lead + normalizeInline(l);
      const plain = stripTags(line);
      const numbered = plain.match(NUMBERED_RE);
      if (numbered) lastNo = Number(numbered[1]);
      else if (isItem && looksLikeQuestion(plain)) {
        // Mục danh sách giống câu hỏi (có phương án A. B., chỗ trống, dấu ?) → gắn lại số câu tiếp theo.
        lastNo += 1;
        line = `${lastNo}. ${line.trimStart()}`;
      }
      return line;
    })
    .join("\n");
}

const OL_ITEM = "\u0001";
const NUMBERED_RE = /^\s*(?:(?:Câu|Bài|Question)\s*)?(\d{1,3})\s*[.):]/i;

function looksLikeQuestion(plain: string): boolean {
  const t = plain.trim();
  return /^\*?A\s*[.)]\s*\S.*\s(?:\*?B)\s*[.)]/.test(t) || /_{2,}|…|\.{4,}/.test(t) || /\?\s*$/.test(t);
}

/** .docx → văn bản. Công thức (Equation / MathType) và hình ảnh không đọc được → cảnh báo. */
export async function docxToMarkup(buffer: Buffer): Promise<{ text: string; warnings: string[] }> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: ["u => u"],
      // Không nhúng ảnh base64 vào HTML (ảnh chưa hỗ trợ, chỉ tốn bộ nhớ).
      convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
    },
  );
  const warnings: string[] = [];
  try {
    const JSZip = (await import("jszip")).default;
    const xml = (await (await JSZip.loadAsync(buffer)).file("word/document.xml")?.async("string")) ?? "";
    const hasMath = xml.includes("<m:oMath") || xml.includes("<w:object");
    const hasImage = xml.includes("<w:drawing") || xml.includes("<w:pict");
    if (hasMath || hasImage) {
      const what = [hasMath && "công thức", hasImage && "hình ảnh"].filter(Boolean).join(" và ");
      warnings.push(`File có ${what} — phần này chưa đọc được nên có thể bị trống, vui lòng kiểm tra lại câu hỏi.`);
    }
  } catch {
    /* không soi được XML thì thôi */
  }
  return { text: tidyImportedText(htmlToMarkup(value)), warnings };
}

/** Đọc docx thành câu hỏi (dùng trong kiểm thử). */
export async function parseExamDocx(buffer: Buffer, title: string): Promise<ParsedExam> {
  const { text, warnings } = await docxToMarkup(buffer);
  const result = parseExamText(text, title);
  result.warnings.push(...warnings);
  return result;
}

/**
 * File tải lên → bản nháp cho trình soạn đề. Ném Error(message) nếu định dạng chưa hỗ trợ.
 * Cảnh báo ở đây chỉ là lưu ý khi ĐỌC FILE; lỗi từng câu do trình soạn đề tự báo khi đọc văn bản.
 */
export async function importExamFile(fileName: string, buffer: Buffer): Promise<ExamDraftPayload> {
  const ext = path.extname(fileName).toLowerCase();
  const title = path.basename(fileName).slice(0, 200) || "Đề nhập từ file";

  if (ext === ".docx") {
    const { text, warnings } = await docxToMarkup(buffer);
    return { title, text, warnings };
  }
  if (ext === ".txt") return { title, text: tidyImportedText(buffer.toString("utf8")), warnings: [] };

  if (ext === ".tex" || ext === ".xlsx") {
    const r = ext === ".tex" ? parseExamTex(buffer.toString("utf8"), title) : await parseExamXlsx(buffer, title);
    const text = serializeExam({ groups: [], questions: r.questions });
    const points = r.questions.map((q) => q.points);
    return { title, text, warnings: r.warnings, points: points.some((p) => p !== 1) ? points : undefined };
  }
  throw new UnsupportedFileError(ext);
}

export class UnsupportedFileError extends Error {
  constructor(readonly ext: string) {
    super(
      [".pdf", ".png", ".jpg", ".jpeg", ".webp"].includes(ext)
        ? "Nhận dạng đề từ PDF / ảnh đang được phát triển. Hiện hỗ trợ file Word (.docx), Excel (.xlsx), LaTeX (.tex) và .txt."
        : "Định dạng chưa hỗ trợ. Hãy dùng .docx, .xlsx, .tex hoặc .txt.",
    );
  }
}

// ═══════════════════ LaTeX (gói ex_test) ═══════════════════

/** Lấy nội dung trong cặp ngoặc nhọn bắt đầu ở vị trí `start` (ký tự "{"), có xử lý ngoặc lồng. */
function readBraced(s: string, start: number): { body: string; end: number } | null {
  if (s[start] !== "{") return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "\\") {
      i++; // bỏ qua ký tự được escape, VD \{
      continue;
    }
    if (s[i] === "{") depth++;
    else if (s[i] === "}" && --depth === 0) return { body: s.slice(start + 1, i), end: i + 1 };
  }
  return null;
}

/** Bỏ bớt lệnh định dạng LaTeX để câu hỏi đọc được; giữ nguyên công thức $...$. */
function cleanLatex(s: string): string {
  return s
    .replace(/%.*$/gm, "")
    .replace(/\\(textbf|textit|emph|underline)\{([^{}]*)\}/g, "$2")
    .replace(/\\(dfrac|tfrac)/g, "\\frac")
    .replace(/\\(immini|impicinpar)\b/g, "")
    .replace(/\\(begin|end)\{(center|tikzpicture|minipage)\}[\s\S]*?(?=\\|$)/g, "")
    .replace(/\\\\/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/**
 * .tex dạng \begin{ex} … \choice{…}{\True …}{…}{…} … \end{ex}.
 * Chỉ nhận câu có \choice (trắc nghiệm 1 đáp án). \choiceTF (đúng/sai) và \shortans bỏ qua có cảnh báo.
 * Công thức giữ dạng LaTeX ($...$) — trình soạn đề hiện hiển thị dạng mã.
 */
export function parseExamTex(source: string, title: string): ImportResult {
  const warnings: string[] = [];
  const questions: ImportedQuestion[] = [];
  let skipped = 0;
  let pictures = 0;

  // Bỏ chú thích (% … cuối dòng, trừ \%) trước — chú thích có thể chứa chữ "\begin{ex}".
  const code = source.replace(/(?<!\\)%.*$/gm, "");
  const blocks = [...code.matchAll(/\\begin\{ex\}([\s\S]*?)\\end\{ex\}/g)].map((m) => m[1]);
  blocks.forEach((block, idx) => {
    const no = idx + 1;
    const choiceAt = block.search(/\\choice(?![A-Za-z])/);
    if (choiceAt < 0) {
      skipped++;
      return;
    }
    if (/\\begin\{tikzpicture\}|\\includegraphics/.test(block)) pictures++;

    const stem = cleanLatex(block.slice(0, choiceAt).replace(/^\s*%[^\n]*\n/, ""));
    const options: { text: string; correct: boolean }[] = [];
    let pos = choiceAt + "\\choice".length;
    for (let k = 0; k < 8; k++) {
      while (pos < block.length && /\s/.test(block[pos])) pos++;
      const opt = readBraced(block, pos);
      if (!opt) break;
      const correct = /^\s*\\True\b/.test(opt.body);
      options.push({ text: cleanLatex(opt.body.replace(/^\s*\\True\b\s*/, "")), correct });
      pos = opt.end;
    }

    if (options.length < 2) {
      warnings.push(`Câu ${no}: bỏ qua vì có ít hơn 2 đáp án.`);
      return;
    }
    let correct = options.findIndex((o) => o.correct);
    if (correct < 0) {
      warnings.push(`Câu ${no}: không có \\True — tạm chọn A, vui lòng kiểm tra.`);
      correct = 0;
    }
    questions.push({
      content: stem || `Câu ${no}`,
      points: 1,
      options: options.map((o, i) => ({ content: o.text, isCorrect: i === correct })),
    });
  });

  if (skipped) warnings.push(`Bỏ qua ${skipped} câu đúng/sai hoặc trả lời ngắn — hiện chỉ hỗ trợ trắc nghiệm một đáp án đúng.`);
  if (pictures) warnings.push(`${pictures} câu có hình vẽ (TikZ / ảnh) — hình không được nhập, vui lòng kiểm tra.`);
  if (questions.length > 0) warnings.push("Công thức được giữ dạng mã LaTeX ($...$).");
  if (blocks.length === 0) warnings.push("Không tìm thấy câu hỏi dạng \\begin{ex} … \\end{ex}.");
  return { title, description: "", questions, warnings };
}

// ═══════════════════ Excel ═══════════════════

/**
 * .xlsx — dòng 1 là tiêu đề cột. Nhận diện cột theo tên (không phân biệt hoa thường):
 * "Câu hỏi" · "Đáp án A".."Đáp án H" (hoặc "A".."H") · "Đáp án đúng" · "Điểm" (tùy chọn).
 */
export async function parseExamXlsx(buffer: Buffer, title: string): Promise<ImportResult> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = wb.worksheets[0];
  const warnings: string[] = [];
  const empty = (msg: string): ImportResult => ({ title, description: "", questions: [], warnings: [msg] });
  if (!sheet) return empty("File Excel không có trang tính nào.");

  const cellText = (v: unknown): string => {
    if (v == null) return "";
    if (typeof v === "object" && "richText" in (v as object)) {
      return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
    }
    if (typeof v === "object" && "result" in (v as object)) return String((v as { result: unknown }).result ?? "");
    if (typeof v === "object" && "text" in (v as object)) return String((v as { text: unknown }).text ?? "");
    return String(v);
  };
  const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

  const header = sheet.getRow(1);
  const col: { question?: number; answer?: number; points?: number; options: Record<string, number> } = { options: {} };
  let looksLikeAnswerSheet = false;
  header.eachCell((cell, i) => {
    const h = norm(cellText(cell.value));
    if (h === "mã đề thi") looksLikeAnswerSheet = true;
    if (/^(câu hỏi|nội dung|question)/.test(h)) col.question = i;
    else if (/^(đáp án đúng|đáp án chọn|correct)/.test(h)) col.answer = i;
    else if (/^(điểm|points?)$/.test(h)) col.points = i;
    else {
      const m = h.match(/^(?:đáp án|phương án|option)?\s*([a-h])$/);
      if (m) col.options[m[1].toUpperCase()] = i;
    }
  });
  if (looksLikeAnswerSheet) {
    return empty("Đây là file bảng đáp án theo mã đề (dùng chấm bài thi giấy) — phần đề thi offline đang được phát triển.");
  }
  if (!col.question || Object.keys(col.options).length < 2) {
    return empty('Không nhận ra cột. Cần có cột "Câu hỏi" và ít nhất "Đáp án A", "Đáp án B". Tải file mẫu để xem.');
  }

  const letters = LETTERS.split("").filter((l) => col.options[l]);
  const questions: ImportedQuestion[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const content = cellText(row.getCell(col.question).value).trim();
    if (!content) continue;
    const options = letters.map((l) => cellText(row.getCell(col.options[l]).value).trim()).filter(Boolean);
    if (options.length < 2) {
      warnings.push(`Dòng ${r}: bỏ qua vì có ít hơn 2 đáp án.`);
      continue;
    }
    const ansRaw = col.answer ? cellText(row.getCell(col.answer).value).trim().toUpperCase() : "";
    let correct = LETTERS.indexOf(ansRaw.charAt(0));
    if (correct < 0 || correct >= options.length) {
      warnings.push(`Dòng ${r}: đáp án đúng "${ansRaw || "trống"}" không hợp lệ — tạm chọn A.`);
      correct = 0;
    }
    const pts = col.points ? Number(cellText(row.getCell(col.points).value).replace(",", ".")) : 1;
    questions.push({
      content,
      points: Number.isFinite(pts) && pts > 0 && pts <= 100 ? pts : 1,
      options: options.map((o, i) => ({ content: o, isCorrect: i === correct })),
    });
  }
  if (questions.length === 0 && warnings.length === 0) warnings.push("File Excel không có câu hỏi nào (từ dòng 2).");
  return { title, description: "", questions, warnings };
}
