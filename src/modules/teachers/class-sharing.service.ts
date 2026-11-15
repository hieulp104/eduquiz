/**
 * Lớp được chủ lớp phân quyền cho giáo viên khác ("Quản lý giáo viên").
 * Chỉ có tác dụng với giáo viên trong danh sách được liên kết tài khoản (trùng SĐT/email); giáo viên ảo chỉ để quản lý.
 * Người được phân quyền (trực tiếp hoặc qua nhóm): xem lớp, giao đề, xem kết quả.
 * Dùng kèm can(): `can(user, "assignment.create", { ownerId: c.teacherId, sharedWith })`.
 */
import { prisma } from "@/shared/prisma/prisma.service";
import type { Prisma } from "@/generated/prisma/client";

/** Điều kiện ClassPermission áp dụng cho tài khoản `userId` (cấp trực tiếp hoặc qua nhóm có user). */
export function permissionForUserWhere(userId: string): Prisma.ClassPermissionWhereInput {
  return {
    OR: [{ member: { teacherId: userId } }, { group: { members: { some: { member: { teacherId: userId } } } } }],
  };
}

/** Điều kiện lớp được phân quyền cho `userId`. */
export function sharedClassWhere(userId: string): Prisma.ClassroomWhereInput {
  return { permissions: { some: permissionForUserWhere(userId) } };
}

/** id tài khoản giáo viên được phân quyền từng lớp. */
export async function classSharedWith(classIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, Set<string>>(classIds.map((id) => [id, new Set()]));
  if (classIds.length === 0) return new Map();
  const rows = await prisma.classPermission.findMany({
    where: { classId: { in: classIds } },
    select: {
      classId: true,
      member: { select: { teacherId: true } },
      group: { select: { members: { select: { member: { select: { teacherId: true } } } } } },
    },
  });
  for (const r of rows) {
    const set = out.get(r.classId)!;
    // Giáo viên ảo (không liên kết tài khoản) không có ai đăng nhập → bỏ qua.
    if (r.member?.teacherId) set.add(r.member.teacherId);
    for (const m of r.group?.members ?? []) if (m.member.teacherId) set.add(m.member.teacherId);
  }
  return new Map([...out].map(([k, v]) => [k, [...v]]));
}

/** Chủ lớp + giáo viên được phân quyền — ngữ cảnh cho can(). null nếu lớp không còn. */
export async function getClassAccess(classId: string) {
  const classroom = await prisma.classroom.findFirst({
    where: { id: classId, deletedAt: null },
    select: { id: true, teacherId: true },
  });
  if (!classroom) return null;
  const sharedWith = (await classSharedWith([classId])).get(classId) ?? [];
  return { ...classroom, sharedWith };
}
