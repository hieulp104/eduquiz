"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { fail, ok, type ActionResult } from "@/common/filters/error";
import { examSchema, questionLevelsSchema, updateExamSchema, updateExamSettingsSchema } from "@/modules/exams/exams.schema";
import {
  createExam,
  getExamOwner,
  replaceExam,
  softDeleteExam,
  updateExamSettings,
  updateQuestionLevels,
} from "@/modules/exams/exams.service";
import { findFolder } from "@/modules/exams/exam-library.service";
import { invalidAudioIds } from "@/modules/files/files.service";
import type { ExamInput } from "@/modules/exams/exams.schema";

function firstIssue(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Dữ liệu không hợp lệ";
}

/** File nghe trong đề phải là file âm thanh của chính người soạn (hoặc đã có sẵn trong đề đang sửa). */
async function checkAudio(userId: string, exam: Pick<ExamInput, "groups" | "questions">, examId?: string) {
  const ids = [...exam.groups.map((g) => g.audioFileId), ...exam.questions.map((q) => q.audioFileId)].filter(
    (id): id is string => Boolean(id),
  );
  const bad = await invalidAudioIds(userId, ids, examId);
  return bad.length ? "Có file nghe không hợp lệ hoặc không phải của bạn — hãy tải lại file audio." : null;
}

export async function createExamAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!can(user, "exam.create")) return fail("PERMISSION_DENIED");

  const parsed = examSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  const audioError = await checkAudio(user.id, parsed.data);
  if (audioError) return fail("VALIDATION_ERROR", audioError);

  // Chỉ được bỏ đề vào thư mục của mình — thư mục lạ thì để ở gốc.
  const folder = parsed.data.folderId ? await findFolder(user, parsed.data.folderId) : null;
  const exam = await createExam(user.id, { ...parsed.data, folderId: folder?.id ?? null });
  revalidatePath("/de-thi");
  return ok(exam);
}

export async function updateExamAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = updateExamSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));

  const exam = await getExamOwner(parsed.data.id);
  if (!exam) return fail("NOT_FOUND");
  if (!can(user, "exam.update", { ownerId: exam.teacherId })) return fail("PERMISSION_DENIED");
  // Đã giao cho lớp thì học sinh có thể đã làm — sửa câu hỏi sẽ làm sai điểm cũ.
  if (exam._count.assignments > 0) {
    return fail("CONFLICT", "Đề đã được giao cho lớp nên không sửa được. Hãy tạo đề mới để chỉnh.");
  }
  const audioError = await checkAudio(user.id, parsed.data, exam.id);
  if (audioError) return fail("VALIDATION_ERROR", audioError);

  const updated = await replaceExam(exam.id, parsed.data);
  revalidatePath("/de-thi");
  revalidatePath(`/de-thi/${exam.id}`);
  return ok(updated);
}

export async function deleteExamAction(examId: string): Promise<ActionResult<null>> {
  const user = await requireUser();
  const exam = await getExamOwner(examId);
  if (!exam) return fail("NOT_FOUND");
  if (!can(user, "exam.update", { ownerId: exam.teacherId })) return fail("PERMISSION_DENIED");

  await softDeleteExam(exam.id);
  revalidatePath("/de-thi");
  return ok(null);
}

/** Trang "Cài đặt" của đề: chỉ sửa thông tin chung — được cả khi đề đã giao. */
export async function updateExamSettingsAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = updateExamSettingsSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));

  const exam = await getExamOwner(parsed.data.id);
  if (!exam) return fail("NOT_FOUND");
  if (!can(user, "exam.update", { ownerId: exam.teacherId })) return fail("PERMISSION_DENIED");

  const updated = await updateExamSettings(exam.id, parsed.data);
  revalidatePath("/de-thi");
  revalidatePath(`/de-thi/${exam.id}`);
  return ok(updated);
}

/** Trang "Phân tích cấu trúc đề": lưu mức độ (NB / TH / VD) của từng câu — được cả khi đề đã giao. */
export async function updateQuestionLevelsAction(input: unknown): Promise<ActionResult<{ changed: number }>> {
  const user = await requireUser();
  const parsed = questionLevelsSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));

  const exam = await getExamOwner(parsed.data.examId);
  if (!exam) return fail("NOT_FOUND");
  if (!can(user, "exam.update", { ownerId: exam.teacherId })) return fail("PERMISSION_DENIED");

  const changed = await updateQuestionLevels(exam.id, parsed.data.levels);
  revalidatePath(`/de-thi/${exam.id}`);
  return ok({ changed });
}
