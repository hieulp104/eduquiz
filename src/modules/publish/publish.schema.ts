import { z } from "zod";
import { EXAM_PURPOSES } from "@/common/enums";
import { parseVnDateTimeLocal } from "@/lib/utils";

/** Ô datetime-local theo giờ VN; "" = bỏ trống (không giới hạn). */
const optionalVnDateTime = z
  .string()
  .regex(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})?$/, "Thời gian không hợp lệ")
  .transform((v) => (v ? parseVnDateTimeLocal(v) : null));

export const PRICE_MODES = ["FREE", "PAID_ENTRY", "PAID_EXPLANATION"] as const;

/** Cấu hình giá — dùng ở cả bước "Cấu hình chung" và trang cài đặt online. */
export const pricingShape = {
  priceMode: z.enum(PRICE_MODES).default("FREE"),
  price: z.number().int("Giá tiền phải là số nguyên").min(0).max(100_000_000, "Giá tiền quá lớn").default(0),
  priceNote: z.string().max(20_000).default(""),
};

export function checkPricing(v: { priceMode: string; price: number }, ctx: z.RefinementCtx) {
  if (v.priceMode !== "FREE" && v.price < 1000) {
    ctx.addIssue({ code: "custom", message: "Nhập giá tiền từ 1.000 đ trở lên", path: ["price"] });
  }
}

export const onlineSettingsSchema = z
  .object({
    examId: z.string().min(1),
    /** true = Xuất bản (tạo / cập nhật bài giao), false = Lưu nháp. */
    publish: z.boolean(),

    title: z.string().trim().min(1, "Vui lòng nhập tên đề").max(200),
    grade: z.number().int().min(0).max(12).nullable(),
    subject: z.string().trim().max(100).nullable(),
    purpose: z.enum(EXAM_PURPOSES).nullable(),
    durationMinutes: z.number({ error: "Nhập thời gian làm bài (phút)" }).int().min(1, "Thời gian làm bài tối thiểu 1 phút").max(300, "Thời gian làm bài tối đa 300 phút"),

    mode: z.enum(["EXAM", "PRACTICE"]),
    openAt: optionalVnDateTime,
    dueAt: optionalVnDateTime,
    audience: z.enum(["ALL", "CLASSES", "STUDENTS"]),
    classIds: z.array(z.string().min(1)).max(50),
    studentIds: z.array(z.string().min(1)).max(1000),
    labMode: z.boolean(),

    maxAttempts: z.number({ error: "Nhập số lượt làm (0 = không giới hạn)" }).int("Số lượt làm phải là số nguyên").min(0, "Số lượt làm không hợp lệ").max(100, "Số lượt làm tối đa 100"),
    password: z.string().trim().max(50),
    monitorLeave: z.boolean(),

    shuffle: z.boolean(),
    shuffleGroups: z.boolean(),
    hideGroupTitles: z.boolean(),

    showScore: z.enum(["NEVER", "AFTER_SUBMIT", "AFTER_CLOSE"]),
    showAnswers: z.enum(["NEVER", "AFTER_SUBMIT", "AFTER_CLOSE", "MIN_SCORE"]),
    minScoreForAnswers: z.number().min(0).max(10).nullable(),
    hideWrongAnswers: z.boolean(),
    retryWrong: z.boolean(),

    headerNote: z.string().trim().max(300),
    preNotice: z.string().trim().max(2000),
    ...pricingShape,
  })
  .superRefine((v, ctx) => {
    checkPricing(v, ctx);
    if (v.mode === "EXAM" && v.openAt && v.dueAt && v.dueAt <= v.openAt) {
      ctx.addIssue({ code: "custom", message: "Thời gian kết thúc phải sau thời gian bắt đầu", path: ["dueAt"] });
    }
    if (v.mode === "EXAM" && v.showAnswers === "MIN_SCORE" && v.minScoreForAnswers === null) {
      ctx.addIssue({ code: "custom", message: "Nhập số điểm cần đạt để xem đáp án", path: ["minScoreForAnswers"] });
    }
    if (v.publish && v.audience === "CLASSES" && v.classIds.length === 0) {
      ctx.addIssue({ code: "custom", message: "Chọn ít nhất 1 lớp để giao đề", path: ["classIds"] });
    }
    if (v.publish && v.audience === "STUDENTS" && v.studentIds.length === 0) {
      ctx.addIssue({ code: "custom", message: "Chọn ít nhất 1 học sinh để giao đề", path: ["studentIds"] });
    }
  });

export type OnlineSettingsInput = z.infer<typeof onlineSettingsSchema>;
