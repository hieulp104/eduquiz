"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { fail, ok, type ActionResult } from "@/common/filters/error";
import { getExamOwner } from "@/modules/exams/exams.service";
import { getClassAccess } from "@/modules/teachers/class-sharing.service";
import { onlineSettingsSchema } from "@/modules/publish/publish.schema";
import { listClassesWithStudents, saveOnlineSettings } from "@/modules/publish/publish.service";

/**
 * "Cài đặt làm bài online": Lưu nháp (chỉ lưu cấu hình) hoặc Xuất bản (lưu + tạo / cập nhật bài giao).
 * Quyền: sửa được đề; khi xuất bản còn phải giao bài được cho TỪNG lớp / học sinh được chọn.
 */
export async function saveOnlineSettingsAction(input: unknown): Promise<ActionResult<{ code: string; published: boolean }>> {
  const user = await requireUser();
  if (!can(user, "exam.update")) return fail("PERMISSION_DENIED");

  const parsed = onlineSettingsSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);
  const data = parsed.data;

  const exam = await getExamOwner(data.examId);
  if (!exam) return fail("NOT_FOUND", "Không tìm thấy đề.");
  if (!can(user, "exam.update", { ownerId: exam.teacherId })) return fail("PERMISSION_DENIED");

  if (data.publish) {
    if (!can(user, "assignment.create")) return fail("PERMISSION_DENIED");
    if (data.audience === "CLASSES") {
      for (const classId of new Set(data.classIds)) {
        const classroom = await getClassAccess(classId);
        if (!classroom) return fail("NOT_FOUND", "Không tìm thấy lớp.");
        if (!can(user, "assignment.create", { ownerId: classroom.teacherId, sharedWith: classroom.sharedWith })) {
          return fail("PERMISSION_DENIED", "Bạn không có quyền giao đề cho lớp đã chọn.");
        }
      }
    }
    if (data.audience === "STUDENTS") {
      // Chỉ giao được cho học sinh trong các lớp mình được giao bài.
      const known = new Set((await listClassesWithStudents(user)).flatMap((c) => c.members.map((m) => m.student.id)));
      if (data.studentIds.some((id) => !known.has(id))) {
        return fail("VALIDATION_ERROR", "Có học sinh không thuộc lớp của bạn — hãy chọn lại.");
      }
    }
  }

  const saved = await saveOnlineSettings(data);
  revalidatePath("/de-thi");
  revalidatePath(`/de-thi/${exam.id}`);
  revalidatePath("/dashboard");
  return ok(saved);
}
