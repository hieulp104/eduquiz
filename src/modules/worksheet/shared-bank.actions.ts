"use server";

import { z } from "zod";
import { requireUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { fail, ok, type ActionResult } from "@/common/filters/error";
import { subjectsForGrades, TEACHING_GRADES } from "@/common/enums";
import { saveTeachingProfile } from "@/modules/worksheet/shared-bank.service";

const profileSchema = z.object({
  grades: z
    .array(z.number().int().refine((g) => TEACHING_GRADES.includes(g)))
    .min(1, "Vui lòng chọn khối dạy")
    .max(13),
  subjects: z.array(z.string().min(1).max(100)).min(1, "Vui lòng chọn môn dạy").max(40),
});

/** Lưu khối / môn đang dạy — môn phải thuộc các khối đã chọn. */
export async function saveTeachingProfileAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  if (!can(user, "exam.create")) return fail("PERMISSION_DENIED");
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);

  const allowed = new Set(subjectsForGrades(parsed.data.grades));
  const subjects = [...new Set(parsed.data.subjects)].filter((s) => allowed.has(s));
  if (subjects.length === 0) return fail("VALIDATION_ERROR", "Vui lòng chọn môn dạy");

  await saveTeachingProfile(user.id, [...new Set(parsed.data.grades)], subjects);
  return ok(null);
}
