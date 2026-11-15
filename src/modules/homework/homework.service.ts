import { prisma } from "@/shared/prisma/prisma.service";
import { scopeOf, type SessionUser } from "@/common/permissions/permissions";
import type { Prisma } from "@/generated/prisma/client";
import type { CreateHomeworkInput } from "@/modules/homework/homework.schema";
import { sanitizeRichText } from "@/modules/homework/homework.sanitize";

/** ALL → mọi bài tập · OWN → bài mình tạo. */
function homeworkVisibilityWhere(user: SessionUser): Prisma.HomeworkWhereInput {
  const base: Prisma.HomeworkWhereInput = { deletedAt: null };
  return scopeOf(user, "homework.view") === "ALL" ? base : { ...base, teacherId: user.id };
}

/** Danh sách bài tập; `q` tìm theo tên lớp được giao hoặc tên bài. */
export async function listHomeworks(user: SessionUser, q?: string) {
  const keyword = q?.trim();
  return prisma.homework.findMany({
    where: {
      ...homeworkVisibilityWhere(user),
      ...(keyword
        ? {
            OR: [
              { classes: { some: { classroom: { name: { contains: keyword, mode: "insensitive" } } } } },
              { title: { contains: keyword, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      classes: { select: { classroom: { select: { id: true, name: true } } } },
      _count: { select: { files: true } },
    },
  });
}

export async function getHomework(user: SessionUser, homeworkId: string) {
  return prisma.homework.findFirst({
    where: { id: homeworkId, ...homeworkVisibilityWhere(user) },
    include: {
      teacher: { select: { fullName: true } },
      classes: { select: { classroom: { select: { id: true, name: true } } } },
      files: {
        orderBy: { createdAt: "asc" },
        select: { id: true, originalName: true, mimeType: true, size: true },
      },
    },
  });
}

/** Khối / môn của bài tạo gần nhất — để form mở sẵn đúng lựa chọn quen dùng. */
export async function lastHomeworkDefaults(teacherId: string) {
  return prisma.homework.findFirst({
    where: { teacherId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { grade: true, subject: true },
  });
}

/** Lớp của giáo viên để chọn giao bài, kèm sĩ số. */
export async function listAssignableClasses(teacherId: string) {
  return prisma.classroom.findMany({
    where: { teacherId, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, subject: true, _count: { select: { members: true } } },
  });
}

export async function getClassOwners(classIds: string[]) {
  return prisma.classroom.findMany({
    where: { id: { in: classIds }, deletedAt: null },
    select: { id: true, teacherId: true },
  });
}

/**
 * Tạo bài tập + giao cho lớp + gắn file trong cùng transaction.
 * Chỉ gắn file do chính giáo viên tải lên và CHƯA thuộc bài nào — chống gắn file của người khác.
 */
export async function createHomework(teacherId: string, input: CreateHomeworkInput) {
  return prisma.$transaction(async (tx) => {
    const homework = await tx.homework.create({
      data: {
        teacherId,
        title: input.title,
        grade: input.grade,
        subject: input.subject,
        purpose: input.purpose,
        startAt: input.startAt,
        dueAt: input.dueAt,
        contentHtml: sanitizeRichText(input.contentHtml),
        showResult: input.showResult,
        requireLogin: input.requireLogin,
        classes: { create: input.classIds.map((classId) => ({ classId })) },
      },
      select: { id: true },
    });

    if (input.fileIds.length > 0) {
      await tx.storedFile.updateMany({
        where: { id: { in: input.fileIds }, ownerId: teacherId, homeworkId: null },
        data: { homeworkId: homework.id },
      });
    }
    return homework;
  });
}
