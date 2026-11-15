import { prisma } from "@/shared/prisma/prisma.service";
import { scopeOf, type SessionUser } from "@/common/permissions/permissions";
import { generateJoinCode } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";
import { sharedClassWhere } from "@/modules/teachers/class-sharing.service";

/**
 * Điều kiện lọc lớp mà user được xem.
 * ALL → mọi lớp · OWN → lớp mình dạy, lớp được phân quyền ("Quản lý giáo viên") HOẶC lớp mình là học sinh.
 */
export function classVisibilityWhere(user: SessionUser): Prisma.ClassroomWhereInput {
  const base: Prisma.ClassroomWhereInput = { deletedAt: null };
  if (scopeOf(user, "class.view") === "ALL") return base;
  return {
    ...base,
    OR: [{ teacherId: user.id }, sharedClassWhere(user.id), { members: { some: { studentId: user.id } } }],
  };
}

export async function listClasses(user: SessionUser) {
  return prisma.classroom.findMany({
    where: classVisibilityWhere(user),
    orderBy: { createdAt: "desc" },
    include: {
      teacher: { select: { fullName: true } },
      _count: { select: { members: true, assignments: { where: { deletedAt: null } } } },
    },
  });
}

export async function getClassDetail(user: SessionUser, classId: string) {
  return prisma.classroom.findFirst({
    where: { id: classId, ...classVisibilityWhere(user) },
    include: {
      teacher: { select: { id: true, fullName: true } },
      members: {
        orderBy: { student: { fullName: "asc" } },
        include: { student: { select: { id: true, fullName: true, email: true } } },
      },
      assignments: {
        where: { deletedAt: null },
        orderBy: { dueAt: "desc" },
        include: {
          exam: { select: { id: true, title: true, durationMinutes: true } },
          submissions: {
            where: { submittedAt: { not: null } },
            select: { studentId: true, score: true, maxScore: true },
          },
        },
      },
    },
  });
}

export async function findClassByJoinCode(joinCode: string) {
  return prisma.classroom.findFirst({
    where: { joinCode, deletedAt: null },
    select: { id: true, name: true, teacherId: true },
  });
}

export async function addMember(classId: string, studentId: string) {
  await prisma.classMember.upsert({
    where: { classId_studentId: { classId, studentId } },
    create: { classId, studentId },
    update: {},
  });
}

export async function removeMember(classId: string, studentId: string) {
  await prisma.classMember.deleteMany({ where: { classId, studentId } });
}

export async function getClassOwner(classId: string) {
  return prisma.classroom.findFirst({
    where: { id: classId, deletedAt: null },
    select: { id: true, teacherId: true },
  });
}

// ═══════════════════ Danh sách lớp của giáo viên (nhóm lớp, năm học) ═══════════════════

type NewClass = { name: string; schoolYear: string | null; groupId: string | null; subject?: string | null };

/** Tạo 1 lớp trong transaction với mã vào lớp không trùng. */
async function insertClass(tx: Prisma.TransactionClient, teacherId: string, data: NewClass) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const joinCode = generateJoinCode();
    const taken = await tx.classroom.findUnique({ where: { joinCode }, select: { id: true } });
    if (taken) continue;
    return tx.classroom.create({
      data: { ...data, subject: data.subject ?? null, teacherId, joinCode },
      select: { id: true, name: true, joinCode: true },
    });
  }
  throw new Error("Không sinh được mã lớp không trùng");
}

export async function createClasses(teacherId: string, list: NewClass[]) {
  return prisma.$transaction(async (tx) => {
    const out = [];
    for (const c of list) out.push(await insertClass(tx, teacherId, c));
    return out;
  });
}

/** Lớp của giáo viên cho trang danh sách lớp (OWN: lớp mình dạy + lớp được phân quyền; Admin: mọi lớp). */
export async function listClassBoard(user: SessionUser) {
  const where: Prisma.ClassroomWhereInput = {
    deletedAt: null,
    ...(scopeOf(user, "class.view") === "ALL" ? {} : { OR: [{ teacherId: user.id }, sharedClassWhere(user.id)] }),
  };
  const [classes, groups] = await Promise.all([
    prisma.classroom.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        joinCode: true,
        schoolYear: true,
        groupId: true,
        teacherId: true,
        teacher: { select: { fullName: true } },
        createdAt: true,
        _count: { select: { members: true, assignments: { where: { deletedAt: null } } } },
      },
    }),
    listClassGroups(user.id),
  ]);
  return {
    groups,
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      joinCode: c.joinCode,
      schoolYear: c.schoolYear,
      // Lớp người khác phân quyền cho mình: nhóm lớp là của chủ lớp → không dùng.
      groupId: c.teacherId === user.id || scopeOf(user, "class.view") === "ALL" ? c.groupId : null,
      sharedBy: scopeOf(user, "class.view") !== "ALL" && c.teacherId !== user.id ? c.teacher.fullName : null,
      memberCount: c._count.members,
      assignmentCount: c._count.assignments,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

export async function listClassGroups(teacherId: string) {
  return prisma.classGroup.findMany({
    where: { teacherId, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function findOwnGroup(teacherId: string, groupId: string) {
  return prisma.classGroup.findFirst({ where: { id: groupId, teacherId, deletedAt: null }, select: { id: true } });
}

/** Tạo nhóm lớp; đã có nhóm cùng tên (không phân biệt hoa thường) thì trả nhóm cũ. */
export async function createClassGroup(teacherId: string, name: string) {
  const existing = await prisma.classGroup.findFirst({
    where: { teacherId, deletedAt: null, name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  return existing ?? prisma.classGroup.create({ data: { teacherId, name }, select: { id: true, name: true } });
}

/** Lớp nguồn (của giáo viên) kèm danh sách học sinh — cho "Tạo lớp cho khóa mới". */
export async function findClassesWithMembers(user: SessionUser, ids: string[]) {
  return prisma.classroom.findMany({
    where: {
      id: { in: ids },
      deletedAt: null,
      ...(scopeOf(user, "class.update") === "ALL" ? {} : { teacherId: user.id }),
    },
    select: { id: true, teacherId: true, groupId: true, subject: true, members: { select: { studentId: true } } },
  });
}

/** Tạo lớp khóa mới và chép học sinh từ lớp cũ (lớp mới thuộc giáo viên của lớp cũ). */
export async function promoteClasses(
  items: { name: string; source: Awaited<ReturnType<typeof findClassesWithMembers>>[number] }[],
  schoolYear: string,
) {
  return prisma.$transaction(
    async (tx) => {
      let students = 0;
      for (const { name, source } of items) {
        const created = await insertClass(tx, source.teacherId, {
          name,
          schoolYear,
          groupId: source.groupId,
          subject: source.subject,
        });
        if (source.members.length) {
          await tx.classMember.createMany({
            data: source.members.map((m) => ({ classId: created.id, studentId: m.studentId })),
          });
          students += source.members.length;
        }
      }
      return { classes: items.length, students };
    },
    { timeout: 30_000 },
  );
}
