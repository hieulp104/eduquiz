"use server";

import { z } from "zod";
import { requireUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { fail, ok, type ActionResult } from "@/common/filters/error";
import { findReplacementQuestions } from "@/modules/exams/exam-replace.service";
import type { ReplaceCandidate } from "@/modules/exams/exam-replace.types";

const schema = z.object({
  /** Nội dung câu hiện tại hoặc từ khóa giáo viên gõ. */
  text: z.string().max(5000),
  /** Nội dung câu đang thay — loại khỏi kết quả. */
  exclude: z.string().max(5000).default(""),
  grade: z.number().int().min(0).max(12).nullable(),
  subject: z.string().max(100).nullable(),
  excludeExamId: z.string().max(40).nullable(),
});

/** Gợi ý câu thay thế cho "Đổi câu khác" (chỉ đọc). */
export async function findReplacementsAction(input: unknown): Promise<ActionResult<ReplaceCandidate[]>> {
  const user = await requireUser();
  if (!can(user, "exam.create")) return fail("PERMISSION_DENIED");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");
  return ok(await findReplacementQuestions(user, parsed.data));
}
