import { z } from "zod";
import { EXAM_PURPOSES } from "@/common/enums";
import { checkPricing, pricingShape } from "@/modules/publish/publish.schema";

const optionSchema = z.object({
  content: z.string().trim().min(1, "Đáp án không được để trống").max(1000),
  isCorrect: z.boolean(),
});

const questionSchema = z
  .object({
    /** Được để trống khi câu thuộc nhóm (VD câu phát âm: chỉ có 4 phương án). */
    content: z.string().trim().max(5000),
    points: z.number().positive("Điểm phải lớn hơn 0").max(100),
    /** Vị trí trong `groups` (null = câu đứng riêng). */
    groupIndex: z.number().int().min(0).nullable().optional(),
    level: z.enum(["RECOGNITION", "COMPREHENSION", "APPLICATION"]).nullable().optional(),
    fixedOptions: z.boolean().optional(),
    audioFileId: z.string().min(1).max(40).nullable().optional(),
    options: z.array(optionSchema).min(2, "Mỗi câu cần ít nhất 2 đáp án").max(8),
  })
  .refine((q) => q.options.filter((o) => o.isCorrect).length === 1, {
    message: "Mỗi câu phải có đúng 1 đáp án đúng",
    path: ["options"],
  });

/** Thông tin chung của đề (bước "Cấu hình chung" / trang Cài đặt). */
const examSettingsObject = z.object({
  title: z.string().trim().min(1, "Vui lòng nhập tên đề").max(200),
  description: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => v || null),
  durationMinutes: z.number().int().min(1, "Thời gian tối thiểu 1 phút").max(300),
  grade: z.number().int().min(0).max(12).nullable().optional(),
  subject: z.string().trim().max(100).nullable().optional(),
  purpose: z.enum(EXAM_PURPOSES).nullable().optional(),
  ...pricingShape,
});

export const examSettingsSchema = examSettingsObject.superRefine(checkPricing);

const examObject = examSettingsObject.extend({
  /** Lời dẫn / đoạn văn chung cho nhiều câu. */
  groups: z
    .array(
      z.object({
        /** Được để trống khi nhóm chỉ có file nghe. */
        content: z.string().trim().max(20000),
        fixedOrder: z.boolean().optional(),
        audioFileId: z.string().min(1).max(40).nullable().optional(),
      }),
    )
    .max(200)
    .default([]),
  questions: z.array(questionSchema).min(1, "Đề cần ít nhất 1 câu hỏi").max(200),
  /** Thư mục chứa đề khi tạo mới (null = gốc). Khi sửa đề thì bỏ qua. */
  folderId: z.string().min(1).nullable().optional(),
});

function checkQuestions(
  exam: {
    groups: { content: string }[];
    questions: { content: string; groupIndex?: number | null }[];
    priceMode: string;
    price: number;
  },
  ctx: z.RefinementCtx,
) {
  exam.questions.forEach((q, i) => {
    const gi = q.groupIndex ?? null;
    if (gi !== null && gi >= exam.groups.length) {
      ctx.addIssue({ code: "custom", message: `Câu ${i + 1}: nhóm câu hỏi không hợp lệ`, path: ["questions", i] });
    } else if (gi === null && !q.content) {
      ctx.addIssue({ code: "custom", message: `Câu ${i + 1}: chưa có nội dung câu hỏi`, path: ["questions", i] });
    }
  });
  checkPricing(exam, ctx);
}

export const examSchema = examObject.superRefine(checkQuestions);

export type ExamInput = z.infer<typeof examSchema>;
export type ExamSettingsInput = z.infer<typeof examSettingsSchema>;

export const updateExamSchema = examObject.extend({ id: z.string().min(1) }).superRefine(checkQuestions);
export const updateExamSettingsSchema = examSettingsObject.extend({ id: z.string().min(1) }).superRefine(checkPricing);

/** Phân tích cấu trúc đề: gán mức độ cho từng câu (questionId → mức độ, null = bỏ gán). */
export const questionLevelsSchema = z.object({
  examId: z.string().min(1),
  levels: z.record(z.string().min(1), z.enum(["RECOGNITION", "COMPREHENSION", "APPLICATION"]).nullable()),
});
