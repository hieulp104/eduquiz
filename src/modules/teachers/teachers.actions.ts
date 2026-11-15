"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { fail, ok, type ActionResult } from "@/common/filters/error";
import {
  addTeacherSchema,
  contactSchema,
  deleteTargetSchema,
  importTeachersSchema,
  renameGroupSchema,
  saveClassPermissionsSchema,
  setGroupMembersSchema,
  teacherGroupSchema,
  updateTeacherSchema,
} from "@/modules/teachers/teachers.schema";
import {
  addManagedTeacher,
  countOwnClasses,
  createTeacherGroup,
  deleteManagedTeacher,
  deleteTeacherGroup,
  ownsTarget,
  renameTeacherGroup,
  saveClassPermissions,
  setGroupMembers,
  updateManagedTeacher,
} from "@/modules/teachers/teachers.service";
import type { AddTeacherOutcome } from "@/modules/teachers/teachers.types";

const PAGE = "/quan-ly-giao-vien";
const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "Dữ liệu không hợp lệ";

const DUPLICATE = "Số điện thoại / email này đã có trong danh sách.";

/** Thêm 1 giáo viên (bản ghi quản lý: họ tên + SĐT 10 số hoặc email — không cần tài khoản). */
export async function addTeacherAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  if (!can(user, "teacher.manage")) return fail("PERMISSION_DENIED");
  const parsed = addTeacherSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));

  if ((await addManagedTeacher(user.id, parsed.data.name, parsed.data.contact)) === "exists") {
    return fail("CONFLICT", DUPLICATE);
  }
  revalidatePath(PAGE);
  return ok(null);
}

/** Thêm nhiều giáo viên từ file Excel đã đọc (xem trước ở client). Trả kết quả từng dòng. */
export async function importTeachersAction(input: unknown): Promise<ActionResult<AddTeacherOutcome[]>> {
  const user = await requireUser();
  if (!can(user, "teacher.manage")) return fail("PERMISSION_DENIED");
  const parsed = importTeachersSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));

  const out: AddTeacherOutcome[] = [];
  for (const row of parsed.data.rows) {
    const name = row.name.trim();
    const contact = contactSchema.safeParse(row.contact);
    if (!contact.success || !name || name.length > 100) {
      const message = !name ? "Thiếu họ và tên" : contact.success ? "Tên quá dài" : firstIssue(contact.error);
      out.push({ contact: row.contact, name, status: "invalid", message });
      continue;
    }
    out.push({ contact: row.contact, name, status: await addManagedTeacher(user.id, name, contact.data) });
  }
  revalidatePath(PAGE);
  return ok(out);
}

/** Sửa họ tên + SĐT/email. */
export async function updateTeacherAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  if (!can(user, "teacher.manage")) return fail("PERMISSION_DENIED");
  const parsed = updateTeacherSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));

  const { memberId, name, contact } = parsed.data;
  const res = await updateManagedTeacher(user.id, memberId, name, contact);
  if (res === "notFound") return fail("NOT_FOUND");
  if (res === "exists") return fail("CONFLICT", DUPLICATE);
  revalidatePath(PAGE);
  revalidatePath("/lop-hoc");
  return ok(null);
}

export async function createTeacherGroupAction(input: unknown): Promise<ActionResult<{ id: string; name: string }>> {
  const user = await requireUser();
  if (!can(user, "teacher.manage")) return fail("PERMISSION_DENIED");
  const parsed = teacherGroupSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));

  const group = await createTeacherGroup(user.id, parsed.data.name);
  revalidatePath(PAGE);
  return ok(group);
}

export async function renameTeacherGroupAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  if (!can(user, "teacher.manage")) return fail("PERMISSION_DENIED");
  const parsed = renameGroupSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));

  if (!(await renameTeacherGroup(user.id, parsed.data.groupId, parsed.data.name))) return fail("NOT_FOUND");
  revalidatePath(PAGE);
  return ok(null);
}

/** Xóa nhóm (giáo viên trong nhóm vẫn còn) hoặc xóa giáo viên khỏi danh sách. Mất phân quyền lớp tương ứng. */
export async function deleteTeacherTargetAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  if (!can(user, "teacher.manage")) return fail("PERMISSION_DENIED");
  const parsed = deleteTargetSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");

  const done =
    parsed.data.kind === "group"
      ? await deleteTeacherGroup(user.id, parsed.data.id)
      : await deleteManagedTeacher(user.id, parsed.data.id);
  if (!done) return fail("NOT_FOUND");
  revalidatePath(PAGE);
  revalidatePath("/lop-hoc");
  return ok(null);
}

export async function setGroupMembersAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  if (!can(user, "teacher.manage")) return fail("PERMISSION_DENIED");
  const parsed = setGroupMembersSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");

  if (!(await setGroupMembers(user.id, parsed.data.groupId, [...new Set(parsed.data.memberIds)]))) {
    return fail("NOT_FOUND", "Không tìm thấy nhóm hoặc giáo viên.");
  }
  revalidatePath(PAGE);
  revalidatePath("/lop-hoc");
  return ok(null);
}

/** "Lưu" phân quyền lớp cho 1 nhóm / 1 giáo viên. Chỉ phân quyền được lớp của chính mình. */
export async function saveClassPermissionsAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser();
  if (!can(user, "teacher.manage")) return fail("PERMISSION_DENIED");
  const parsed = saveClassPermissionsSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");

  const { kind, id } = parsed.data;
  const classIds = [...new Set(parsed.data.classIds)];
  if (!(await ownsTarget(user.id, { kind, id }))) return fail("NOT_FOUND");
  if ((await countOwnClasses(user.id, classIds)) !== classIds.length) {
    return fail("PERMISSION_DENIED", "Chỉ phân quyền được lớp của chính bạn.");
  }
  await saveClassPermissions({ kind, id }, classIds);
  revalidatePath(PAGE);
  revalidatePath("/lop-hoc");
  return ok({ count: classIds.length });
}
