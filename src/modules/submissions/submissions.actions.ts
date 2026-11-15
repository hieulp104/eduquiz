"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { assignmentStatus } from "@/common/enums";
import { fail, ok, type ActionResult } from "@/common/filters/error";
import { getVisibleAssignment } from "@/modules/assignments/assignments.service";
import { takeSettings } from "@/modules/publish/publish.types";
import {
  practiceAnswerSchema,
  startSubmissionSchema,
  submitAnswersSchema,
} from "@/modules/submissions/submissions.schema";
import {
  addLeave,
  answerPracticeQuestion,
  canTakeAssignment,
  getSubmissionContext,
  gradeAndSubmit,
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

  const submission = await startSubmission(assignment.id, assignment.exam.id, user.id, settings.maxAttempts);
  if (!submission) return fail("CONFLICT", "Bạn đã hết lượt làm đề này.");
  redirect(`/lam-bai/${assignment.id}`);
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
