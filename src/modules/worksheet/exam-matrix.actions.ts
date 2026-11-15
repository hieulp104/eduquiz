"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { fail, ok, type ActionResult } from "@/common/filters/error";
import { createExam } from "@/modules/exams/exams.service";
import { findFolder } from "@/modules/exams/exam-library.service";
import {
  getQuestionsInOrder,
  nodeBelongsToBook,
  pickRandomQuestions,
} from "@/modules/worksheet/worksheet.service";

const matrixSchema = z.object({
  bookId: z.string().min(1),
  title: z.string().trim().min(1, "Vui lòng nhập tên đề").max(200),
  durationMinutes: z.number().int().min(1).max(300),
  folderId: z.string().min(1).nullable(),
  rows: z
    .array(z.object({ nodeId: z.string().min(1), count: z.number().int().min(0).max(100) }))
    .max(50),
});

/**
 * Tạo đề từ ma trận: mỗi chủ đề lấy ngẫu nhiên đúng số câu đã nhập (không trùng),
 * giữ thứ tự chủ đề. Mỗi câu 1 điểm.
 */
export async function createExamFromMatrixAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!can(user, "exam.create")) return fail("PERMISSION_DENIED");
  const parsed = matrixSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);

  const rows = parsed.data.rows.filter((r) => r.count > 0);
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (total === 0) return fail("VALIDATION_ERROR", "Nhập số câu cho ít nhất 1 chủ đề.");
  if (total > 200) return fail("VALIDATION_ERROR", "Một đề tối đa 200 câu.");

  const picked: string[] = [];
  for (const r of rows) {
    if (!(await nodeBelongsToBook(r.nodeId, parsed.data.bookId))) return fail("NOT_FOUND", "Chủ đề không thuộc sách đã chọn.");
    const ids = await pickRandomQuestions(r.nodeId, r.count, picked);
    if (ids.length < r.count) {
      return fail("CONFLICT", `Có chủ đề chỉ còn ${ids.length} câu, ít hơn số câu yêu cầu (${r.count}).`);
    }
    picked.push(...ids);
  }

  const questions = await getQuestionsInOrder(picked);
  const folder = parsed.data.folderId ? await findFolder(user, parsed.data.folderId) : null;
  const exam = await createExam(user.id, {
    title: parsed.data.title,
    description: "Tạo từ ma trận đề.",
    durationMinutes: parsed.data.durationMinutes,
    folderId: folder?.id ?? null,
    questions: questions.map((q) => ({
      content: q.content.replace(/\.{6}/g, "____"),
      points: 1,
      options: q.options.map((content, i) => ({ content, isCorrect: i === q.correctIndex })),
    })),
  });
  revalidatePath("/de-thi");
  return ok(exam);
}
