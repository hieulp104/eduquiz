import { z } from "zod";

/** Chuẩn hóa SĐT: bỏ khoảng trắng/dấu chấm, +84 → 0. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s.\-()]/g, "");
  return digits.startsWith("+84") ? `0${digits.slice(3)}` : digits;
}

/**
 * Tên đăng nhập là email, số điện thoại HOẶC username.
 * Có "@" → email · toàn chữ số (sau chuẩn hóa) → SĐT · còn lại → username.
 */
export const loginIdSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập số điện thoại, email hoặc username")
  .transform((v) => {
    if (v.includes("@")) return { kind: "email", value: v.toLowerCase() } as const;
    const phone = normalizePhone(v);
    if (/^\d+$/.test(phone)) return { kind: "phone", value: phone } as const;
    return { kind: "username", value: v.toLowerCase() } as const;
  });

export type LoginId = z.infer<typeof loginIdSchema>;

export const loginSchema = z.object({
  login: loginIdSchema,
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

export type LoginInput = z.infer<typeof loginSchema>;
