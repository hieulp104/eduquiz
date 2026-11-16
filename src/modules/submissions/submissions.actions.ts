"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { getCurrentUser, requireUser, signIn } from "@/modules/auth/auth.service";
import { createGuestUser, getTakerProfile, renameGuest, signGuestTicket } from "@/modules/auth/guest";
import { findOpenAssignmentByCode } from "@/modules/publish/publish.service";
import { classSharedWith } from "@/modules/teachers/class-sharing.service";
import { can } from "@/common/permissions/permissions";
import { assignmentStatus } from "@/common/enums";
import { fail, ok, type ActionResult } from "@/common/filters/error";
import { getVisibleAssignment } from "@/modules/assignments/assignments.service";
import { takeSettings } from "@/modules/publish/publish.types";
import {
  practiceAnswerSchema,
  startGuestSchema,
  startSubmissionSchema,
  submissionCommentSchema,
  submitAnswersSchema,
} from "@/modules/submissions/submissions.schema";
import {
  addLeave,
  answerPracticeQuestion,
  canTakeAssignment,
  getSubmissionContext,
  getSubmissionOwnerInfo,
  gradeAndSubmit,
  setSubmissionComment,
  startSubmission,
  submissionDeadline,
} from "@/modules/submissions/submissions.service";

export async function startSubmissionAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  if (!can(user, "submission.take")) return fail("PERMISSION_DENIED");

  const parsed = startSubmissionSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");

  const assignment = await getVisibleAssignment(user, parsed.data.assignmentId);
  if (!assignment) return fail("NOT_FOUND");
  if (!(await canTakeAssignment(user.id, assignment))) {
    return fail("PERMISSION_DENIED", "Bạn không thuộc đối tượng được làm đề này.");
  }
  if (assignmentStatus(assignment) !== "OPEN") {
    return fail("CONFLICT", "Bài này chưa mở hoặc đã hết hạn.");
  }
  const settings = takeSettings(assignment, assignment.exam.onlineConfig);
  if (settings.password && parsed.data.password !== settings.password) {
    return fail("PERMISSION_DENIED", "Mật khẩu đề thi không đúng.");
  }

  // Tài khoản ẩn danh: họ tên nhập ở hộp thông tin thành tên tài khoản; lớp / STT ghi theo lượt làm.
  const { isGuest } = await getTakerProfile(user.id);
  if (isGuest && !parsed.data.fullName) return fail("VALIDATION_ERROR", "Vui lòng nhập họ và tên.");

  const submission = await startSubmission(
    assignment.id,
    assignment.exam.id,
    user.id,
    settings.maxAttempts,
    isGuest ? { className: parsed.data.className, number: parsed.data.number } : {},
  );
  if (!submission) return fail("CONFLICT", "Bạn đã hết lượt làm đề này.");
  if (isGuest) await renameGuest(user.id, parsed.data.fullName!);
  redirect(`/lam-bai/${assignment.id}`);
}

/**
 * Khách CHƯA đăng nhập bắt đầu làm bài qua link /thi/<mã>: tạo tài khoản ẩn danh mang họ tên vừa nhập,
 * mở lượt làm rồi đăng nhập luôn bằng tài khoản đó — điểm thuộc về tài khoản này.
 * Không có requireUser(): quyền ở đây là "đề đã xuất bản cho tất cả mọi người" (findOpenAssignmentByCode).
 */
export async function startGuestAction(input: unknown): Promise<ActionResult<null>> {
  if (await getCurrentUser()) {
    return fail("CONFLICT", "Bạn đã đăng nhập — tải lại trang để làm bài bằng tài khoản của mình.");
  }

  const parsed = startGuestSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);

  const assignment = await findOpenAssignmentByCode(parsed.data.code);
  if (!assignment) return fail("NOT_FOUND", "Đề này không còn nhận bài làm qua link.");
  if (assignmentStatus(assignment) !== "OPEN") return fail("CONFLICT", "Bài này chưa mở hoặc đã hết hạn.");
  const settings = takeSettings(assignment, assignment.exam.onlineConfig);
  if (settings.password && parsed.data.password !== settings.password) {
    return fail("PERMISSION_DENIED", "Mật khẩu đề thi không đúng.");
  }

  const guest = await createGuestUser(parsed.data.fullName);
  await startSubmission(assignment.id, assignment.exam.id, guest.id, settings.maxAttempts, {
    className: parsed.data.className,
    number: parsed.data.number,
  });
  try {
    // Thành công thì signIn ném redirect sang trang làm bài.
    await signIn("guest", { ticket: signGuestTicket(guest.id), redirectTo: `/lam-bai/${assignment.id}` });
  } catch (error) {
    if (error instanceof AuthError) return fail("INTERNAL_ERROR", "Không mở được phiên làm bài, vui lòng thử lại.");
    throw error;
  }
  return ok(null);
}

/** Giáo viên ghi nhận xét cho một bài làm (thẻ ở danh sách đã thi). */
export async function saveSubmissionCommentAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  const parsed = submissionCommentSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);

  const submission = await getSubmissionOwnerInfo(parsed.data.submissionId);
  if (!submission) return fail("NOT_FOUND");
  const { classroom, exam, examId } = submission.assignment;
  const allowed = can(user, "assignment.result.view", {
    ownerId: classroom?.teacherId ?? exam.teacherId,
    sharedWith: classroom ? (await classSharedWith([classroom.id])).get(classroom.id) : undefined,
  });
  if (!allowed) return fail("PERMISSION_DENIED");

  await setSubmissionComment(submission.id, parsed.data.comment);
  revalidatePath(`/de-thi/${examId}`);
  revalidatePath(`/ket-qua/${submission.id}`);
  return ok(null);
}

export async function submitAnswersAction(
  input: unknown,
): Promise<ActionResult<{ submissionId: string }>> {
  const user = await requireUser();
  const parsed = submitAnswersSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");

  const submission = await getSubmissionContext(parsed.data.submissionId);
  if (!submission) return fail("NOT_FOUND");
  if (!can(user, "submission.take", { ownerId: submission.studentId })) {
    return fail("PERMISSION_DENIED");
  }

  // false = đã nộp trước đó (bấm 2 lần / hết giờ tự nộp) — vẫn cho xem kết quả.
  await gradeAndSubmit(submission.id, parsed.data.answers);
  return ok({ submissionId: submission.id });
}

/** Luyện tập: trả lời 1 câu → biết đúng/sai và đáp án đúng ngay. CHỈ chạy với đề ở chế độ Luyện tập. */
export async function answerPracticeAction(
  input: unknown,
): Promise<ActionResult<{ isCorrect: boolean; correctOptionId: string }>> {
  const user = await requireUser();
  const parsed = practiceAnswerSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");

  const submission = await getSubmissionContext(parsed.data.submissionId);
  if (!submission) return fail("NOT_FOUND");
  if (!can(user, "submission.take", { ownerId: submission.studentId })) return fail("PERMISSION_DENIED");
  // Chặn dùng action này để dò đáp án của đề kiểm tra.
  const settings = takeSettings(submission.assignment, submission.assignment.exam.onlineConfig);
  if (settings.mode !== "PRACTICE") return fail("PERMISSION_DENIED");
  if (submission.submittedAt) return fail("CONFLICT", "Lượt luyện tập này đã kết thúc.");
  const deadline = submissionDeadline(submission.startedAt, submission.assignment.exam.durationMinutes, submission.assignment.dueAt);
  if (Date.now() > deadline.getTime()) return fail("CONFLICT", "Đã hết thời gian làm bài.");

  const result = await answerPracticeQuestion(
    submission.id,
    submission.assignment.exam.id,
    parsed.data.questionId,
    parsed.data.optionId,
  );
  if (!result) return fail("CONFLICT", "Câu này đã được trả lời.");
  return ok(result);
}

/** Giám sát thoát màn hình: trình duyệt báo mỗi lần học sinh rời trang làm bài. */
export async function reportLeaveAction(submissionId: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  if (typeof submissionId !== "string" || !submissionId) return fail("VALIDATION_ERROR");

  const submission = await getSubmissionContext(submissionId);
  if (!submission) return fail("NOT_FOUND");
  if (!can(user, "submission.take", { ownerId: submission.studentId })) return fail("PERMISSION_DENIED");

  await addLeave(submission.id);
  return ok(null);
}
