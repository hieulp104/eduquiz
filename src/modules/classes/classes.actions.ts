"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { fail, ok, type ActionResult } from "@/common/filters/error";
import {
  classGroupSchema,
  createClassesSchema,
  importClassesSchema,
  joinClassSchema,
  promoteClassesSchema,
  removeMemberSchema,
} from "@/modules/classes/classes.schema";
import {
  addMember,
  createClasses,
  createClassGroup,
  findClassesWithMembers,
  findOwnGroup,
  promoteClasses,
  findClassByJoinCode,
  getClassOwner,
  removeMember,
} from "@/modules/classes/classes.service";

export type FormState = { error: string | null; success?: string };

export async function joinClassAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!can(user, "class.join")) return { error: "Tài khoản của bạn không tham gia lớp được." };

  const parsed = joinClassSchema.safeParse({ joinCode: formData.get("joinCode") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Mã lớp không hợp lệ" };

  const classroom = await findClassByJoinCode(parsed.data.joinCode);
  if (!classroom) return { error: "Không tìm thấy lớp với mã này." };

  await addMember(classroom.id, user.id);
  revalidatePath("/lop-hoc");
  return { error: null, success: `Đã vào lớp "${classroom.name}".` };
}

export async function removeStudentAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");

  const classroom = await getClassOwner(parsed.data.classId);
  if (!classroom) return fail("NOT_FOUND");
  if (!can(user, "class.update", { ownerId: classroom.teacherId })) return fail("PERMISSION_DENIED");

  await removeMember(parsed.data.classId, parsed.data.studentId);
  revalidatePath(`/lop-hoc/${parsed.data.classId}`);
  return ok(null);
}

const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "Dữ liệu không hợp lệ";

/** "Thêm lớp học": mỗi dòng 1 lớp, cùng năm học + nhóm. */
export async function createClassesAction(input: unknown): Promise<ActionResult<{ count: number; names: string[] }>> {
  const user = await requireUser();
  if (!can(user, "class.create")) return fail("PERMISSION_DENIED");
  const parsed = createClassesSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));

  const { names, schoolYear, groupId } = parsed.data;
  if (groupId && !(await findOwnGroup(user.id, groupId))) return fail("NOT_FOUND", "Không tìm thấy nhóm lớp.");
  const created = await createClasses(
    user.id,
    names.map((name) => ({ name, schoolYear, groupId })),
  );
  revalidatePath("/lop-hoc");
  return ok({ count: created.length, names: created.map((c) => c.name) });
}

export async function createClassGroupAction(input: unknown): Promise<ActionResult<{ id: string; name: string }>> {
  const user = await requireUser();
  if (!can(user, "class.create")) return fail("PERMISSION_DENIED");
  const parsed = classGroupSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));

  const group = await createClassGroup(user.id, parsed.data.name);
  revalidatePath("/lop-hoc");
  return ok(group);
}

/** Tạo lớp từ file Excel đã đọc (xem trước ở client). Nhóm ghi bằng tên — chưa có thì tạo mới. */
export async function importClassesAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser();
  if (!can(user, "class.create")) return fail("PERMISSION_DENIED");
  const parsed = importClassesSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));

  const groupIds = new Map<string, string>();
  for (const name of new Set(parsed.data.rows.map((r) => r.groupName).filter((n): n is string => Boolean(n)))) {
    groupIds.set(name.toLowerCase(), (await createClassGroup(user.id, name)).id);
  }
  const created = await createClasses(
    user.id,
    parsed.data.rows.map((r) => ({
      name: r.name,
      schoolYear: r.schoolYear,
      groupId: r.groupName ? (groupIds.get(r.groupName.toLowerCase()) ?? null) : null,
    })),
  );
  revalidatePath("/lop-hoc");
  return ok({ count: created.length });
}

/** "Tạo lớp cho khóa mới": tạo lớp ở năm học mới + chép học sinh của lớp cũ. */
export async function promoteClassesAction(input: unknown): Promise<ActionResult<{ classes: number; students: number }>> {
  const user = await requireUser();
  if (!can(user, "class.create")) return fail("PERMISSION_DENIED");
  const parsed = promoteClassesSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));

  const ids = parsed.data.items.map((i) => i.sourceId);
  const sources = new Map((await findClassesWithMembers(user, ids)).map((c) => [c.id, c]));
  const items = [];
  for (const it of parsed.data.items) {
    const source = sources.get(it.sourceId);
    if (!source) return fail("NOT_FOUND", "Có lớp cũ không tìm thấy hoặc không phải lớp của bạn.");
    if (!can(user, "class.update", { ownerId: source.teacherId })) return fail("PERMISSION_DENIED");
    items.push({ name: it.name, source });
  }
  const result = await promoteClasses(items, parsed.data.schoolYear);
  revalidatePath("/lop-hoc");
  return ok(result);
}
