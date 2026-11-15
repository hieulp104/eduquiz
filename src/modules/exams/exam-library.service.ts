import { prisma } from "@/shared/prisma/prisma.service";
import { OPEN_AUDIENCE_NAME } from "@/modules/publish/publish.types";
import { scopeOf, type SessionUser } from "@/common/permissions/permissions";
import type { Prisma } from "@/generated/prisma/client";
import type {
  ExamStatus,
  LibraryExam,
  LibraryFolder,
  LibrarySort,
  SortDir,
} from "@/modules/exams/exam-library.types";

/**
 * Thư viện đề (trang /de-thi): thư mục + đề, kèm số liệu cho từng cột bảng.
 * Phạm vi: ALL (Admin) thấy mọi đề; OWN thấy đề/thư mục mình tạo.
 */


function ownerWhere(user: SessionUser): { teacherId?: string } {
  return scopeOf(user, "exam.view") === "ALL" ? {} : { teacherId: user.id };
}

/** Thư mục thuộc phạm vi user (hoặc null nếu không tồn tại / không phải của mình). */
export async function findFolder(user: SessionUser, folderId: string) {
  return prisma.examFolder.findFirst({
    where: { id: folderId, deletedAt: null, ...ownerWhere(user) },
    select: { id: true, name: true, parentId: true, teacherId: true },
  });
}

/** Đường dẫn từ gốc tới thư mục hiện tại — cho breadcrumb. */
export async function folderPath(user: SessionUser, folderId: string) {
  const path: { id: string; name: string }[] = [];
  let current = await findFolder(user, folderId);
  // Giới hạn độ sâu để dữ liệu hỏng (vòng lặp cha–con) không treo trang.
  for (let depth = 0; current && depth < 20; depth++) {
    path.unshift({ id: current.id, name: current.name });
    current = current.parentId ? await findFolder(user, current.parentId) : null;
  }
  return path;
}

const EXAM_INCLUDE = {
  _count: { select: { questions: true } },
  assignments: {
    where: { deletedAt: null },
    select: {
      openAt: true,
      dueAt: true,
      classroom: { select: { name: true } },
      _count: { select: { submissions: { where: { submittedAt: { not: null } } } } },
    },
  },
} satisfies Prisma.ExamInclude;

type ExamRow = Prisma.ExamGetPayload<{ include: typeof EXAM_INCLUDE }>;

function toLibraryExam(e: ExamRow, now: Date): LibraryExam {
  const a = e.assignments;
  const status: ExamStatus =
    a.length === 0 ? "DRAFT" : a.some((x) => x.openAt <= now && (!x.dueAt || x.dueAt >= now)) ? "OPEN" : "CLOSED";
  const assignedAt = a.length ? new Date(Math.max(...a.map((x) => x.openAt.getTime()))) : null;
  return {
    id: e.id,
    title: e.title,
    durationMinutes: e.durationMinutes,
    questionCount: e._count.questions,
    submittedCount: a.reduce((s, x) => s + x._count.submissions, 0),
    status,
    classNames: [...new Set(a.map((x) => x.classroom?.name ?? OPEN_AUDIENCE_NAME))],
    assignedAt,
    createdAt: e.createdAt,
  };
}

const STATUS_ORDER: Record<ExamStatus, number> = { OPEN: 0, CLOSED: 1, DRAFT: 2 };

function sortExams(list: LibraryExam[], sort: LibrarySort | undefined, dir: SortDir) {
  if (!sort) return list; // mặc định: mới tạo trước (đã sắp ở DB)
  const sign = dir === "asc" ? 1 : -1;
  const key = (e: LibraryExam): number | string => {
    switch (sort) {
      case "name":
        return e.title.toLocaleLowerCase("vi");
      case "submitted":
        return e.submittedCount;
      case "status":
        return STATUS_ORDER[e.status];
      case "assignedAt":
        return e.assignedAt?.getTime() ?? 0;
    }
  };
  return [...list].sort((x, y) => {
    const a = key(x);
    const b = key(y);
    return (typeof a === "string" ? a.localeCompare(b as string, "vi") : a - (b as number)) * sign;
  });
}

/**
 * Nội dung 1 thư mục (folderId = null là gốc).
 * Có từ khóa `q` thì tìm trong TOÀN BỘ đề + thư mục, không giới hạn thư mục hiện tại.
 */
export async function getLibrary(
  user: SessionUser,
  opts: { folderId: string | null; q?: string; sort?: LibrarySort; dir?: SortDir },
) {
  const keyword = opts.q?.trim();
  const scope = ownerWhere(user);
  const nameFilter = keyword ? { contains: keyword, mode: "insensitive" as const } : undefined;

  const [folders, exams] = await Promise.all([
    prisma.examFolder.findMany({
      where: {
        deletedAt: null,
        ...scope,
        ...(keyword ? { name: nameFilter } : { parentId: opts.folderId }),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { children: { where: { deletedAt: null } }, exams: { where: { deletedAt: null } } } },
      },
    }),
    prisma.exam.findMany({
      where: {
        deletedAt: null,
        ...scope,
        ...(keyword ? { title: nameFilter } : { folderId: opts.folderId }),
      },
      orderBy: { createdAt: "desc" },
      include: EXAM_INCLUDE,
    }),
  ]);

  const now = new Date();
  const folderRows: LibraryFolder[] = folders.map((f) => ({
    id: f.id,
    name: f.name,
    createdAt: f.createdAt,
    itemCount: f._count.children + f._count.exams,
  }));
  if (opts.sort === "name" && opts.dir === "desc") folderRows.reverse();

  return {
    folders: folderRows,
    exams: sortExams(
      exams.map((e) => toLibraryExam(e, now)),
      opts.sort,
      opts.dir ?? "asc",
    ),
  };
}

/** "Được đề xuất": 4 đề cập nhật gần nhất, kèm lượt làm. */
export async function getRecommendedExams(user: SessionUser) {
  const rows = await prisma.exam.findMany({
    where: { deletedAt: null, ...ownerWhere(user) },
    orderBy: { updatedAt: "desc" },
    take: 4,
    include: EXAM_INCLUDE,
  });
  const now = new Date();
  return rows.map((e) => toLibraryExam(e, now));
}

/** Mọi thư mục của user — cho ô "Di chuyển vào…". */
export async function listAllFolders(user: SessionUser) {
  return prisma.examFolder.findMany({
    where: { deletedAt: null, ...ownerWhere(user) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, parentId: true },
  });
}

// ═══════════════════ GHI ═══════════════════

export async function createFolder(teacherId: string, name: string, parentId: string | null) {
  return prisma.examFolder.create({ data: { teacherId, name, parentId }, select: { id: true } });
}

export const MAX_FOLDERS_PER_IMPORT = 500;
export const MAX_FOLDER_DEPTH = 5;

/**
 * Tạo cả cây thư mục từ danh sách đường dẫn, VD [["Lớp 6A1", "Chương 1"], ["Lớp 6A1", "Chương 2"]].
 * Thư mục cùng tên ở cùng cấp đã có thì DÙNG LẠI (chạy lại file không sinh trùng).
 * Trả về số thư mục tạo mới.
 */
export async function createFolderTree(teacherId: string, rootParentId: string | null, paths: string[][]) {
  return prisma.$transaction(async (tx) => {
    // Bộ nhớ đệm "id cha|tên" → id, nạp dần theo từng cấp.
    const cache = new Map<string, string>();
    const keyOf = (parentId: string | null, name: string) => `${parentId ?? "root"}|${name.toLocaleLowerCase("vi")}`;
    let created = 0;

    for (const path of paths) {
      let parentId = rootParentId;
      for (const name of path) {
        const key = keyOf(parentId, name);
        let id = cache.get(key);
        if (!id) {
          const existing = await tx.examFolder.findFirst({
            where: { teacherId, parentId, deletedAt: null, name: { equals: name, mode: "insensitive" } },
            select: { id: true },
          });
          id = existing?.id ?? (await tx.examFolder.create({ data: { teacherId, parentId, name }, select: { id: true } })).id;
          if (!existing) created++;
          cache.set(key, id);
        }
        parentId = id;
      }
    }
    return created;
  });
}

export async function renameFolder(folderId: string, name: string) {
  await prisma.examFolder.update({ where: { id: folderId }, data: { name } });
}

/**
 * Xóa thư mục cùng TOÀN BỘ thư mục con (xóa mềm) — nhưng KHÔNG mất đề:
 * mọi đề nằm trong cây đó được chuyển lên thư mục cha của thư mục bị xóa.
 */
export async function deleteFolder(folderId: string, parentId: string | null) {
  const ids = [folderId];
  let frontier = [folderId];
  for (let depth = 0; frontier.length > 0 && depth < 50; depth++) {
    const rows = await prisma.examFolder.findMany({
      where: { parentId: { in: frontier }, deletedAt: null },
      select: { id: true },
    });
    frontier = rows.map((r) => r.id);
    ids.push(...frontier);
  }
  await prisma.$transaction([
    prisma.exam.updateMany({ where: { folderId: { in: ids } }, data: { folderId: parentId } }),
    prisma.examFolder.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } }),
  ]);
  return ids.length;
}

/** Thư mục `targetId` có nằm trong (hoặc chính là) một trong `folderIds` không — chống tạo vòng lặp. */
export async function isInsideAny(targetId: string, folderIds: string[]): Promise<boolean> {
  const blocked = new Set(folderIds);
  let current: string | null = targetId;
  for (let depth = 0; current && depth < 50; depth++) {
    if (blocked.has(current)) return true;
    const row: { parentId: string | null } | null = await prisma.examFolder.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = row?.parentId ?? null;
  }
  return false;
}

export async function moveItems(examIds: string[], folderIds: string[], targetId: string | null) {
  await prisma.$transaction([
    prisma.exam.updateMany({ where: { id: { in: examIds } }, data: { folderId: targetId } }),
    prisma.examFolder.updateMany({ where: { id: { in: folderIds } }, data: { parentId: targetId } }),
  ]);
}

/** Lấy chủ sở hữu của các đề / thư mục để kiểm quyền hàng loạt. */
export async function ownersOf(examIds: string[], folderIds: string[]) {
  const [exams, folders] = await Promise.all([
    prisma.exam.findMany({ where: { id: { in: examIds }, deletedAt: null }, select: { id: true, teacherId: true } }),
    prisma.examFolder.findMany({ where: { id: { in: folderIds }, deletedAt: null }, select: { id: true, teacherId: true } }),
  ]);
  return { exams, folders };
}

export async function softDeleteExams(examIds: string[]) {
  await prisma.exam.updateMany({ where: { id: { in: examIds } }, data: { deletedAt: new Date() } });
}
