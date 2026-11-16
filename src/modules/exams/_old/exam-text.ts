/**
 * Định dạng chữ của đề thi — dùng chung cho trình soạn đề (ô văn bản bên phải) và bộ đọc file.
 * Client-safe: không import gì phía server (trình soạn đề đọc lại văn bản mỗi lần gõ phím).
 *
 *   Choose the word whose underlined part…   ← chữ đứng trước câu hỏi = TIÊU ĐỀ NHÓM (lời dẫn / đoạn văn),
 *   Câu 1. Nội dung câu hỏi                     áp cho các câu ngay sau nó, tới nhóm kế tiếp.
 *   A. …   B. …   C. …   D. …                  ← đáp án: mỗi dòng 1 cái hoặc nhiều cái trên 1 dòng
 *   *B. …                                       ← dấu * trước nhãn = đáp án đúng
 *   Đáp án: B                                    ← hoặc ghi riêng 1 dòng
 *   Lời giải …                                   ← bỏ qua tới câu kế tiếp
 *   PHẦN I/II/III/IV                             ← đề cấu trúc 2025: chỉ PHẦN I được nhập
 *   ĐÁP ÁN  (hoặc ---HẾT---)                     ← bảng đáp án: "1.C | 2.A" · "Câu 1: B" · bảng Word
 *
 * Số câu: "Câu 1." / "Question 1." — hoặc chỉ "1." khi cả đề không dùng chữ "Câu"/"Question"
 * (khi đó số phải tăng dần 1, 2, 3… để không nhầm với danh sách đánh số trong câu).
 * Định dạng chữ: <b> <i> <u> (lib/inline-format.ts) — giữ nguyên trong nội dung câu hỏi.
 */
import { fromRuns, normalizeInline, sliceRuns, stripTags, toRuns, trimRuns, type Run } from "./inline-format";

export const LETTERS = "ABCDEFGH";

export type ParsedOption = { content: string; isCorrect: boolean };
/** Đáp án đúng lấy từ đâu: dòng "Đáp án: X" · bảng đáp án cuối đề · dấu * trước nhãn. */
export type AnswerSource = "line" | "key" | "star";

export type ParsedQuestion = {
  /** Số câu ghi trong văn bản (khóa của bảng đáp án). */
  no: number;
  /** Dòng bắt đầu / kết thúc (không gồm) trong văn bản — 0-based. */
  line: number;
  endLine: number;
  content: string;
  points: number;
  groupIndex: number | null;
  options: ParsedOption[];
  answerFrom: AnswerSource | null;
  answerLine: number | null;
  /** Mức độ: thẻ [NB] / [TH] / [VD] sau số câu. */
  level: Level | null;
  /** Thẻ [cố định] — không đảo đáp án câu này. */
  fixedOptions: boolean;
  /** Thẻ [audio:<id file>]. */
  audioId: string | null;
};

export type ParsedGroup = {
  content: string;
  /** Dòng đầu của nhóm (kể cả dòng thẻ). */
  line: number;
  /** Dòng [cố định nhóm] — không đảo thứ tự các câu trong nhóm. */
  fixedOrder: boolean;
  audioId: string | null;
};

/** Mức độ nhận thức — mã ngắn dùng trong văn bản đề. */
export const LEVELS = { NB: "Nhận biết", TH: "Thông hiểu", VD: "Vận dụng" } as const;
export type Level = keyof typeof LEVELS;

/** Thẻ đặt ngay sau số câu: "Câu 3. [TH] [cố định] [audio:abc] Nội dung…" */
const QUESTION_META_RE = /^\s*\[(NB|TH|VD|cố định|audio:[A-Za-z0-9_-]+)\]/i;
/** Dòng chỉ gồm thẻ của nhóm: "[cố định nhóm] [audio:abc]" */
const GROUP_META_LINE_RE = /^\s*(?:\[(?:cố định nhóm|audio:[A-Za-z0-9_-]+)\]\s*)+$/i;
const GROUP_TOKEN_RE = /\[(cố định nhóm|audio:[A-Za-z0-9_-]+)\]/gi;

/** Loại từng dòng — trình soạn đề tô màu theo đây. */
export type LineKind = "blank" | "question" | "option" | "answer" | "group" | "solution" | "part" | "key" | "ignored";

export type ParsedExam = {
  title: string;
  /** Chữ đứng riêng không thuộc câu nào (VD hướng dẫn trước "PHẦN I") — gợi ý cho ô Mô tả. */
  description: string;
  groups: ParsedGroup[];
  questions: ParsedQuestion[];
  warnings: string[];
  lineKinds: LineKind[];
  /** Dòng tiêu đề bảng đáp án ("ĐÁP ÁN" / "---HẾT---"), null nếu chưa có. */
  keyLine: number | null;
  sawPart: boolean;
};

/** Kết quả đọc file Excel / LaTeX (chưa có nhóm câu) — được chuyển sang văn bản bằng serializeExam. */
export type ImportedQuestion = { content: string; points: number; options: ParsedOption[] };

export type ImportResult = {
  title: string;
  description: string;
  questions: ImportedQuestion[];
  warnings: string[];
};

export const QUESTION_RE = /^\s*(?:Câu|Bài|Question)\s*(\d+)\s*[:.)]?\s*(.*)$/i;
const BARE_QUESTION_RE = /^\s*(\d{1,3})\s*[.)]\s*(.*)$/;
const OPTION_START_RE = /^\s*(\*)?\s*([A-H])\s*[.)]\s*(.*)$/;
const STARTS_WITH_OPTION_A = /^\s*\*?\s*A\s*[.)]/;
const ANSWER_LINE_RE = /^\s*(?:Đáp\s*án|Answer)\s*(?:đúng)?\s*[:：]\s*([A-H])\b/i;
/** Tiêu đề bảng đáp án đứng riêng 1 dòng: "ĐÁP ÁN", "Bảng đáp án", "Answer:", "Answer key", "Key". */
const ANSWER_KEY_HEADER_RE =
  /^\s*(?:BẢNG\s+)?(?:ĐÁP\s*ÁN(?:\s+(?:THAM\s+KHẢO|VÀ\s+HƯỚNG\s+DẪN\s+CHẤM|(?:MÃ\s+)?ĐỀ\s+\S+))?|HƯỚNG\s+DẪN\s+CHẤM|ANSWERS?(?:\s*KEYS?)?|KEYS?)\s*[:：.]?\s*$/i;
const END_MARK_RE = /^[\s\-_=.*]*HẾT[\s\-_=.*]*$/i;
export const PART_RE = /^\s*PHẦN\s+(I{1,3}|IV|V|\d)\b/i;
export const SOLUTION_RE = /^\s*(?:Lời\s*giải|Hướng\s*dẫn\s*giải|Giải\s*thích|Explanation)\b/i;

const PART_NUMBER: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
const PART_KIND: Record<number, string> = { 2: "nhiều đáp án đúng", 3: "đúng/sai", 4: "trả lời ngắn" };
const MAX_DESCRIPTION = 2000;

const partNumber = (m: RegExpMatchArray) => PART_NUMBER[m[1].toUpperCase()] ?? (Number(m[1]) || 1);

/** Vị trí nội dung 1 phương án trên chữ thuần; `labelAt` = vị trí chữ cái nhãn (để xem nhãn có được gạch chân/in đậm). */
type Span = { start: number; end: number; star: boolean; labelAt: number };

type Mark = { index: number; end: number; star: boolean; letter: string };

function findMarks(line: string, re: RegExp): Mark[] {
  const marks: Mark[] = [];
  for (let m; (m = re.exec(line)); ) {
    marks.push({ index: m.index + m[1].length, end: re.lastIndex, star: m[2] === "*", letter: m[3] });
  }
  return marks;
}

const consecutive = (marks: Mark[]) =>
  marks.every((mk, i) => i === 0 || mk.letter.charCodeAt(0) === marks[i - 1].letter.charCodeAt(0) + 1);

/**
 * "A. 3   B. 5   *C. 6" → vị trí nội dung từng đáp án (tính trên chữ thuần, từ `from`).
 * Nhận khi có ≥ 2 nhãn liên tiếp A→B→C… cách nhau bằng tab hoặc ≥ 2 dấu cách; hoặc chỉ 1 dấu cách
 * nếu dòng bắt đầu bằng "A." và có ≥ 3 nhãn A→B→C (VD "A. go B. goes C. going D. to go").
 */
function inlineOptionSpans(plain: string, from = 0): Span[] | null {
  const seg = plain.slice(from);
  const lead = seg.length - seg.trimStart().length;
  const line = seg.trimStart();
  let marks = findMarks(line, /(^|\s{2,}|\t)(\*?)([A-H])\s*[.)]\s*/g);
  if (marks.length < 2 || !consecutive(marks)) {
    const loose = findMarks(line, /(^|\s)(\*?)([A-H])\s*[.)]\s+/g);
    if (loose.length < 3 || loose[0].index !== 0 || loose[0].letter !== "A" || !consecutive(loose)) return null;
    marks = loose;
  }
  const base = from + lead;
  return marks.map((mk, i) => ({
    start: base + mk.end,
    end: base + (i + 1 < marks.length ? marks[i + 1].index : line.length),
    star: mk.star,
    labelAt: base + mk.index + (mk.star ? 1 : 0),
  }));
}

/** Kiểu chữ tại vị trí `pos` (chữ thuần) — nhãn "B." được gạch chân / in đậm = đánh dấu đáp án đúng. */
function styledAt(runs: Run[], pos: number): boolean {
  let at = 0;
  for (const r of runs) {
    if (pos < at + r.text.length) return r.u || r.b;
    at += r.text.length;
  }
  return false;
}

/** Bảng đáp án sau "HẾT" / "ĐÁP ÁN". Khóa: "phần:câu" → chữ cái. */
class AnswerKeyReader {
  readonly keys = new Map<string, string>();
  private part = 1;
  private mode: "pairs" | "tableNumbers" | "tableLetters" | "skip" = "pairs";
  private numbers: number[] = [];
  private letters: string[] = [];

  private flushTable() {
    this.numbers.forEach((n, i) => {
      const l = this.letters[i];
      if (l) this.keys.set(`${this.part}:${n}`, l);
    });
    this.numbers = [];
    this.letters = [];
  }

  line(raw: string) {
    const line = raw.trim();
    const part = line.match(PART_RE);
    if (part) {
      this.flushTable();
      this.part = partNumber(part);
      this.mode = "pairs";
      return;
    }
    if (SOLUTION_RE.test(line)) {
      this.flushTable();
      this.mode = "skip"; // "Lời giải" trong bảng đáp án: "Câu 1: A đúng vì…" — không phải đáp án
      return;
    }
    if (this.mode === "skip") return;

    // Bảng Word đọc ra mỗi ô 1 dòng: "Câu", 1, 2, …, "Chọn", D, A, …
    if (/^Câu$/i.test(line)) {
      this.flushTable();
      this.mode = "tableNumbers";
      return;
    }
    if (/^(Chọn|Đáp\s*án)$/i.test(line) && this.mode === "tableNumbers") {
      this.mode = "tableLetters";
      return;
    }
    if (this.mode === "tableNumbers") {
      if (/^\d+$/.test(line)) this.numbers.push(Number(line));
      return;
    }
    if (this.mode === "tableLetters") {
      if (/^[A-H]$/i.test(line)) this.letters.push(line.toUpperCase());
      else this.flushTable();
      return;
    }

    // Bảng không có tiêu đề: ô số rồi ô chữ (hàng "1 2 3…" / "A B C…", hoặc từng cặp "1", "A").
    if (/^\d{1,3}$/.test(line)) {
      if (this.letters.length) this.flushTable();
      this.numbers.push(Number(line));
      return;
    }
    if (/^[A-H]$/.test(line) && this.numbers.length > this.letters.length) {
      this.letters.push(line);
      return;
    }
    this.flushTable();

    // "1.B 2.C" · "1.C | 2.A" · "Câu 1: B" · "Câu 1. A|B|D" (nhiều đáp án — chỉ dùng khi 1 chữ)
    for (const m of line.matchAll(/(\d+)\s*[.:)\-]?\s*([A-H])(?![|A-Za-zÀ-ỹ])/g)) {
      this.keys.set(`${this.part}:${Number(m[1])}`, m[2]);
    }
  }

  done() {
    this.flushTable();
  }
}

/** `marked`: nhãn "B." được gạch chân / in đậm riêng — cách đánh dấu đáp án đúng hay gặp trong file Word. */
type DraftOption = { runs: Run[]; star: boolean; marked: boolean };
type DraftQuestion = {
  part: number;
  no: number;
  line: number;
  endLine: number;
  stem: Run[][];
  options: DraftOption[];
  answer?: { letter: string; line: number };
  /** Đáp án chỉ là nhãn A/B/C/D đặt dưới chữ gạch chân. */
  bareLabels?: boolean;
  group: DraftGroup | null;
  level: Level | null;
  fixedOptions: boolean;
  audioId: string | null;
  /** Mở đầu bằng "Câu n" / "Question n" (không phải số trơn). */
  prefixed: boolean;
};

const newDraft = (part: number, no: number, line: number, group: DraftGroup | null, prefixed: boolean): DraftQuestion => ({
  part,
  no,
  line,
  endLine: line + 1,
  stem: [],
  options: [],
  group,
  level: null,
  fixedOptions: false,
  audioId: null,
  prefixed,
});
type DraftGroup = { lines: string[]; line: number; questionCount: number; fixedOrder: boolean; audioId: string | null };

const groupText = (g: DraftGroup) => g.lines.join("\n").trim();
const runsText = (runs: Run[]) => fromRuns(trimRuns(runs));

const spanOptions = (spans: Span[], runs: Run[]): DraftOption[] =>
  spans.map((s) => ({ runs: sliceRuns(runs, s.start, s.end), star: s.star, marked: styledAt(runs, s.labelAt) }));

/** Một phương án trên cả dòng "B. …" (`om` khớp OPTION_START_RE trên đoạn cuối của `plain`). */
function singleOption(om: RegExpMatchArray, plain: string, runs: Run[]): DraftOption {
  const offset = plain.length - om[0].length;
  return {
    runs: sliceRuns(runs, plain.length - om[3].length),
    star: om[1] === "*",
    marked: styledAt(runs, offset + om[0].search(/[A-H]/)),
  };
}

export function parseExamText(text: string, title = "Đề nhập từ file"): ParsedExam {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.replace(/ /g, " "));
  const plains = lines.map(stripTags);
  const kinds: LineKind[] = lines.map((_, i) => (plains[i].trim() ? "ignored" : "blank"));
  const warnings: string[] = [];

  let keyStart = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (END_MARK_RE.test(plains[i]) || ANSWER_KEY_HEADER_RE.test(plains[i])) {
      keyStart = i;
      break;
    }
  }

  const drafts: DraftQuestion[] = [];
  const groups: DraftGroup[] = [];
  let current: DraftQuestion | null = null;
  let group: DraftGroup | null = null;
  let part = 1;
  let sawPart = false;
  let lastNo = 0;
  let inSolution = false;

  const attach = (i: number, kind: LineKind) => {
    kinds[i] = kind;
    if (current) current.endLine = i + 1;
  };

  for (let i = 0; i < keyStart; i++) {
    const plain = plains[i];
    if (!plain.trim()) continue;
    const runs = toRuns(lines[i]);

    const partMatch = plain.match(PART_RE);
    if (partMatch) {
      part = partNumber(partMatch);
      sawPart = true;
      current = null;
      group = null;
      lastNo = 0;
      inSolution = false;
      kinds[i] = "part";
      continue;
    }

    // ── Đầu câu hỏi ──
    let q: { no: number; rest: number; prefixed: boolean } | null = null;
    const pm = plain.match(QUESTION_RE);
    if (pm) q = { no: Number(pm[1]), rest: plain.length - pm[2].length, prefixed: true };
    else {
      const bm = plain.match(BARE_QUESTION_RE);
      const no = bm ? Number(bm[1]) : 0;
      // Số trơn "n." chỉ là câu mới khi: số tăng dần (hoặc đánh lại từ 1 sau tiêu đề nhóm), không nằm trong
      // lời giải, và không nằm trong đề bài của câu "Câu n" chưa có đáp án (danh sách 1. 2. 3. trong câu hỏi).
      const inPrefixedStem = Boolean(current?.prefixed && current.options.length === 0);
      const inPrefixedSolution = Boolean(inSolution && current?.prefixed);
      // Câu đầu tiên của đề được bắt đầu ở số bất kỳ (đề cắt từ giữa) nếu có phương án ngay trên dòng.
      const firstWithOptions = bm && drafts.length === 0 && STARTS_WITH_OPTION_A.test(bm[2]);
      if (
        bm &&
        !inPrefixedSolution &&
        !inPrefixedStem &&
        (no === lastNo + 1 || (no === 1 && !current) || firstWithOptions)
      ) {
        q = { no, rest: plain.length - bm[2].length, prefixed: false };
      }
    }
    if (q) {
      inSolution = false;
      lastNo = q.no;
      // Nhóm vừa đọc trùng (là phần cuối) nhóm trước → đề lặp lại lời dẫn/đoạn văn cho từng câu: gộp lại.
      if (group && group.questionCount === 0) {
        const prev = groups.at(-2);
        const text = groupText(group);
        // Bản lặp có thể thiếu vài dòng (VD bỏ "From: … To: …") → mọi dòng của nhóm mới đều có trong nhóm trước là gộp.
        const prevLines = new Set(prev?.lines.map((l) => l.trim()));
        if (prev && prev.questionCount > 0 && text && group.lines.every((l) => prevLines.has(l.trim()))) {
          groups.pop();
          group = prev;
        }
      }
      current = newDraft(part, q.no, i, group, q.prefixed);
      // Thẻ sau số câu: [NB] [TH] [VD] [cố định] [audio:id]
      for (let m; (m = plain.slice(q.rest).match(QUESTION_META_RE)); ) {
        q.rest += m[0].length;
        const tag = m[1];
        if (/^audio:/i.test(tag)) current.audioId = tag.slice(6);
        else if (/^cố định$/i.test(tag)) current.fixedOptions = true;
        else current.level = tag.toUpperCase() as Level;
      }
      if (group) group.questionCount++;
      drafts.push(current);
      kinds[i] = "question";

      const restPlain = plain.slice(q.rest);
      if (STARTS_WITH_OPTION_A.test(restPlain)) {
        // "1. A. miss<u>es</u>   B. fix<u>es</u>…" — đáp án ngay trên dòng số câu.
        const spans = inlineOptionSpans(plain, q.rest);
        if (spans) current.options.push(...spanOptions(spans, runs));
        else {
          const om = restPlain.match(OPTION_START_RE)!;
          current.options.push(singleOption(om, plain, runs));
        }
      } else if (restPlain.trim()) {
        current.stem.push(sliceRuns(runs, q.rest));
      }
      continue;
    }

    if (current && SOLUTION_RE.test(plain)) {
      inSolution = true;
      attach(i, "solution");
      continue;
    }
    if (inSolution) {
      attach(i, "solution");
      continue;
    }

    // ── Dòng thẻ của nhóm: [cố định nhóm] [audio:id] — mở nhóm mới nếu cần ──
    if (GROUP_META_LINE_RE.test(plain)) {
      current = null;
      if (!group || group.questionCount > 0) {
        group = { lines: [], line: i, questionCount: 0, fixedOrder: false, audioId: null };
        groups.push(group);
      }
      for (const m of plain.matchAll(GROUP_TOKEN_RE)) {
        if (/^audio:/i.test(m[1])) group.audioId = m[1].slice(6);
        else group.fixedOrder = true;
      }
      kinds[i] = "group";
      continue;
    }

    // ── Trong câu hỏi: đáp án / dòng nối tiếp ──
    if (current) {
      const ans = plain.match(ANSWER_LINE_RE);
      if (ans) {
        current.answer = { letter: ans[1].toUpperCase(), line: i };
        attach(i, "answer");
        continue;
      }
      const spans = inlineOptionSpans(plain);
      // Câu đã đủ đáp án mà gặp thêm dòng "A. …  B. …" → câu mới bị mất số (Word tự đánh số / dán thiếu số).
      if (spans && current.options.length >= 2 && /^\s*\*?A\s*[.)]/.test(plain)) {
        lastNo++;
        current = newDraft(part, lastNo, i, group, false);
        current.options.push(...spanOptions(spans, runs));
        if (group) group.questionCount++;
        drafts.push(current);
        kinds[i] = "question";
        warnings.push(`Câu ${lastNo} (dòng ${i + 1}): không có số câu — đã tự đánh số, vui lòng kiểm tra.`);
        continue;
      }
      if (spans) {
        current.options.push(...spanOptions(spans, runs));
        attach(i, "option");
        continue;
      }
      // Câu tìm lỗi sai: dưới câu chỉ có nhãn "A  B  C  *D" đặt dưới các từ gạch chân.
      const bare = plain.trim().split(/\s+/);
      if (current.options.length === 0 && bare.length >= 2 && bare.every((t) => /^\*?[A-H]$/.test(t))) {
        current.options.push(
          ...bare.map((t) => ({ runs: [{ text: t.replace("*", ""), b: false, i: false, u: false }], star: t.startsWith("*"), marked: false })),
        );
        current.bareLabels = true;
        attach(i, "option");
        continue;
      }
      const om = plain.match(OPTION_START_RE);
      if (om) {
        current.options.push(singleOption(om, plain, runs));
        attach(i, "option");
        continue;
      }
      if (current.options.length === 0) {
        current.stem.push(runs); // nội dung câu hỏi nhiều dòng
        attach(i, "question");
        continue;
      }
      current = null; // đã có đáp án mà gặp chữ thường → câu kết thúc, bắt đầu nhóm mới
    }

    // ── Tiêu đề nhóm (lời dẫn / đoạn văn) ──
    if (!group || group.questionCount > 0) {
      group = { lines: [], line: i, questionCount: 0, fixedOrder: false, audioId: null };
      groups.push(group);
    }
    group.lines.push(normalizeInline(lines[i]));
    kinds[i] = "group";
  }

  const key = new AnswerKeyReader();
  for (let i = keyStart; i < lines.length; i++) {
    if (!plains[i].trim()) continue;
    kinds[i] = "key";
    if (i > keyStart) key.line(plains[i]);
  }
  key.done();

  // ── Dựng kết quả ──
  const description: string[] = [];
  const firstQuestionLine = drafts[0]?.line ?? Infinity;
  for (const g of groups) {
    if (g.questionCount === 0 && g.line < firstQuestionLine && groupText(g)) description.push(groupText(g));
  }

  const questions: ParsedQuestion[] = [];
  const outGroups: ParsedGroup[] = [];
  const groupIndex = new Map<DraftGroup, number>();
  const skippedByPart = new Map<number, number>();
  const seenNo = new Set<number>();

  for (const d of drafts) {
    if (d.part !== 1) {
      skippedByPart.set(d.part, (skippedByPart.get(d.part) ?? 0) + 1);
      continue;
    }
    const label = `${sawPart ? "Phần I, " : ""}Câu ${d.no}`;
    const options = d.options.map((o) => ({ text: runsText(o.runs), star: o.star, marked: o.marked })).filter((o) => o.text);
    if (options.length < 2) {
      warnings.push(
        options.length === 0
          ? `${label}: bỏ qua vì không có đáp án A/B/C… (câu tự luận / điền từ chưa hỗ trợ).`
          : `${label}: bỏ qua vì có ít hơn 2 đáp án.`,
      );
      continue;
    }
    if (d.bareLabels) {
      warnings.push(`${label}: câu tìm lỗi sai — đáp án chỉ có nhãn A/B/C/D, hãy ghi rõ phần được gạch chân.`);
    }
    if (seenNo.has(d.no)) warnings.push(`${label}: số câu bị trùng — bảng đáp án có thể gán nhầm, nên đánh số lại.`);
    seenNo.add(d.no);

    let answerFrom: AnswerSource | null = null;
    let letter: string | undefined;
    if (d.answer) {
      answerFrom = "line";
      letter = d.answer.letter;
    } else if (key.keys.has(`1:${d.no}`)) {
      answerFrom = "key";
      letter = key.keys.get(`1:${d.no}`);
    } else {
      const star = options.findIndex((o) => o.star);
      // Không có * → đúng 1 phương án có nhãn được gạch chân / in đậm riêng thì lấy làm đáp án.
      const marked = options.flatMap((o, i) => (o.marked ? [i] : []));
      const pick = star >= 0 ? star : marked.length === 1 ? marked[0] : -1;
      if (pick >= 0) {
        answerFrom = "star";
        letter = LETTERS[pick];
      }
    }
    let correct = letter ? LETTERS.indexOf(letter) : -1;
    if (correct >= Math.min(options.length, 8)) {
      warnings.push(`${label}: đáp án đúng "${letter}" không có trong các phương án.`);
      correct = -1;
      answerFrom = null;
    } else if (correct < 0) {
      warnings.push(`${label}: chưa có đáp án đúng.`);
    }

    let gi: number | null = null;
    if (d.group) {
      if (!groupIndex.has(d.group)) {
        groupIndex.set(d.group, outGroups.length);
        outGroups.push({
          content: groupText(d.group),
          line: d.group.line,
          fixedOrder: d.group.fixedOrder,
          audioId: d.group.audioId,
        });
      }
      gi = groupIndex.get(d.group)!;
    }

    questions.push({
      no: d.no,
      line: d.line,
      endLine: d.endLine,
      content: d.stem.map(runsText).join("\n").trim(),
      points: 1,
      groupIndex: gi,
      options: options.slice(0, 8).map((o, i) => ({ content: o.text, isCorrect: i === correct })),
      answerFrom: correct >= 0 ? answerFrom : null,
      answerLine: answerFrom === "line" ? d.answer!.line : null,
      level: d.level,
      fixedOptions: d.fixedOptions,
      audioId: d.audioId,
    });
  }

  for (const [p, n] of skippedByPart) {
    const roman = Object.keys(PART_NUMBER).find((k) => PART_NUMBER[k] === p) ?? String(p);
    warnings.push(
      `PHẦN ${roman}${PART_KIND[p] ? ` (${PART_KIND[p]})` : ""}: bỏ qua ${n} câu — hiện chỉ hỗ trợ trắc nghiệm một đáp án đúng.`,
    );
  }
  if (drafts.length === 0 && lines.some((l) => l.trim())) {
    warnings.push('Không tìm thấy câu hỏi. Mỗi câu cần bắt đầu bằng "Câu 1.", "Question 1." hoặc "1.".');
  }

  return {
    title,
    description: description.join("\n").slice(0, MAX_DESCRIPTION),
    groups: outGroups,
    questions,
    warnings,
    lineKinds: kinds,
    keyLine: keyStart < lines.length ? keyStart : null,
    sawPart,
  };
}

// ═══════════════════ Sinh văn bản ═══════════════════

/** "1.C | 2.A | …" — 10 câu một dòng. */
export function answerKeyLines(entries: { no: number; letter: string }[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < entries.length; i += 10) {
    out.push(
      entries
        .slice(i, i + 10)
        .map((e) => `${e.no}.${e.letter}`)
        .join(" | "),
    );
  }
  return out;
}

export type QuestionMeta = { level?: Level | null; fixedOptions?: boolean; audioId?: string | null };
export type GroupMeta = { fixedOrder?: boolean; audioId?: string | null };

/** Thẻ đặt sau số câu, VD "[TH] [cố định] [audio:abc]". */
function questionTags(m: QuestionMeta): string {
  return [m.level && `[${m.level}]`, m.fixedOptions && "[cố định]", m.audioId && `[audio:${m.audioId}]`]
    .filter(Boolean)
    .join(" ");
}

/** Dòng thẻ của nhóm, VD "[cố định nhóm] [audio:abc]" ("" nếu không có). */
function groupTags(m: GroupMeta): string {
  return [m.fixedOrder && "[cố định nhóm]", m.audioId && `[audio:${m.audioId}]`].filter(Boolean).join(" ");
}

export type SerializableExam = {
  groups: ({ content: string } & GroupMeta)[];
  questions: ({ content: string; groupIndex?: number | null; options: ParsedOption[] } & QuestionMeta)[];
};

/** Các dòng của 1 câu (không gồm đáp án đúng — ghi ở bảng cuối đề hoặc dòng "Đáp án"). */
function questionLines(no: number, q: SerializableExam["questions"][number]): string[] {
  const tags = questionTags(q);
  const head = `Câu ${no}.${tags ? ` ${tags}` : ""}`;
  const opts = q.options.map((o, j) => `${LETTERS[j]}. ${o.content.replace(/\s*\n\s*/g, " ")}`);
  const short = q.options.every((o) => stripTags(o.content).length <= 22 && !o.content.includes("\n"));
  const stem = q.content.split("\n");
  if (!q.content.trim()) return short ? [`${head} ${opts.join("\t")}`] : [head, ...opts];
  return [`${head} ${stem[0]}`, ...stem.slice(1), ...(short ? [opts.join("\t")] : opts)];
}

/** Đề (từ DB / Excel / LaTeX) → văn bản cho trình soạn đề. Đáp án đúng ghi ở bảng cuối đề. */
export function serializeExam(exam: SerializableExam): string {
  const out: string[] = [];
  const key: { no: number; letter: string }[] = [];
  let lastGroup: number | null = null;

  exam.questions.forEach((q, i) => {
    const gi = q.groupIndex ?? null;
    const g = gi !== null ? exam.groups[gi] : undefined;
    if (g && gi !== lastGroup) {
      const tags = groupTags(g);
      if (tags) out.push(tags);
      out.push(...g.content.split("\n").filter((l) => l.trim()));
    }
    lastGroup = gi;
    out.push(...questionLines(i + 1, q));
    const correct = q.options.findIndex((o) => o.isCorrect);
    if (correct >= 0) key.push({ no: i + 1, letter: LETTERS[correct] });
  });

  if (key.length) out.push("ĐÁP ÁN", ...answerKeyLines(key));
  return out.join("\n");
}

const splitLines = (text: string) => text.replace(/\r/g, "").split("\n");

/** Ghi lại bảng đáp án PHẦN I (thay vùng cũ / thêm cuối đề); giữ đáp án các phần khác và "Lời giải". */
function writeAnswerKey(
  lines: string[],
  keyLine: number | null,
  sawPart: boolean,
  entries: { no: number; letter: string }[],
) {
  const keyText = answerKeyLines(entries);
  if (keyLine === null) {
    if (!entries.length) return;
    while (lines.length && !lines.at(-1)!.trim()) lines.pop();
    lines.push("ĐÁP ÁN", ...keyText);
    return;
  }
  let end = keyLine + 1;
  for (; end < lines.length; end++) {
    const p = stripTags(lines[end]);
    const pm = p.match(PART_RE);
    if ((pm && partNumber(pm) !== 1) || SOLUTION_RE.test(p)) break;
  }
  lines.splice(keyLine + 1, end - keyLine - 1, ...(sawPart ? ["PHẦN I"] : []), ...keyText);
}

/** Đáp án hiện tại (trừ câu ghi "Đáp án: X") để ghi vào bảng đáp án. */
function keyEntries(
  parsed: ParsedExam,
  override?: { qi: number; letter: string },
  renumber?: (qi: number) => number | null,
) {
  return parsed.questions
    .map((x, idx) => {
      if (x.answerFrom === "line") return null;
      const no = renumber ? renumber(idx) : x.no;
      if (no === null) return null;
      if (override && idx === override.qi) return { no, letter: override.letter };
      const c = x.options.findIndex((o) => o.isCorrect);
      return x.answerFrom && c >= 0 ? { no, letter: LETTERS[c] } : null;
    })
    .filter((e): e is { no: number; letter: string } => e !== null);
}

/**
 * Chọn đáp án đúng cho câu `qi` (bấm ở cột xem trước) → sửa lại văn bản:
 * câu ghi "Đáp án: X" thì sửa dòng đó; còn lại bỏ dấu * của câu và ghi vào bảng đáp án cuối đề.
 */
export function setCorrectOption(text: string, parsed: ParsedExam, qi: number, oi: number): string {
  const lines = splitLines(text);
  const q = parsed.questions[qi];
  const letter = LETTERS[oi];
  if (!q || !letter) return text;

  if (q.answerFrom === "line" && q.answerLine !== null) {
    lines[q.answerLine] = lines[q.answerLine].replace(/([:：]\s*(?:<\/?[biu]>)*)[A-H]/i, `$1${letter}`);
    return lines.join("\n");
  }
  for (let i = q.line; i < q.endLine; i++) {
    lines[i] = lines[i].replace(/\*(?=(?:<\/?[biu]>)*\s*[A-H](?:\s*[.)]|\s|$))/g, "");
  }
  writeAnswerKey(lines, parsed.keyLine, parsed.sawPart, keyEntries(parsed, { qi, letter }));
  return lines.join("\n");
}

/** Phần "Câu 12." / "12." đầu dòng câu hỏi (có thể có thẻ định dạng phía trước). */
const HEAD_RE = /^(\s*(?:<\/?[biu]>)*\s*(?:(?:Câu|Bài|Question)\s*)?)(\d+)(\s*[:.)]?)/i;
const LINE_TAG_RE = /\s*\[(?:NB|TH|VD|cố định|audio:[A-Za-z0-9_-]+)\]/gi;

/** Đổi thẻ của câu `qi` (mức độ / cố định đáp án / audio) — viết lại dòng số câu. */
export function setQuestionMeta(text: string, parsed: ParsedExam, qi: number, patch: QuestionMeta): string {
  const q = parsed.questions[qi];
  if (!q) return text;
  const lines = splitLines(text);
  const head = lines[q.line].match(HEAD_RE);
  if (!head) return text;
  const meta: QuestionMeta = { level: q.level, fixedOptions: q.fixedOptions, audioId: q.audioId, ...patch };
  const rest = lines[q.line].slice(head[0].length).replace(LINE_TAG_RE, "").trimStart();
  const tags = questionTags(meta);
  lines[q.line] = `${head[0]}${tags ? ` ${tags}` : ""}${rest ? ` ${rest}` : ""}`;
  return lines.join("\n");
}

/** Đặt cùng một mức độ cho câu `qi` và (nếu `andBelow`) mọi câu phía sau. */
export function setLevel(text: string, qi: number, level: Level | null, andBelow: boolean): string {
  let t = text;
  const count = parseExamText(text).questions.length;
  for (let i = qi; i < (andBelow ? count : qi + 1); i++) t = setQuestionMeta(t, parseExamText(t), i, { level });
  return t;
}

/** Đổi thẻ của nhóm `gi`: một dòng "[cố định nhóm] [audio:id]" ở đầu nhóm. */
export function setGroupMeta(text: string, parsed: ParsedExam, gi: number, patch: GroupMeta): string {
  const g = parsed.groups[gi];
  const first = parsed.questions.find((q) => q.groupIndex === gi);
  if (!g || !first) return text;
  const lines = splitLines(text);
  const meta: GroupMeta = { fixedOrder: g.fixedOrder, audioId: g.audioId, ...patch };
  const head = lines.slice(g.line, first.line).filter((l) => !GROUP_META_LINE_RE.test(stripTags(l)));
  const tags = groupTags(meta);
  lines.splice(g.line, first.line - g.line, ...(tags ? [tags] : []), ...head);
  return lines.join("\n");
}

/** Văn bản của 1 câu (từ dòng số câu tới hết đáp án / lời giải) — cho "Copy nội dung". */
export function questionBlock(text: string, parsed: ParsedExam, qi: number): string {
  const q = parsed.questions[qi];
  return q ? splitLines(text).slice(q.line, q.endLine).join("\n") : "";
}

/** Xóa câu `qi`; đánh số lại các câu sau và ghi lại bảng đáp án cho khớp. */
export function removeQuestion(text: string, parsed: ParsedExam, qi: number): string {
  const q = parsed.questions[qi];
  if (!q) return text;
  const lines = splitLines(text);
  const removed = q.endLine - q.line;
  const newNo = (idx: number) =>
    idx === qi ? null : idx < qi ? parsed.questions[idx].no : parsed.questions[idx].no - 1;

  // Đánh số lại các câu sau (vị trí dòng chưa xê dịch), rồi mới cắt khối câu bị xóa.
  for (let idx = qi + 1; idx < parsed.questions.length; idx++) {
    const x = parsed.questions[idx];
    lines[x.line] = lines[x.line].replace(HEAD_RE, (_m, a: string, n: string, b: string) => `${a}${Number(n) - 1}${b}`);
  }
  const entries = keyEntries(parsed, undefined, newNo);
  lines.splice(q.line, removed);
  const keyLine = parsed.keyLine === null ? null : parsed.keyLine - removed;
  writeAnswerKey(lines, keyLine, parsed.sawPart, entries);
  return lines.join("\n");
}

/** Thay câu `qi` bằng câu khác ("Đổi câu khác") — giữ số câu và mức độ; đáp án ghi dòng "Đáp án: X". */
export function replaceQuestion(
  text: string,
  parsed: ParsedExam,
  qi: number,
  next: { content: string; options: string[]; correctIndex: number },
): string {
  const q = parsed.questions[qi];
  if (!q) return text;
  const lines = splitLines(text);
  const head = lines[q.line].match(HEAD_RE);
  const body = questionLines(q.no, {
    content: next.content,
    options: next.options.map((content, i) => ({ content, isCorrect: i === next.correctIndex })),
    level: q.level,
  });
  if (head) body[0] = body[0].replace(/^Câu \d+\./, head[0]);
  lines.splice(q.line, q.endLine - q.line, ...body, `Đáp án: ${LETTERS[next.correctIndex] ?? "A"}`);
  return lines.join("\n");
}

// ═══════════════════ Dọn văn bản đọc từ file ═══════════════════

const HEADER_LINE_RE =
  /^(Họ\s*(và)?\s*tên|Lớp|Trường|Thời\s*gian|Mã\s*đề|SBD|Số\s*báo\s*danh|Môn|Điểm|Name|Class|Time)\b/i;

/** Dòng đầu trang kiểu "TEST UNIT 2", "SỞ GD&ĐT…", "Họ và tên: ……" — không phải nội dung câu hỏi. */
function isHeaderLine(plain: string): boolean {
  const t = plain.trim();
  if (!t || PART_RE.test(t) || QUESTION_RE.test(t)) return false;
  const letters = t.replace(/[^\p{L}]/gu, "");
  if (letters && t === t.toUpperCase() && t.length <= 100) return true;
  return HEADER_LINE_RE.test(t) || /\.{5,}|…{3,}/.test(t);
}

/** Bỏ dòng trống và phần đầu trang (tên đề, họ tên, lớp…) trước câu hỏi / lời dẫn đầu tiên. */
export function tidyImportedText(text: string): string {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/ /g, " ").trimEnd())
    .filter((l) => stripTags(l).trim());
  let start = 0;
  while (start < lines.length && isHeaderLine(stripTags(lines[start]))) start++;
  return lines.slice(start).join("\n");
}


/** Mã mức độ trong văn bản ↔ giá trị enum QuestionLevel trong DB. */
export const LEVEL_DB = { NB: "RECOGNITION", TH: "COMPREHENSION", VD: "APPLICATION" } as const;
export const LEVEL_FROM_DB = { RECOGNITION: "NB", COMPREHENSION: "TH", APPLICATION: "VD" } as const;
