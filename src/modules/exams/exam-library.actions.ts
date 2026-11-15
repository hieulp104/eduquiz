"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { fail, ok, type ActionResult } from "@/common/filters/error";
import { parseFolderXlsx } from "@/modules/exams/folder-import";
import { getBookTree, listBooks } from "@/modules/worksheet/worksheet.service";
import {
  createFolder,
  createFolderTree,
  deleteFolder,
  findFolder,
  isInsideAny,
  moveItems,
  ownersOf,
  renameFolder,
  softDeleteExams,
} from "@/modules/exams/exam-library.service";

const folderName = z.string().trim().min(1, "Vui lòng nhập tên thư mục").max(100, "Tên tối đa 100 ký tự");

const createFolderSchema = z.object({ name: folderName, parentId: z.string().min(1).nullable() });
const renameFolderSchema = z.object({ id: z.string().min(1), name: folderName });
const itemsSchema = z.object({
  examIds: z.array(z.string().min(1)).max(500),
  folderIds: z.array(z.string().min(1)).max(500),
});
const moveSchema = itemsSchema.extend({ targetId: z.string().min(1).nullable() });

export async function createFolderAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!can(user, "exam.create")) return fail("PERMISSION_DENIED");
  const parsed = createFolderSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);

  if (parsed.data.parentId) {
    const parent = await findFolder(user, parsed.data.parentId);
    if (!parent) return fail("NOT_FOUND", "Thư mục cha không còn tồn tại.");
  }
  const folder = await createFolder(user.id, parsed.data.name, parsed.data.parentId);
  revalidatePath("/de-thi");
  return ok(folder);
}

/** Thư mục đích (cha) hợp lệ của user, hoặc null = gốc. Trả "invalid" nếu có id nhưng không hợp lệ. */
async function resolveParent(user: Awaited<ReturnType<typeof requireUser>>, parentId: unknown) {
  if (typeof parentId !== "string" || !parentId) return null;
  const parent = await findFolder(user, parentId);
  return parent && can(user, "exam.update", { ownerId: parent.teacherId }) ? parent.id : ("invalid" as const);
}

/** "Tạo thư mục bằng excel" — FormData: file (.xlsx), parentId. File danh sách tên nên nhỏ (< 1MB). */
export async function importFoldersFromExcelAction(
  formData: FormData,
): Promise<ActionResult<{ created: number; total: number; warnings: string[] }>> {
  const user = await requireUser();
  if (!can(user, "exam.create")) return fail("PERMISSION_DENIED");
  const parentId = await resolveParent(user, formData.get("parentId"));
  if (parentId === "invalid") return fail("NOT_FOUND", "Thư mục cha không còn tồn tại.");

  const file = formData.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) {
    return fail("VALIDATION_ERROR", "Vui lòng chọn file Excel (.xlsx).");
  }

  let parsed;
  try {
    parsed = await parseFolderXlsx(Buffer.from(await file.arrayBuffer()));
  } catch {
    return fail("VALIDATION_ERROR", "Không đọc được file Excel.");
  }
  if (parsed.paths.length === 0) return fail("VALIDATION_ERROR", parsed.warnings[0]);

  const created = await createFolderTree(user.id, parentId, parsed.paths);
  revalidatePath("/de-thi");
  return ok({ created, total: parsed.paths.length, warnings: parsed.warnings });
}

const fromBookSchema = z.object({
  bookId: z.string().min(1),
  depth: z.enum(["topic", "lesson"]),
  parentId: z.string().min(1).nullable(),
});

/**
 * "Tạo thư mục theo sách": 1 thư mục tên sách → con là các Chủ đề (→ các Bài nếu chọn).
 * Lấy cấu trúc từ ngân hàng câu hỏi; tên dài cắt còn 100 ký tự.
 */
export async function createFoldersFromBookAction(input: unknown): Promise<ActionResult<{ created: number }>> {
  const user = await requireUser();
  if (!can(user, "exam.create")) return fail("PERMISSION_DENIED");
  const parsed = fromBookSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");
  const parentId = await resolveParent(user, parsed.data.parentId);
  if (parentId === "invalid") return fail("NOT_FOUND", "Thư mục cha không còn tồn tại.");

  const book = (await listBooks()).find((b) => b.id === parsed.data.bookId);
  if (!book) return fail("NOT_FOUND", "Không tìm thấy sách.");
  const tree = await getBookTree(book.id);
  const cut = (s: string) => s.slice(0, 100);

  const paths: string[][] = [];
  for (const topic of tree) {
    if (parsed.data.depth === "topic" || topic.children.length === 0) paths.push([cut(book.title), cut(topic.title)]);
    else for (const lesson of topic.children) paths.push([cut(book.title), cut(topic.title), cut(lesson.title)]);
  }

  const created = await createFolderTree(user.id, parentId, paths);
  revalidatePath("/de-thi");
  return ok({ created });
}

export async function renameFolderAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  const parsed = renameFolderSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);

  const folder = await findFolder(user, parsed.data.id);
  if (!folder) return fail("NOT_FOUND");
  if (!can(user, "exam.update", { ownerId: folder.teacherId })) return fail("PERMISSION_DENIED");
  await renameFolder(folder.id, parsed.data.name);
  revalidatePath("/de-thi");
  return ok(null);
}

/** Xóa đề + thư mục đã chọn (kèm thư mục con). Đề trong thư mục bị xóa được chuyển lên thư mục cha (không mất). */
export async function deleteItemsAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  const parsed = itemsSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");

  const { exams, folders } = await ownersOf(parsed.data.examIds, parsed.data.folderIds);
  if ([...exams, ...folders].some((x) => !can(user, "exam.update", { ownerId: x.teacherId }))) {
    return fail("PERMISSION_DENIED");
  }

  await softDeleteExams(exams.map((e) => e.id));
  for (const f of folders) {
    const folder = await findFolder(user, f.id);
    if (folder) await deleteFolder(folder.id, folder.parentId);
  }
  revalidatePath("/de-thi");
  return ok(null);
}

export async function moveItemsAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");
  const { examIds, folderIds, targetId } = parsed.data;

  if (targetId) {
    const target = await findFolder(user, targetId);
    if (!target || !can(user, "exam.update", { ownerId: target.teacherId })) return fail("NOT_FOUND", "Thư mục đích không hợp lệ.");
    if (await isInsideAny(targetId, folderIds)) {
      return fail("CONFLICT", "Không thể chuyển thư mục vào chính nó hoặc thư mục con của nó.");
    }
  }

  const { exams, folders } = await ownersOf(examIds, folderIds);
  if (exams.length !== examIds.length || folders.length !== folderIds.length) return fail("NOT_FOUND");
  if ([...exams, ...folders].some((x) => !can(user, "exam.update", { ownerId: x.teacherId }))) {
    return fail("PERMISSION_DENIED");
  }

  await moveItems(examIds, folderIds, targetId);
  revalidatePath("/de-thi");
  return ok(null);
}
