/** Tùy chọn "In đề + phiếu trả lời" — client-safe (không import docx / prisma). Có test trong verify-publish. */
import { z } from "zod";
import { orderForTaking } from "@/modules/submissions/exam-order";

export const MAX_VERSIONS = 24;

export const SHEETS = [
  { value: "BUBBLE", label: "Phiếu tô ô tròn - A4", hint: "Mỗi câu một hàng ô tròn A, B, C, D — học sinh tô kín ô chọn." },
  { value: "LETTER", label: "Phiếu ghi chữ cái - A4", hint: "Bảng ô trống theo số câu — học sinh ghi chữ cái đáp án vào ô." },
  { value: "NONE", label: "Không in phiếu", hint: "Học sinh khoanh trực tiếp trên đề." },
] as const;

export type SheetKind = (typeof SHEETS)[number]["value"];

/** Mã đề mặc định: 101, 102, … */
export const defaultCodes = (count: number) => Array.from({ length: count }, (_, i) => String(101 + i));

/** "101, 102 ; 203" → ["101","102","203"] */
export const parseCodes = (text: string) =>
  text
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

export const printOptionsSchema = z
  .object({
    count: z.number({ error: "Nhập số lượng đề đảo" }).int().min(1, "Cần ít nhất 1 đề").max(MAX_VERSIONS, `Tối đa ${MAX_VERSIONS} đề đảo`),
    /** Rỗng = dùng mã mặc định 101, 102, … */
    codes: z.array(z.string().regex(/^[A-Za-z0-9]{1,6}$/, "Mã đề chỉ gồm chữ / số, tối đa 6 ký tự")).max(MAX_VERSIONS),
    shuffleQuestions: z.boolean(),
    shuffleOptions: z.boolean(),
    sheet: z.enum(["BUBBLE", "LETTER", "NONE"]),
    /** Kèm trang đáp án của mọi mã đề ở cuối file. */
    includeKey: z.boolean(),
    school: z.string().trim().max(120),
    examName: z.string().trim().max(120),
  })
  .superRefine((v, ctx) => {
    if (v.codes.length === 0) return;
    if (v.codes.length !== v.count) {
      ctx.addIssue({ code: "custom", message: `Cần nhập đúng ${v.count} mã đề (đang có ${v.codes.length})`, path: ["codes"] });
    } else if (new Set(v.codes.map((c) => c.toUpperCase())).size !== v.codes.length) {
      ctx.addIssue({ code: "custom", message: "Mã đề bị trùng", path: ["codes"] });
    }
  });

export type PrintOptions = z.infer<typeof printOptionsSchema>;

type PrintQuestion<O> = {
  id: string;
  fixedOptions: boolean;
  group: { id: string; fixedOrder: boolean } | null;
  options: O[];
};

const LETTERS = "ABCDEFGH";

/**
 * Các mã đề để in: mỗi mã một thứ tự câu / đáp án riêng, CỐ ĐỊNH theo (đề, mã đề) — in lại vẫn ra đúng đề cũ.
 * Nhóm câu đi liền khối và giữ vị trí; nhóm "cố định" / câu "cố định đáp án" không đảo (xem exam-order.ts).
 * `key[i]` = chữ cái đáp án đúng của câu thứ i trong mã đề đó.
 */
export function buildVersions<O extends { isCorrect: boolean }, Q extends PrintQuestion<O>>(
  examId: string,
  questions: Q[],
  opts: Pick<PrintOptions, "count" | "codes" | "shuffleQuestions" | "shuffleOptions">,
): { code: string; questions: Q[]; key: string[] }[] {
  const codes = opts.codes.length ? opts.codes : defaultCodes(opts.count);
  return codes.map((code) => {
    const ordered = orderForTaking<O, Q>(questions, `${examId}:${code.toUpperCase()}`, {
      shuffleQuestions: opts.shuffleQuestions,
      shuffleOptions: opts.shuffleOptions,
      shuffleGroups: false,
    });
    return { code, questions: ordered, key: ordered.map((q) => LETTERS[q.options.findIndex((o) => o.isCorrect)] ?? "?") };
  });
}
