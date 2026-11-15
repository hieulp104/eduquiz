import { z } from "zod";

const id = z.string().min(1).max(40);

/** Link video: chỉ http(s), lưu link — không tải video lên hệ thống. */
const videoUrl = z
  .string()
  .trim()
  .max(500, "Link quá dài")
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "Link không hợp lệ — dán đầy đủ, VD https://www.youtube.com/watch?v=…");

const common = {
  title: z.string().trim().min(1, "Vui lòng nhập tên").max(200, "Tên tối đa 200 ký tự"),
  description: z
    .string()
    .trim()
    .max(2000, "Mô tả tối đa 2000 ký tự")
    .transform((v) => v || null),
  grade: z.number().int().min(0).max(12).nullable(),
  subject: z
    .string()
    .trim()
    .max(100)
    .transform((v) => v || null),
};

/** "Đóng góp nội dung": đề có sẵn · file đã tải lên (POST /api/files) · link video. */
export const createContentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("EXAM"), examId: id, ...common }),
  z.object({ kind: z.enum(["REFERENCE", "SLIDE", "LESSON_PLAN"]), fileId: id, ...common }),
  z.object({ kind: z.literal("VIDEO"), url: videoUrl, ...common }),
]);

export type CreateContentInput = z.infer<typeof createContentSchema>;

export const contentIdSchema = z.object({ id });
