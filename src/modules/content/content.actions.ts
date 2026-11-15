"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { fail, ok, type ActionResult } from "@/common/filters/error";
import { contentIdSchema, createContentSchema } from "@/modules/content/content.schema";
import {
  copyContentExam,
  createContentItem,
  findFreeOwnFile,
  findOwnExam,
  getContentDetail,
  getContentOwner,
  removeContentItem,
} from "@/modules/content/content.service";
import { CONTENT_PATH } from "@/modules/content/content.types";

const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "Dữ liệu không hợp lệ";

/** "Đóng góp nội dung": chia sẻ đề của mình / file đã tải lên / link video lên kho chung. */
export async function createContentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!can(user, "content.share")) return fail("PERMISSION_DENIED");
  const parsed = createContentSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));

  const data = parsed.data;
  if (data.kind === "EXAM") {
    const exam = await findOwnExam(user.id, data.examId);
    if (!exam) return fail("NOT_FOUND", "Không tìm thấy đề — chỉ chia sẻ được đề do bạn soạn.");
    if (exam.contentItems.length) return fail("CONFLICT", "Đề này đã có trên kho.");
  } else if (data.kind !== "VIDEO") {
    if (!(await findFreeOwnFile(user.id, data.fileId))) return fail("NOT_FOUND", "File không hợp lệ — hãy tải file lên lại.");
  }

  const item = await createContentItem(user.id, data);
  revalidatePath(CONTENT_PATH);
  return ok(item);
}

/** Gỡ nội dung của mình khỏi kho (đề / file vẫn giữ nguyên). */
export async function removeContentAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  const parsed = contentIdSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");

  const item = await getContentOwner(parsed.data.id);
  if (!item) return fail("NOT_FOUND");
  if (!can(user, "content.share", { ownerId: item.ownerId })) return fail("PERMISSION_DENIED");

  await removeContentItem(item.id);
  revalidatePath(CONTENT_PATH);
  if (item.examId) revalidatePath(`/de-thi/${item.examId}`);
  return ok(null);
}

/** "Lưu về thư viện của tôi": chép đề trong kho thành đề mới của mình (sửa / giao được). */
export async function copyContentExamAction(input: unknown): Promise<ActionResult<{ examId: string }>> {
  const user = await requireUser();
  if (!can(user, "content.view") || !can(user, "exam.create")) return fail("PERMISSION_DENIED");
  const parsed = contentIdSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");

  const item = await getContentDetail(parsed.data.id);
  if (!item || item.kind !== "EXAM" || !item.exam) return fail("NOT_FOUND");
  if (item.exam.questions.length === 0) return fail("VALIDATION_ERROR", "Đề không có câu hỏi.");

  const exam = await copyContentExam(item, user.id);
  revalidatePath("/de-thi");
  revalidatePath(`${CONTENT_PATH}/${item.id}`);
  return ok({ examId: exam.id });
}
