import { z } from "zod";
import { MAX_WORKSHEET_QUESTIONS } from "@/modules/worksheet/worksheet.types";

export const pickQuestionSchema = z.object({
  nodeId: z.string().min(1),
  excludeIds: z.array(z.string()).max(MAX_WORKSHEET_QUESTIONS),
});

export const worksheetToExamSchema = z.object({
  title: z.string().trim().min(1, "Vui lòng nhập tên phiếu bài tập").max(200),
  questionIds: z
    .array(z.string().min(1))
    .min(1, "Phiếu chưa có câu hỏi")
    .max(MAX_WORKSHEET_QUESTIONS),
  durationMinutes: z.number().int().min(1).max(300),
});
