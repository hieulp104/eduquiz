import { randomUUID } from "node:crypto";
import { openAssignmentWhere } from "@/modules/publish/publish.service";
import path from "node:path";
import { prisma } from "@/shared/prisma/prisma.service";
import { deleteObject, putObject } from "@/shared/storage/storage.service";
import { can, type SessionUser } from "@/common/permissions/permissions";
import { isAllowedMime, MAX_FILE_SIZE } from "@/modules/files/files.constants";

export type SaveFileResult =
  | { ok: true; file: { id: string; originalName: string; size: number; mimeType: string } }
  | { ok: false; message: string };

/** Lưu file vào kho + ghi DB. File chưa gắn vào bài tập nào (homeworkId = null). */
export async function saveUploadedFile(ownerId: string, file: File): Promise<SaveFileResult> {
  if (file.size === 0) return { ok: false, message: "File rỗng." };
  if (file.size > MAX_FILE_SIZE) return { ok: false, message: "File vượt quá 20MB." };
  const mimeType = file.type || "application/octet-stream";
  if (!isAllowedMime(mimeType)) {
    return { ok: false, message: "Chỉ nhận file ảnh, PDF, Word, Excel, PowerPoint, âm thanh hoặc video." };
  }

  // Tên trong kho do server sinh — không dùng tên gốc để tránh ký tự lạ / đường dẫn.
  const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
  const now = new Date();
  const objectKey = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}${ext}`;

  await putObject(objectKey, new Uint8Array(await file.arrayBuffer()));
  try {
    const row = await prisma.storedFile.create({
      data: {
        ownerId,
        objectKey,
        originalName: file.name.slice(0, 255),
        mimeType,
        size: file.size,
      },
      select: { id: true, originalName: true, size: true, mimeType: true },
    });
    return { ok: true, file: row };
  } catch (error) {
    // Ghi DB lỗi → xóa file vừa ghi, không để file mồ côi trong kho.
    await deleteObject(objectKey).catch(() => {});
    throw error;
  }
}

export async function findFile(fileId: string) {
  return prisma.storedFile.findUnique({
    where: { id: fileId },
    include: {
      homework: {
        select: {
          teacherId: true,
          deletedAt: true,
          classes: { select: { classId: true } },
        },
      },
      // File nghe gắn vào câu hỏi / nhóm câu của đề thi.
      audioOfQuestions: { select: { exam: { select: { id: true, teacherId: true, deletedAt: true } } } },
      audioOfGroups: { select: { exam: { select: { id: true, teacherId: true, deletedAt: true } } } },
      // File đã đóng góp lên Kho nội dung.
      contentItem: { select: { deletedAt: true } },
    },
  });
}

/**
 * Ai được xem file:
 * - người tải lên;
 * - giáo viên của bài tập chứa file (hoặc Admin);
 * - học sinh thuộc lớp được giao bài tập đó;
 * - người xem được Kho nội dung, nếu file đã đóng góp lên kho (chưa gỡ).
 */
export async function canReadFile(
  user: SessionUser,
  file: NonNullable<Awaited<ReturnType<typeof findFile>>>,
): Promise<boolean> {
  if (file.ownerId === user.id) return true;
  if (file.contentItem && !file.contentItem.deletedAt && can(user, "content.view")) return true;
  if (await canReadExamAudio(user, file)) return true;
  const hw = file.homework;
  if (!hw || hw.deletedAt) return false;
  if (can(user, "homework.view", { ownerId: hw.teacherId })) return true;

  const classIds = hw.classes.map((c) => c.classId);
  if (classIds.length === 0) return false;
  const member = await prisma.classMember.findFirst({
    where: { studentId: user.id, classId: { in: classIds } },
    select: { classId: true },
  });
  return Boolean(member);
}

/** Xóa file CHƯA gắn vào bài tập (người dùng bỏ file khỏi form trước khi lưu). */
export async function deleteUnattachedFile(ownerId: string, fileId: string): Promise<boolean> {
  const file = await prisma.storedFile.findFirst({
    where: { id: fileId, ownerId, homeworkId: null, contentItem: null },
    select: { id: true, objectKey: true },
  });
  if (!file) return false;
  await prisma.storedFile.delete({ where: { id: file.id } });
  await deleteObject(file.objectKey);
  return true;
}

/**
 * File nghe của đề: giáo viên soạn đề (hoặc Admin), người xem kho (đề đã chia sẻ lên kho)
 * và học sinh thuộc lớp được giao đề (chưa xóa) hoặc thuộc đối tượng của đề đã xuất bản.
 */
async function canReadExamAudio(
  user: SessionUser,
  file: NonNullable<Awaited<ReturnType<typeof findFile>>>,
): Promise<boolean> {
  const exams = [...file.audioOfQuestions, ...file.audioOfGroups].map((x) => x.exam).filter((e) => !e.deletedAt);
  if (exams.length === 0) return false;
  if (exams.some((e) => can(user, "exam.view", { ownerId: e.teacherId }))) return true;
  // Đề đã chia sẻ lên Kho nội dung → ai xem được kho cũng nghe được.
  if (can(user, "content.view")) {
    const shared = await prisma.contentItem.findFirst({
      where: { examId: { in: exams.map((e) => e.id) }, deletedAt: null },
      select: { id: true },
    });
    if (shared) return true;
  }
  const assignment = await prisma.assignment.findFirst({
    where: {
      examId: { in: exams.map((e) => e.id) },
      deletedAt: null,
      OR: [
        { classroom: { deletedAt: null, members: { some: { studentId: user.id } } } },
        openAssignmentWhere(user.id, can(user, "submission.take")),
      ],
    },
    select: { id: true },
  });
  return Boolean(assignment);
}

/**
 * Lọc id file nghe được phép gắn vào đề: file âm thanh do chính người này tải lên,
 * hoặc file đã nằm trong đề đang sửa (`examId`). Trả về các id KHÔNG hợp lệ.
 */
export async function invalidAudioIds(userId: string, ids: string[], examId?: string): Promise<string[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const rows = await prisma.storedFile.findMany({
    where: {
      id: { in: unique },
      mimeType: { startsWith: "audio/" },
      OR: [
        { ownerId: userId },
        ...(examId ? [{ audioOfQuestions: { some: { examId } } }, { audioOfGroups: { some: { examId } } }] : []),
      ],
    },
    select: { id: true },
  });
  const ok = new Set(rows.map((r) => r.id));
  return unique.filter((id) => !ok.has(id));
}
