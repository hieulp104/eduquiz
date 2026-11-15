import { z } from "zod";

const id = z.string().min(1).max(40);
const level = z.enum(["NB", "TH", "VD"]).nullable();

const bankFields = {
  name: z.string().trim().min(1, "Vui lòng nhập tên!").max(150, "Tên tối đa 150 ký tự"),
  grade: z.number().int().min(0).max(12).nullable(),
  subject: z
    .string()
    .trim()
    .max(100)
    .transform((v) => v || null),
  bookId: id.nullable(),
};

export const createBankSchema = z.object(bankFields);
export const updateBankSchema = z.object({ id, ...bankFields });
export const bankIdSchema = z.object({ id });

/** "Thêm cấu trúc": mỗi dòng 1 chương / bài, cùng cấp (con của parentId). */
export const addSectionsSchema = z.object({
  bankId: id,
  parentId: id.nullable(),
  titles: z
    .string()
    .transform((v) => v.split("\n").map((l) => l.trim()).filter(Boolean))
    .pipe(z.array(z.string().max(200, "Tên tối đa 200 ký tự")).min(1, "Vui lòng nhập tên").max(100, "Mỗi lần thêm tối đa 100 mục")),
});

export const renameSectionSchema = z.object({ id, title: z.string().trim().min(1, "Vui lòng nhập tên").max(200) });
export const moveSectionSchema = z.object({ id, direction: z.enum(["up", "down"]) });

const itemSchema = z
  .object({
    content: z.string().trim().max(5000),
    options: z.array(z.string().trim().min(1, "Đáp án không được để trống").max(1000)).min(2, "Mỗi câu cần ít nhất 2 đáp án").max(8),
    correctIndex: z.number().int().min(0),
    level,
  })
  .refine((q) => q.correctIndex < q.options.length, { message: "Câu chưa có đáp án đúng" })
  .refine((q) => q.content.length > 0, { message: "Câu hỏi không được để trống nội dung" });

/** "Nhập câu hỏi": câu đã đọc ở client (bộ đọc đề) → lưu vào 1 bài. */
export const importItemsSchema = z.object({
  bankId: id,
  sectionId: id.nullable(),
  items: z.array(itemSchema).min(1, "Chưa có câu hỏi nào").max(500, "Mỗi lần nhập tối đa 500 câu"),
});

export const updateItemSchema = z.object({ id, level: level.optional(), sectionId: id.nullable().optional() });
export const deleteItemsSchema = z.object({ bankId: id, ids: z.array(id).min(1).max(1000) });

const examFields = {
  title: z.string().trim().min(1, "Vui lòng nhập tên đề").max(200),
  durationMinutes: z.number().int().min(1, "Thời gian tối thiểu 1 phút").max(300),
};

/** "Tự chọn câu hỏi" → đề thi (giữ thứ tự chọn). */
export const examFromItemsSchema = z.object({ bankId: id, itemIds: z.array(id).min(1, "Chưa chọn câu nào").max(200, "Đề tối đa 200 câu"), ...examFields });

/** "Tạo ma trận đề thi": số câu cần bốc theo (bài, mức độ). sectionId null = chưa xếp bài. */
export const examFromMatrixSchema = z.object({
  bankId: id,
  rows: z
    .array(z.object({ sectionId: id.nullable(), level: z.enum(["NB", "TH", "VD", "NONE"]), count: z.number().int().min(1).max(200) }))
    .min(1, "Ma trận chưa có câu nào")
    .max(500),
  ...examFields,
});
