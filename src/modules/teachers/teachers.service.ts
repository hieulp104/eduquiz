import { prisma } from "@/shared/prisma/prisma.service";
import { hasPermission } from "@/common/permissions/permissions";
import type { Contact } from "@/modules/teachers/teachers.schema";
import type { PermissionTarget, TeacherBoard } from "@/modules/teachers/teachers.types";

/** Toàn bộ dữ liệu trang "Quản lý giáo viên" của chủ `ownerId`. */
export async function getTeacherBoard(ownerId: string): Promise<TeacherBoard> {
  const [groups, teachers, classes, permissions] = await Promise.all([
    prisma.teacherGroup.findMany({
      where: { ownerId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, members: { select: { memberId: true } } },
    }),
    prisma.managedTeacher.findMany({
      where: { ownerId },
      orderBy: { createdAt: "asc" },
      select: { id: true, displayName: true, phone: true, email: true, teacher: { select: { fullName: true } } },
    }),
    prisma.classroom.findMany({
      where: { teacherId: ownerId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, schoolYear: true, _count: { select: { members: true } } },
    }),
    prisma.classPermission.findMany({
      where: { classroom: { teacherId: ownerId, deletedAt: null } },
      select: { classId: true, groupId: true, memberId: true },
    }),
  ]);
  return {
    groups: groups.map((g) => ({ id: g.id, name: g.name, memberIds: g.members.map((m) => m.memberId) })),
    teachers: teachers.map((t) => ({
      id: t.id,
      name: t.displayName,
      phone: t.phone,
      email: t.email,
      accountName: t.teacher?.fullName ?? null,
    })),
    classes: classes.map((c) => ({ id: c.id, name: c.name, schoolYear: c.schoolYear, memberCount: c._count.members })),
    permissions,
  };
}

/** Giáo viên khác trong danh sách của chủ đã dùng SĐT/email này? */
async function contactTaken(ownerId: string, contact: Contact, exceptId?: string) {
  const found = await prisma.managedTeacher.findFirst({
    where: {
      ownerId,
      ...(contact.phone ? { phone: contact.phone } : { email: contact.email }),
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(found);
}

/**
 * Tài khoản giáo viên có sẵn trùng SĐT/email (không phải chính chủ, chưa liên kết trong danh sách của chủ)
 * → liên kết để người đó đăng nhập riêng vẫn thấy lớp được phân quyền. Không có thì null (giáo viên ảo).
 */
async function matchingAccountId(ownerId: string, contact: Contact, exceptId?: string): Promise<string | null> {
  const account = await prisma.user.findFirst({
    where: { ...(contact.phone ? { phone: contact.phone } : { email: contact.email! }), deletedAt: null, isActive: true },
    select: { id: true, email: true, fullName: true, role: true },
  });
  if (!account || account.id === ownerId || !hasPermission(account, "class.create")) return null;
  const used = await prisma.managedTeacher.findFirst({
    where: { ownerId, teacherId: account.id, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  return used ? null : account.id;
}

/**
 * Thêm giáo viên vào danh sách của chủ — chỉ là bản ghi quản lý (tên + SĐT/email), không tạo tài khoản.
 * Trùng SĐT/email với giáo viên đã có trong danh sách → "exists".
 */
export async function addManagedTeacher(ownerId: string, name: string, contact: Contact): Promise<"added" | "exists"> {
  if (await contactTaken(ownerId, contact)) return "exists";
  const teacherId = await matchingAccountId(ownerId, contact);
  await prisma.managedTeacher.create({ data: { ownerId, displayName: name, ...contact, teacherId } });
  return "added";
}

/** Sửa tên + SĐT/email (liên kết lại tài khoản theo liên hệ mới). */
export async function updateManagedTeacher(
  ownerId: string,
  memberId: string,
  name: string,
  contact: Contact,
): Promise<"ok" | "notFound" | "exists"> {
  const member = await prisma.managedTeacher.findFirst({ where: { id: memberId, ownerId }, select: { id: true } });
  if (!member) return "notFound";
  if (await contactTaken(ownerId, contact, memberId)) return "exists";
  const teacherId = await matchingAccountId(ownerId, contact, memberId);
  await prisma.managedTeacher.update({ where: { id: memberId }, data: { displayName: name, ...contact, teacherId } });
  return "ok";
}

export async function deleteManagedTeacher(ownerId: string, memberId: string) {
  const r = await prisma.managedTeacher.deleteMany({ where: { id: memberId, ownerId } });
  return r.count > 0;
}

export async function createTeacherGroup(ownerId: string, name: string) {
  return prisma.teacherGroup.create({ data: { ownerId, name }, select: { id: true, name: true } });
}

export async function renameTeacherGroup(ownerId: string, groupId: string, name: string) {
  const r = await prisma.teacherGroup.updateMany({ where: { id: groupId, ownerId }, data: { name } });
  return r.count > 0;
}

/** Xóa nhóm — giáo viên trong nhóm vẫn còn, chỉ mất phân quyền cấp qua nhóm. */
export async function deleteTeacherGroup(ownerId: string, groupId: string) {
  const r = await prisma.teacherGroup.deleteMany({ where: { id: groupId, ownerId } });
  return r.count > 0;
}

/** Đặt lại thành viên nhóm. Chỉ nhận giáo viên trong danh sách của chính chủ. */
export async function setGroupMembers(ownerId: string, groupId: string, memberIds: string[]) {
  const group = await prisma.teacherGroup.findFirst({ where: { id: groupId, ownerId }, select: { id: true } });
  if (!group) return false;
  const valid = await prisma.managedTeacher.findMany({
    where: { ownerId, id: { in: memberIds } },
    select: { id: true },
  });
  if (valid.length !== new Set(memberIds).size) return false;
  await prisma.$transaction([
    prisma.teacherGroupMember.deleteMany({ where: { groupId } }),
    prisma.teacherGroupMember.createMany({ data: valid.map((m) => ({ groupId, memberId: m.id })) }),
  ]);
  return true;
}

/** Nhóm / giáo viên thuộc chủ? */
export async function ownsTarget(ownerId: string, target: PermissionTarget) {
  const found =
    target.kind === "group"
      ? await prisma.teacherGroup.findFirst({ where: { id: target.id, ownerId }, select: { id: true } })
      : await prisma.managedTeacher.findFirst({ where: { id: target.id, ownerId }, select: { id: true } });
  return Boolean(found);
}

/** Lớp (trong danh sách) là lớp của chủ, chưa xóa. */
export async function countOwnClasses(ownerId: string, classIds: string[]) {
  return prisma.classroom.count({ where: { id: { in: classIds }, teacherId: ownerId, deletedAt: null } });
}

/** Thay toàn bộ phân quyền lớp của 1 nhóm / 1 giáo viên bằng `classIds`. */
export async function saveClassPermissions(target: PermissionTarget, classIds: string[]) {
  const key = target.kind === "group" ? { groupId: target.id } : { memberId: target.id };
  await prisma.$transaction([
    prisma.classPermission.deleteMany({ where: { ...key, classId: { notIn: classIds } } }),
    prisma.classPermission.createMany({
      data: classIds.map((classId) => ({ classId, ...key })),
      skipDuplicates: true,
    }),
  ]);
}
