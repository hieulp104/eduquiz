/**
 * Định dạng chữ trong câu hỏi / nhóm câu: chỉ 3 thẻ <b> đậm · <i> nghiêng · <u> gạch chân.
 * Lưu thẳng trong chuỗi nội dung (VD "miss<u>es</u>"). Mọi chuỗi "<…>" khác là chữ thường.
 *
 * Hiển thị KHÔNG dùng dangerouslySetInnerHTML: tách thành các đoạn (run) rồi render bằng React
 * (components/ui/data-display/rich-inline.tsx) — nên không có đường nào chèn HTML lạ vào trang.
 * Client-safe: không import gì phía server.
 */

export type Style = { b: boolean; i: boolean; u: boolean };
export type Run = Style & { text: string };

const TAG_RE = /<(\/?)([biu])>/gi;
const KEYS = ["b", "i", "u"] as const;

/** Chuỗi có thẻ → các đoạn chữ kèm kiểu. Thẻ đóng thiếu / thừa được bỏ qua êm. */
export function toRuns(s: string): Run[] {
  const runs: Run[] = [];
  const depth = { b: 0, i: 0, u: 0 };
  let last = 0;
  const push = (text: string) => {
    if (text) runs.push({ text, b: depth.b > 0, i: depth.i > 0, u: depth.u > 0 });
  };
  for (const m of s.matchAll(TAG_RE)) {
    push(s.slice(last, m.index));
    const k = m[2].toLowerCase() as keyof Style;
    depth[k] = m[1] ? Math.max(0, depth[k] - 1) : depth[k] + 1;
    last = m.index + m[0].length;
  }
  push(s.slice(last));
  return runs;
}

export const plainOf = (runs: Run[]) => runs.map((r) => r.text).join("");

/** Bỏ thẻ, chỉ giữ chữ. */
export const stripTags = (s: string) => s.replace(TAG_RE, "");

/** Cắt theo vị trí trên chữ thuần [start, end). */
export function sliceRuns(runs: Run[], start: number, end = Infinity): Run[] {
  const out: Run[] = [];
  let pos = 0;
  for (const r of runs) {
    const a = Math.max(start, pos);
    const b = Math.min(end, pos + r.text.length);
    if (b > a) out.push({ ...r, text: r.text.slice(a - pos, b - pos) });
    pos += r.text.length;
  }
  return out;
}

const sameStyle = (x: Style, y: Style) => x.b === y.b && x.i === y.i && x.u === y.u;

/**
 * Đoạn → chuỗi có thẻ, dạng gọn: gộp đoạn cùng kiểu, khoảng trắng đứng riêng chỉ giữ kiểu chung
 * của 2 bên (tránh "<b>a</b><b> </b><b>c</b>"), lồng thẻ theo thứ tự b › i › u.
 */
export function fromRuns(input: Run[]): string {
  const runs = input.filter((r) => r.text);
  const norm: Run[] = runs.map((r, idx) => {
    if (r.text.trim()) return r;
    const prev = runs[idx - 1];
    const next = runs[idx + 1];
    const keep = (k: keyof Style) => Boolean(prev?.[k] && next?.[k]);
    return { text: r.text, b: keep("b"), i: keep("i"), u: keep("u") };
  });
  const merged: Run[] = [];
  for (const r of norm) {
    const last = merged.at(-1);
    if (last && sameStyle(last, r)) last.text += r.text;
    else merged.push({ ...r });
  }

  let out = "";
  const open: (keyof Style)[] = [];
  for (const r of merged) {
    // Giữ phần đầu ngăn xếp vẫn còn hiệu lực, đóng phần còn lại.
    let keep = 0;
    while (keep < open.length && r[open[keep]]) keep++;
    while (open.length > keep) out += `</${open.pop()}>`;
    for (const k of KEYS) {
      if (r[k] && !open.includes(k)) {
        out += `<${k}>`;
        open.push(k);
      }
    }
    out += r.text;
  }
  while (open.length) out += `</${open.pop()}>`;
  return out;
}

/** Bỏ khoảng trắng đầu/cuối (tính trên chữ thuần), giữ định dạng. */
export function trimRuns(runs: Run[]): Run[] {
  const plain = plainOf(runs);
  const start = plain.length - plain.trimStart().length;
  const end = plain.trimEnd().length;
  return end > start ? sliceRuns(runs, start, end) : [];
}

/** Chuẩn hóa 1 dòng: cân bằng thẻ, gộp thẻ thừa, cắt khoảng trắng 2 đầu. */
export const normalizeInline = (s: string) => fromRuns(trimRuns(toRuns(s)));
