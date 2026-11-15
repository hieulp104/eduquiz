"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { createAssignmentSchema } from "@/modules/assignments/assignments.schema";
import { createAssignment } from "@/modules/assignments/assignments.service";
import { getClassAccess } from "@/modules/teachers/class-sharing.service";
import { getExamOwner } from "@/modules/exams/exams.service";

export type AssignFormState = { error: string | null; success?: string };

export async function createAssignmentAction(
  _prev: AssignFormState,
  formData: FormData,
): Promise<AssignFormState> {
  const user = await requireUser();

  const parsed = createAssignmentSchema.safeParse({
    classId: formData.get("classId") ?? "",
    examId: formData.get("examId") ?? "",
    openAt: formData.get("openAt") ?? "",
    dueAt: formData.get("dueAt") ?? "",
    showAnswer: formData.get("showAnswer") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  // Phải là giáo viên của lớp (hoặc được phân quyền lớp) VÀ người soạn đề (hoặc Admin).
  const [classroom, exam] = await Promise.all([
    getClassAccess(parsed.data.classId),
    getExamOwner(parsed.data.examId),
  ]);
  if (!classroom || !exam) return { error: "Không tìm thấy lớp hoặc đề." };
  if (
    !can(user, "assignment.create", { ownerId: classroom.teacherId, sharedWith: classroom.sharedWith }) ||
    !can(user, "exam.view", { ownerId: exam.teacherId })
  ) {
    return { error: "Bạn không có quyền giao đề này cho lớp này." };
  }

  await createAssignment(parsed.data);
  revalidatePath(`/lop-hoc/${classroom.id}`);
  return { error: null, success: "Đã giao bài cho lớp." };
}
