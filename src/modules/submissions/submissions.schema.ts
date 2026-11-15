import { z } from "zod";

export const startSubmissionSchema = z.object({
  assignmentId: z.string().min(1),
  /** Mật khẩu đề thi (nếu giáo viên đặt). */
  password: z.string().max(50).optional(),
});

export const submitAnswersSchema = z.object({
  submissionId: z.string().min(1),
  /** questionId → optionId. Câu bỏ trống thì không có trong object. */
  answers: z.record(z.string(), z.string()),
});

export const practiceAnswerSchema = z.object({
  submissionId: z.string().min(1),
  questionId: z.string().min(1),
  optionId: z.string().min(1),
});

export type SubmitAnswersInput = z.infer<typeof submitAnswersSchema>;
