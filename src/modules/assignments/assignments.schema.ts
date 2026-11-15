import { z } from "zod";
import { parseVnDateTimeLocal } from "@/lib/utils";

const vnDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Thời gian không hợp lệ")
  .transform(parseVnDateTimeLocal);

export const createAssignmentSchema = z
  .object({
    classId: z.string().min(1),
    examId: z.string().min(1, "Vui lòng chọn đề"),
    openAt: vnDateTime,
    dueAt: vnDateTime,
    showAnswer: z.boolean(),
  })
  .refine((v) => v.dueAt > v.openAt, {
    message: "Hạn nộp phải sau thời điểm mở đề",
    path: ["dueAt"],
  });

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
