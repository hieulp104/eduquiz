import { z } from "zod";

/** Thông tin khách tự nhập trước khi làm bài (hộp "nhập thêm thông tin"). */
const takerInfo = {
  fullName: z.string().trim().min(1, "Vui lòng nhập họ và tên.").max(80, "Họ và tên tối đa 80 ký tự."),
  className: z.string().trim().max(30, "Tên lớp tối đa 30 ký tự.").optional(),
  number: z.string().trim().max(10, "STT tối đa 10 ký tự.").optional(),
};

export const startSubmissionSchema = z.object({
  assignmentId: z.string().min(1),
  /** Mật khẩu đề thi (nếu giáo viên đặt). */
  password: z.string().max(50).optional(),
  /** Chỉ dùng với tài khoản ẩn danh. */
  fullName: takerInfo.fullName.optional(),
  className: takerInfo.className,
  number: takerInfo.number,
});

/** Khách chưa đăng nhập bắt đầu làm bài qua link /thi/<mã>. */
export const startGuestSchema = z.object({
  code: z.string().trim().min(1).max(20),
  password: z.string().max(50).optional(),
  ...takerInfo,
});

export const submissionCommentSchema = z.object({
  submissionId: z.string().min(1),
  comment: z.string().trim().max(500, "Nhận xét tối đa 500 ký tự."),
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
