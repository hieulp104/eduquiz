import { z } from "zod";
import { parseVnDateTimeLocal } from "@/lib/utils";
import { SUBJECTS } from "@/common/enums";
import { MAX_FILES_PER_HOMEWORK } from "@/modules/files/files.constants";

const PURPOSES = ["HOMEWORK", "PRACTICE", "REVIEW", "QUIZ_15", "TEST_45", "SEMESTER_EXAM", "OTHER"] as const;

/** "" → null; "2026-11-07T08:00" (giờ VN) → Date UTC. */
const optionalVnDateTime = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), "Thời gian không hợp lệ")
  .transform((v) => (v ? parseVnDateTimeLocal(v) : null));

export const createHomeworkSchema = z
  .object({
    title: z.string().trim().min(1, "Vui lòng nhập tên bài tập").max(200, "Tên tối đa 200 ký tự"),
    grade: z.number().int().min(1).max(12),
    subject: z.enum(SUBJECTS, { message: "Vui lòng chọn môn học" }),
    purpose: z.enum(PURPOSES, { message: "Vui lòng chọn mục đích tạo đề" }),
    startAt: optionalVnDateTime,
    dueAt: optionalVnDateTime,
    /** HTML thô từ trình soạn thảo — service lọc lại trước khi lưu. */
    contentHtml: z.string().max(200_000, "Nội dung quá dài"),
    showResult: z.boolean(),
    requireLogin: z.boolean(),
    classIds: z.array(z.string().min(1)).min(1, "Vui lòng chọn lớp").max(200),
    fileIds: z.array(z.string().min(1)).max(MAX_FILES_PER_HOMEWORK, `Tối đa ${MAX_FILES_PER_HOMEWORK} file`),
  })
  .refine((v) => !v.startAt || !v.dueAt || v.dueAt > v.startAt, {
    message: "Thời gian kết thúc phải sau thời gian bắt đầu",
    path: ["dueAt"],
  });

export type CreateHomeworkInput = z.infer<typeof createHomeworkSchema>;
