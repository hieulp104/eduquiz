import { prisma } from "@/shared/prisma/prisma.service";
import { scopeOf, type SessionUser } from "@/common/permissions/permissions";
import type { Prisma } from "@/generated/prisma/client";
import type { CreateHomeworkInput } from "@/modules/homework/homework.schema";
import { sanitizeRichText } from "@/modules/homework/homework.sanitize";
import { deleteObject } from "@/shared/storage/storage.service";
import { toVnDateTimeLocal } from "@/lib/utils";
import type { HomeworkInitial } from "@/modules/homework/components/homework-form";

/** ALL → mọi bài tập · OWN → bài mình tạo. */
function homeworkVisibilityWhere(user: SessionUser): Prisma.HomeworkWhereInput {
  const base: Prisma.HomeworkWhereInput = { deletedAt: null };
  return scopeOf(user, "homework.view") === "ALL"
    ? base
    : { ...base, teacherId: user.id };
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
              {
                classes: {
                  some: {
                    classroom: {
                      name: { contains: keyword, mode: "insensitive" },
                    },
                  },
                },
              },
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
    select: {
      id: true,
      name: true,
      subject: true,
      _count: { select: { members: true } },
    },
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
export async function createHomework(
  teacherId: string,
  input: CreateHomeworkInput,
) {
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
        where: {
          id: { in: input.fileIds },
          ownerId: teacherId,
          homeworkId: null,
        },
        data: { homeworkId: homework.id },
      });
    }
    return homework;
  });
}

/** Chủ bài tập (để kiểm quyền sửa / xóa); null nếu không còn. */
export async function getHomeworkOwner(homeworkId: string) {
  return prisma.homework.findFirst({
    where: { id: homeworkId, deletedAt: null },
    select: { id: true, teacherId: true },
  });
}

/**
 * Sửa bài tập: ghi đè thông tin, thay danh sách lớp, đồng bộ file.
 * File bị bỏ khỏi bài → xóa hẳn (file chỉ thuộc 1 bài). File mới: như lúc tạo, chỉ nhận file
 * của chính người sửa và chưa thuộc bài nào.
 */
export async function updateHomework(
  homeworkId: string,
  editorId: string,
  input: CreateHomeworkInput,
) {
  const removed = await prisma.$transaction(async (tx) => {
    await tx.homework.update({
      where: { id: homeworkId },
      data: {
        title: input.title,
        grade: input.grade,
        subject: input.subject,
        purpose: input.purpose,
        startAt: input.startAt,
        dueAt: input.dueAt,
        contentHtml: sanitizeRichText(input.contentHtml),
        showResult: input.showResult,
        requireLogin: input.requireLogin,
        classes: {
          deleteMany: {},
          create: input.classIds.map((classId) => ({ classId })),
        },
      },
    });

    const dropped = await tx.storedFile.findMany({
      where: { homeworkId, id: { notIn: input.fileIds }, contentItem: null },
      select: { id: true, objectKey: true },
    });
    if (dropped.length > 0) {
      await tx.storedFile.deleteMany({
        where: { id: { in: dropped.map((f) => f.id) } },
      });
    }
    if (input.fileIds.length > 0) {
      await tx.storedFile.updateMany({
        where: {
          id: { in: input.fileIds },
          ownerId: editorId,
          homeworkId: null,
        },
        data: { homeworkId },
      });
    }
    return dropped;
  });
  // Xóa file trên ổ đĩa SAU khi DB đã chốt — transaction lỗi thì file vẫn còn nguyên.
  await Promise.all(
    removed.map((f) => deleteObject(f.objectKey).catch(() => {})),
  );
}

/** Xóa mềm — file đính kèm giữ nguyên để khôi phục được. */
export async function softDeleteHomework(homeworkId: string) {
  await prisma.homework.update({
    where: { id: homeworkId },
    data: { deletedAt: new Date() },
  });
}

/**
 * Bài tập → dữ liệu điền sẵn cho form (sửa / nhân bản). Ngày giờ đổi sang chuỗi giờ VN.
 * `withFiles = false` khi nhân bản — 1 file chỉ thuộc 1 bài nên không chép được.
 */
export function toHomeworkInitial(
  hw: NonNullable<Awaited<ReturnType<typeof getHomework>>>,
  withFiles: boolean,
): HomeworkInitial {
  return {
    title: hw.title,
    grade: hw.grade,
    subject: hw.subject,
    purpose: hw.purpose,
    startAt: hw.startAt ? toVnDateTimeLocal(hw.startAt) : "",
    dueAt: hw.dueAt ? toVnDateTimeLocal(hw.dueAt) : "",
    contentHtml: hw.contentHtml,
    showResult: hw.showResult,
    requireLogin: hw.requireLogin,
    classIds: hw.classes.map((c) => c.classroom.id),
    files: withFiles
      ? hw.files.map((f) => ({
          id: f.id,
          name: f.originalName,
          size: f.size,
          mimeType: f.mimeType,
        }))
      : [],
  };
}
