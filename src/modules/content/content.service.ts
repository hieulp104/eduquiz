import { prisma } from "@/shared/prisma/prisma.service";
import type { Prisma } from "@/generated/prisma/client";
import { createExam, type ExamCreateData } from "@/modules/exams/exams.service";
import type { CreateContentInput } from "@/modules/content/content.schema";
import { CONTENT_KINDS, hostOf, type ContentCard, type ContentKind, type ShareableExam } from "@/modules/content/content.types";

/** Mục còn hiệu lực: chưa gỡ và nguồn còn (đề chưa xóa / file còn / có link). */
const visibleWhere: Prisma.ContentItemWhereInput = {
  deletedAt: null,
  OR: [
    { kind: "EXAM", exam: { deletedAt: null } },
    { kind: "VIDEO" },
    { kind: { in: ["REFERENCE", "SLIDE", "LESSON_PLAN"] }, fileId: { not: null } },
  ],
};

const cardSelect = {
  id: true,
  kind: true,
  title: true,
  grade: true,
  subject: true,
  downloadCount: true,
  viewCount: true,
  url: true,
  createdAt: true,
  owner: { select: { fullName: true } },
  file: { select: { originalName: true } },
  exam: { select: { _count: { select: { questions: true } } } },
} satisfies Prisma.ContentItemSelect;

type CardRow = Prisma.ContentItemGetPayload<{ select: typeof cardSelect }>;

function toCard(r: CardRow): ContentCard {
  const extra =
    r.kind === "VIDEO" && r.url
      ? hostOf(r.url)
      : r.kind === "EXAM"
        ? `${r.exam?._count.questions ?? 0} câu`
        : (r.file?.originalName.split(".").pop()?.toUpperCase() ?? null);
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    grade: r.grade,
    subject: r.subject,
    ownerName: r.owner.fullName,
    downloadCount: r.downloadCount,
    viewCount: r.viewCount,
    extra,
    createdAt: r.createdAt.toISOString(),
  };
}

export type ContentFilter = { kind?: ContentKind | null; grade?: number | null; q?: string; ownerId?: string };

function filterWhere(f: ContentFilter): Prisma.ContentItemWhereInput {
  const q = f.q?.trim();
  return {
    AND: [
      visibleWhere,
      f.kind ? { kind: f.kind } : {},
      f.grade != null ? { grade: f.grade } : {},
      f.ownerId ? { ownerId: f.ownerId } : {},
      q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { subject: { contains: q, mode: "insensitive" } }] } : {},
    ],
  };
}

export async function listContent(f: ContentFilter, take = 60) {
  const [rows, total] = await Promise.all([
    prisma.contentItem.findMany({ where: filterWhere(f), orderBy: { createdAt: "desc" }, take, select: cardSelect }),
    prisma.contentItem.count({ where: filterWhere(f) }),
  ]);
  return { items: rows.map(toCard), total };
}

/** Trang "Tất cả": mới nhất + vài mục mỗi loại. */
export async function listContentSections(f: Omit<ContentFilter, "kind">, perSection = 9) {
  const [latest, ...byKind] = await Promise.all([
    listContent(f, perSection),
    ...CONTENT_KINDS.map((kind) => listContent({ ...f, kind }, perSection)),
  ]);
  return { latest, byKind: CONTENT_KINDS.map((kind, i) => ({ kind, ...byKind[i] })) };
}

/** Chi tiết 1 mục, kèm đề (câu hỏi + đáp án) nếu là đề thi. */
export async function getContentDetail(id: string) {
  return prisma.contentItem.findFirst({
    where: { id, ...visibleWhere },
    include: {
      owner: { select: { id: true, fullName: true } },
      // objectKey chỉ dùng ở server (route tải về) — không truyền xuống client.
      file: { select: { id: true, originalName: true, mimeType: true, size: true, objectKey: true } },
      exam: {
        include: {
          groups: { orderBy: { order: "asc" } },
          questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } },
        },
      },
    },
  });
}

export type ContentDetail = NonNullable<Awaited<ReturnType<typeof getContentDetail>>>;

/** Đề của giáo viên để chọn khi đóng góp (kèm cờ đã chia sẻ). */
export async function listShareableExams(teacherId: string): Promise<ShareableExam[]> {
  const exams = await prisma.exam.findMany({
    where: { teacherId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      grade: true,
      subject: true,
      description: true,
      _count: { select: { questions: true } },
      contentItems: { where: { deletedAt: null }, select: { id: true } },
    },
  });
  return exams.map((e) => ({
    id: e.id,
    title: e.title,
    grade: e.grade,
    subject: e.subject,
    description: e.description,
    questionCount: e._count.questions,
    sharedId: e.contentItems[0]?.id ?? null,
  }));
}

export async function findOwnExam(teacherId: string, examId: string) {
  return prisma.exam.findFirst({
    where: { id: examId, teacherId, deletedAt: null },
    select: { id: true, contentItems: { where: { deletedAt: null }, select: { id: true } } },
  });
}

/** File của chính người dùng, chưa gắn bài tập / mục kho nào. */
export async function findFreeOwnFile(ownerId: string, fileId: string) {
  return prisma.storedFile.findFirst({
    where: { id: fileId, ownerId, homeworkId: null, contentItem: null },
    select: { id: true },
  });
}

export async function createContentItem(ownerId: string, input: CreateContentInput) {
  const { kind, title, description, grade, subject } = input;
  return prisma.contentItem.create({
    data: {
      ownerId,
      kind,
      title,
      description,
      grade,
      subject,
      examId: input.kind === "EXAM" ? input.examId : null,
      fileId: input.kind === "VIDEO" || input.kind === "EXAM" ? null : input.fileId,
      url: input.kind === "VIDEO" ? input.url : null,
    },
    select: { id: true },
  });
}

export async function getContentOwner(id: string) {
  return prisma.contentItem.findFirst({ where: { id, deletedAt: null }, select: { id: true, ownerId: true, examId: true } });
}

/** Gỡ khỏi kho (xóa mềm). File vẫn giữ, đề vẫn là của người soạn. */
export async function removeContentItem(id: string) {
  await prisma.contentItem.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function countContent(id: string, field: "downloadCount" | "viewCount") {
  await prisma.contentItem.updateMany({ where: { id, deletedAt: null }, data: { [field]: { increment: 1 } } });
}

/** "Lưu về thư viện của tôi": chép đề thành đề mới của `teacherId` (ở thư mục gốc). */
export async function copyContentExam(item: ContentDetail, teacherId: string) {
  const exam = item.exam!;
  const groupIndex = new Map(exam.groups.map((g, i) => [g.id, i]));
  const data: ExamCreateData = {
    title: item.title,
    description: exam.description ?? "",
    durationMinutes: exam.durationMinutes,
    grade: exam.grade,
    subject: exam.subject ?? "",
    purpose: exam.purpose,
    folderId: null,
    groups: exam.groups.map((g) => ({ content: g.content, fixedOrder: g.fixedOrder, audioFileId: g.audioFileId })),
    questions: exam.questions.map((q) => ({
      content: q.content,
      points: q.points,
      level: q.level,
      fixedOptions: q.fixedOptions,
      audioFileId: q.audioFileId,
      groupIndex: q.groupId ? (groupIndex.get(q.groupId) ?? null) : null,
      options: q.options.map((o) => ({ content: o.content, isCorrect: o.isCorrect })),
    })),
  };
  const created = await createExam(teacherId, data);
  await countContent(item.id, "downloadCount");
  return created;
}
