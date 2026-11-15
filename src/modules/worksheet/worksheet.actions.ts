"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { fail, ok, type ActionResult } from "@/common/filters/error";
import { createExam } from "@/modules/exams/exams.service";
import { pickQuestionSchema, worksheetToExamSchema } from "@/modules/worksheet/worksheet.schema";
import {
  getBookTree,
  getQuestionsInOrder,
  pickRandomQuestion,
} from "@/modules/worksheet/worksheet.service";
import type { BankTreeNode, WorksheetQuestion } from "@/modules/worksheet/worksheet.types";

export async function loadBookTreeAction(bookId: string): Promise<ActionResult<BankTreeNode[]>> {
  const user = await requireUser();
  if (!can(user, "exam.create")) return fail("PERMISSION_DENIED");
  return ok(await getBookTree(bookId));
}

export async function pickQuestionAction(input: unknown): Promise<ActionResult<WorksheetQuestion>> {
  const user = await requireUser();
  if (!can(user, "exam.create")) return fail("PERMISSION_DENIED");
  const parsed = pickQuestionSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");

  const q = await pickRandomQuestion(parsed.data.nodeId, parsed.data.excludeIds);
  if (!q) return fail("NOT_FOUND", "Mục này đã hết câu hỏi chưa dùng.");
  return ok(q);
}

/**
 * "Tạo đề thi online từ phiếu": chép câu hỏi sang một đề trắc nghiệm mới.
 * Câu "điền vào chỗ trống" được đổi sang trắc nghiệm bằng chính các phương án đã lưu.
 * Mỗi câu 1 điểm — giáo viên chỉnh lại trong trang sửa đề nếu cần.
 */
export async function createExamFromWorksheetAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!can(user, "exam.create")) return fail("PERMISSION_DENIED");
  const parsed = worksheetToExamSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);

  const questions = await getQuestionsInOrder(parsed.data.questionIds);
  if (questions.length === 0) return fail("NOT_FOUND", "Không tìm thấy câu hỏi trên phiếu.");

  const exam = await createExam(user.id, {
    title: parsed.data.title,
    description: "Tạo từ phiếu bài tập.",
    durationMinutes: parsed.data.durationMinutes,
    questions: questions.map((q) => ({
      content: q.content.replace(/\.{6}/g, "____"),
      points: 1,
      options: q.options.map((content, i) => ({ content, isCorrect: i === q.correctIndex })),
    })),
  });
  revalidatePath("/de-thi");
  return ok(exam);
}
