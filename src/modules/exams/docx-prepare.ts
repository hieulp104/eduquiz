/**
 * Chuẩn bị file .docx trước khi đưa cho mammoth (CHỈ chạy ở server). mammoth làm mất 2 thứ rất hay gặp trong đề:
 *
 *  1. ĐÁNH SỐ TỰ ĐỘNG của Word (danh sách "A. B. C. D.", "1. 2. 3.", "Câu 1."): nhãn do Word sinh ra, không nằm
 *     trong chữ của đoạn → mammoth chỉ biết "đoạn này thuộc danh sách" và bỏ nhãn. Ở đây tính lại nhãn đúng như
 *     Word hiển thị (numbering.xml: định dạng, số bắt đầu, đánh số lại, nhiều cấp) rồi ghi thành chữ thật đầu đoạn.
 *  2. CHỮ TÔ MÀU / TÔ NỀN — cách giáo viên đánh dấu đáp án đúng. mammoth bỏ hết màu → bọc chữ đó bằng ký tự
 *     đánh dấu (MARK_*) mang theo "khóa màu"; exam-import.ts đọc lại để tìm phương án được tô khác các phương án còn lại.
 *
 * Không đụng tới phần còn lại của file; lỗi ở bước này thì bộ đọc dùng file gốc như trước.
 */
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

/** Ký tự đánh dấu — vùng Private Use của Unicode: hợp lệ trong XML, không gặp trong văn bản thường. */
export const MARK_OPEN = "";
export const MARK_SEP = "";
export const MARK_CLOSE = "";

type LevelDef = { start: number; fmt: string; text: string; rPr: Element | null; pStyle: string | null };
type AbstractDef = { levels: Map<number, LevelDef>; styleLink: string | null; numStyleLink: string | null };
type NumDef = { abstractId: string; overrides: Map<number, { start: number | null; level: LevelDef | null }> };
type StyleDef = { numId: string | null; ilvl: number | null; basedOn: string | null };

// ═══════════════════ XML ═══════════════════

function parseXml(xml: string): Document {
  const fatal = (message: string) => {
    throw new Error(message);
  };
  return new DOMParser({ errorHandler: { warning: () => {}, error: () => {}, fatalError: fatal } }).parseFromString(xml, "text/xml");
}

/** Phần tử con trực tiếp tên `name` (cùng namespace với phần tử cha — tránh nhầm `m:r`, `a:t`…). */
function kids(el: Element, name: string): Element[] {
  const out: Element[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (n as Element).localName === name && (n as Element).namespaceURI === el.namespaceURI) out.push(n as Element);
  }
  return out;
}

const kid = (el: Element | null | undefined, name: string): Element | null => (el ? (kids(el, name)[0] ?? null) : null);

/** Thuộc tính `w:<name>` (mặc định `w:val`). */
function attr(el: Element | null | undefined, name = "val"): string | null {
  if (!el) return null;
  const direct = el.getAttribute(`w:${name}`);
  if (direct !== null && direct !== "") return direct;
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i];
    if (a.localName === name && a.prefix !== "xmlns") return a.value;
  }
  return null;
}

const intOf = (s: string | null): number | null => (s !== null && /^-?\d+$/.test(s) ? Number(s) : null);

// ═══════════════════ Đánh số ═══════════════════

function readLevel(el: Element): LevelDef {
  return {
    // Thiếu <w:start> → 0 (theo chuẩn OOXML).
    start: intOf(attr(kid(el, "start"))) ?? 0,
    fmt: attr(kid(el, "numFmt")) ?? "decimal",
    text: attr(kid(el, "lvlText")) ?? "",
    rPr: kid(el, "rPr"),
    pStyle: attr(kid(el, "pStyle")),
  };
}

function readNumbering(xml: string | null) {
  const abstracts = new Map<string, AbstractDef>();
  const nums = new Map<string, NumDef>();
  if (!xml) return { abstracts, nums };
  const root = parseXml(xml).documentElement;
  if (!root) return { abstracts, nums };
  for (const a of kids(root, "abstractNum")) {
    const id = attr(a, "abstractNumId");
    if (id === null) continue;
    const levels = new Map<number, LevelDef>();
    for (const l of kids(a, "lvl")) {
      const ilvl = intOf(attr(l, "ilvl"));
      if (ilvl !== null) levels.set(ilvl, readLevel(l));
    }
    abstracts.set(id, { levels, styleLink: attr(kid(a, "styleLink")), numStyleLink: attr(kid(a, "numStyleLink")) });
  }
  for (const n of kids(root, "num")) {
    const id = attr(n, "numId");
    const abstractId = attr(kid(n, "abstractNumId"));
    if (id === null || abstractId === null) continue;
    const overrides: NumDef["overrides"] = new Map();
    for (const o of kids(n, "lvlOverride")) {
      const ilvl = intOf(attr(o, "ilvl"));
      if (ilvl === null) continue;
      const lvl = kid(o, "lvl");
      overrides.set(ilvl, { start: intOf(attr(kid(o, "startOverride"))), level: lvl ? readLevel(lvl) : null });
    }
    nums.set(id, { abstractId, overrides });
  }
  return { abstracts, nums };
}

/** Kiểu đoạn (styles.xml) có gắn đánh số — VD kiểu "Câu hỏi" tự đánh "Câu 1." */
function readStyles(xml: string | null): Map<string, StyleDef> {
  const styles = new Map<string, StyleDef>();
  if (!xml) return styles;
  const root = parseXml(xml).documentElement;
  if (!root) return styles;
  for (const s of kids(root, "style")) {
    const id = attr(s, "styleId");
    if (id === null) continue;
    const numPr = kid(kid(s, "pPr"), "numPr");
    styles.set(id, { numId: attr(kid(numPr, "numId")), ilvl: intOf(attr(kid(numPr, "ilvl"))), basedOn: attr(kid(s, "basedOn")) });
  }
  return styles;
}

function letters(n: number): string {
  if (n < 1) return "";
  // Word: a…z rồi aa, bb, cc…
  return String.fromCharCode(97 + ((n - 1) % 26)).repeat(Math.floor((n - 1) / 26) + 1);
}

function roman(n: number): string {
  if (n < 1 || n > 3999) return String(n);
  const table: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  let rest = n;
  for (const [value, sign] of table) {
    while (rest >= value) {
      out += sign;
      rest -= value;
    }
  }
  return out;
}

function formatNumber(n: number, fmt: string): string {
  switch (fmt) {
    case "upperLetter":
      return letters(n).toUpperCase();
    case "lowerLetter":
      return letters(n);
    case "upperRoman":
      return roman(n);
    case "lowerRoman":
      return roman(n).toLowerCase();
    case "decimalZero":
      return n >= 0 && n < 10 ? `0${n}` : String(n);
    case "none":
      return "";
    default:
      return String(n);
  }
}

/**
 * Bộ đếm đánh số — mô phỏng Word: các danh sách (w:num) cùng định nghĩa gốc (w:abstractNum) đếm nối tiếp nhau;
 * danh sách có "đánh số lại" (w:startOverride) thì đếm riêng từ số đó; lên cấp trên thì cấp dưới đếm lại từ đầu.
 */
class Numbering {
  private counters = new Map<string, (number | undefined)[]>();

  constructor(
    private abstracts: Map<string, AbstractDef>,
    private nums: Map<string, NumDef>,
  ) {}

  private abstractOf(num: NumDef): AbstractDef | null {
    const a = this.abstracts.get(num.abstractId);
    if (!a) return null;
    // Định nghĩa chỉ trỏ tới "kiểu danh sách" → lấy định nghĩa thật mang kiểu đó.
    if (a.levels.size === 0 && a.numStyleLink) {
      for (const other of this.abstracts.values()) if (other.styleLink === a.numStyleLink && other.levels.size) return other;
    }
    return a;
  }

  private levelDef(num: NumDef, ilvl: number): LevelDef | null {
    return num.overrides.get(ilvl)?.level ?? this.abstractOf(num)?.levels.get(ilvl) ?? null;
  }

  private slot(num: NumDef, numId: string, ilvl: number): (number | undefined)[] {
    const o = num.overrides.get(ilvl);
    const key = o && (o.start !== null || o.level) ? `n${numId}` : `a${num.abstractId}`;
    let arr = this.counters.get(key);
    if (!arr) this.counters.set(key, (arr = []));
    return arr;
  }

  /** Cấp của kiểu đoạn trong danh sách (kiểu gắn đánh số nhưng không ghi cấp). */
  levelOfStyle(numId: string, styleId: string): number {
    const num = this.nums.get(numId);
    const abstract = num ? this.abstractOf(num) : null;
    for (const [ilvl, def] of abstract?.levels ?? []) if (def.pStyle === styleId) return ilvl;
    return 0;
  }

  /** Đếm thêm 1 đoạn của danh sách `numId` cấp `ilvl` → nhãn Word hiển thị (null: gạch đầu dòng / không có nhãn chữ). */
  next(numId: string, ilvl: number): { label: string; rPr: Element | null } | null {
    const num = this.nums.get(numId);
    const level = num ? this.levelDef(num, ilvl) : null;
    if (!num || !level) return null;

    const arr = this.slot(num, numId, ilvl);
    const current = arr[ilvl];
    arr[ilvl] = current === undefined ? (num.overrides.get(ilvl)?.start ?? level.start) : current + 1;
    for (let k = ilvl + 1; k < 9; k++) this.slot(num, numId, k)[k] = undefined;

    if (level.fmt === "bullet") return null;
    const label = level.text.replace(/%([1-9])/g, (_m, d: string) => {
      const k = Number(d) - 1;
      const def = this.levelDef(num, k);
      if (!def) return "";
      const value = this.slot(num, numId, k)[k] ?? num.overrides.get(k)?.start ?? def.start;
      return formatNumber(value, def.fmt);
    });
    // Nhãn chỉ gồm ký hiệu (•, -, ) coi như gạch đầu dòng.
    return /[\p{L}\p{N}]/u.test(label) ? { label, rPr: level.rPr } : null;
  }
}

// ═══════════════════ Màu chữ / tô nền ═══════════════════

function rgbOf(hex: string): [number, number, number] | null {
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

/** Màu chữ "có màu" (đỏ, xanh…) — không tính đen / xám / trắng / tự động. */
function isVivid(hex: string): boolean {
  const c = rgbOf(hex);
  return Boolean(c && Math.max(...c) - Math.min(...c) >= 60);
}

/** "Khóa" định dạng nổi bật của 1 đoạn chữ: màu chữ · highlight · màu nền. "" = chữ thường. */
function markKey(rPr: Element | null): string {
  if (!rPr) return "";
  const parts: string[] = [];
  const color = attr(kid(rPr, "color"));
  if (color && isVivid(color)) parts.push(`c${color.toUpperCase()}`);
  const highlight = attr(kid(rPr, "highlight"));
  if (highlight && highlight !== "none" && highlight !== "white") parts.push(`h${highlight}`);
  const fill = attr(kid(rPr, "shd"), "fill");
  const fillRgb = fill ? rgbOf(fill) : null;
  if (fill && fillRgb && Math.min(...fillRgb) < 235) parts.push(`s${fill.toUpperCase()}`);
  return parts.join("|");
}

// ═══════════════════ Biến đổi document.xml ═══════════════════

/**
 * document.xml → bản đã ghi nhãn đánh số thành chữ + bọc chữ tô màu. `numberingXml` / `stylesXml` có thể null.
 * Xuất riêng để kiểm thử.
 */
export function transformDocumentXml(xml: string, numberingXml: string | null, stylesXml: string | null): string {
  const doc = parseXml(xml);
  const root = doc.documentElement;
  const W = root?.namespaceURI;
  if (!root || !W) return xml;

  const { abstracts, nums } = readNumbering(numberingXml);
  const numbering = new Numbering(abstracts, nums);
  const styles = nums.size ? readStyles(stylesXml) : new Map<string, StyleDef>();
  const styleNumbering = (styleId: string): StyleDef | null => {
    let s = styles.get(styleId);
    for (let depth = 0; s && depth < 10; depth++) {
      if (s.numId !== null) return s;
      s = s.basedOn ? styles.get(s.basedOn) : undefined;
    }
    return null;
  };
  const make = (like: Element, name: string) => doc.createElementNS(W, like.prefix ? `${like.prefix}:${name}` : name);

  // ── 1. Đánh số tự động → chữ thật ──
  if (nums.size) {
    for (const p of Array.from(doc.getElementsByTagNameNS(W, "p"))) {
      const pPr = kid(p, "pPr");
      if (!pPr) continue;
      const numPr = kid(pPr, "numPr");
      const styleId = attr(kid(pPr, "pStyle"));
      let numId = attr(kid(numPr, "numId"));
      let ilvl = intOf(attr(kid(numPr, "ilvl")));
      if (numId === null && styleId) {
        const s = styleNumbering(styleId);
        if (s?.numId) {
          numId = s.numId;
          ilvl ??= s.ilvl ?? numbering.levelOfStyle(s.numId, styleId);
        }
      }
      if (!numId || numId === "0") continue;
      const item = numbering.next(numId, ilvl ?? 0);
      if (!item) continue;

      // Số của danh sách mang định dạng của dấu ngắt đoạn (màu, đậm) + định dạng riêng của cấp đánh số.
      const markRPr = kid(pPr, "rPr");
      const rPr = make(p, "rPr");
      for (const name of ["b", "i", "color", "highlight", "shd"]) {
        const source = kid(item.rPr, name) ?? kid(markRPr, name);
        if (source) rPr.appendChild(source.cloneNode(true));
      }
      const underline = kid(item.rPr, "u");
      if (underline) rPr.appendChild(underline.cloneNode(true));
      const textRun = (text: string, props: Element | null) => {
        const run = make(p, "r");
        if (props?.firstChild) run.appendChild(props);
        const t = make(p, "t");
        t.setAttribute("xml:space", "preserve");
        t.appendChild(doc.createTextNode(text));
        run.appendChild(t);
        return run;
      };
      // Nhãn rồi 1 dấu cách (đoạn riêng, không mang kiểu chữ của nhãn) — chèn ngay sau thuộc tính đoạn.
      const first = pPr.nextSibling;
      p.insertBefore(textRun(item.label, rPr), first);
      p.insertBefore(textRun(" ", null), first);

      // Bỏ đánh số của đoạn (numId = 0) để mammoth coi là đoạn thường, không dựng <ol><li>.
      const target = numPr ?? pPr.appendChild(make(p, "numPr"));
      for (const name of ["ilvl", "numId"]) {
        const el = kid(target, name) ?? target.appendChild(make(p, name));
        el.setAttribute("w:val", "0");
      }
    }
  }

  // ── 2. Chữ tô màu / tô nền → bọc ký tự đánh dấu ──
  for (const r of Array.from(doc.getElementsByTagNameNS(W, "r"))) {
    const key = markKey(kid(r, "rPr"));
    if (!key) continue;
    for (const t of kids(r, "t")) {
      const text = t.textContent ?? "";
      if (!text.trim()) continue;
      while (t.firstChild) t.removeChild(t.firstChild);
      t.appendChild(doc.createTextNode(`${MARK_OPEN}${key}${MARK_SEP}${text}${MARK_CLOSE}`));
    }
  }

  return new XMLSerializer().serializeToString(doc);
}

export type PreparedDocx = { buffer: Buffer; hasMath: boolean; hasImage: boolean };

/** File .docx → file đã chuẩn bị cho mammoth, kèm cờ "có công thức / hình ảnh" (để cảnh báo). */
export async function prepareDocx(buffer: Buffer): Promise<PreparedDocx> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const read = async (name: string) => (await zip.file(name)?.async("string")) ?? null;

  // Phần chính thường là word/document.xml; file lạ thì tra trong _rels/.rels.
  let main = "word/document.xml";
  if (!zip.file(main)) {
    const rels = (await read("_rels/.rels")) ?? "";
    const target = rels.match(/Type="[^"]*\/officeDocument"[^>]*Target="\/?([^"]+)"|Target="\/?([^"]+)"[^>]*Type="[^"]*\/officeDocument"/);
    main = target?.[1] ?? target?.[2] ?? main;
  }
  const xml = await read(main);
  if (xml === null) throw new Error("Không tìm thấy nội dung văn bản trong file .docx");
  const dir = main.includes("/") ? main.slice(0, main.lastIndexOf("/") + 1) : "";

  const flags = {
    hasMath: xml.includes("<m:oMath") || xml.includes("<w:object"),
    hasImage: xml.includes("<w:drawing") || xml.includes("<w:pict"),
  };
  try {
    zip.file(main, transformDocumentXml(xml, await read(`${dir}numbering.xml`), await read(`${dir}styles.xml`)));
  } catch {
    // XML lạ không biến đổi được → đọc file gốc như trước (mất nhãn đánh số tự động / màu, nhưng vẫn ra đề).
    return { buffer, ...flags };
  }
  return { buffer: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }), ...flags };
}
