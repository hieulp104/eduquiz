"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/auth.service";
import { can, type SessionUser } from "@/common/permissions/permissions";
import { fail, ok, type ActionFailure, type ActionResult } from "@/common/filters/error";
import {
  addSectionsSchema,
  bankIdSchema,
  createBankSchema,
  deleteItemsSchema,
  examFromItemsSchema,
  examFromMatrixSchema,
  importItemsSchema,
  moveSectionSchema,
  renameSectionSchema,
  updateBankSchema,
  updateItemSchema,
} from "@/modules/banks/banks.schema";
import {
  addItems,
  addSections,
  buildSectionsFromBook,
  copyBank,
  createBank,
  createExamFromItems,
  deleteItems,
  deleteSection,
  getBank,
  getBankOwner,
  getItemBank,
  getSection,
  isBook,
  listSections,
  logActivity,
  moveSection,
  pickMatrixItems,
  renameSection,
  sectionInBank,
  softDeleteBank,
  updateBank,
  updateItem,
} from "@/modules/banks/banks.service";
import { BANKS_PATH } from "@/modules/banks/banks.types";

const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "Dữ liệu không hợp lệ";

/** Ngân hàng tồn tại và user được sửa (chủ / Admin). */
async function ownBank(user: SessionUser, bankId: string): Promise<{ id: string; name: string } | ActionFailure> {
  const bank = await getBankOwner(bankId);
  if (!bank) return fail("NOT_FOUND", "Không tìm thấy ngân hàng.");
  if (!can(user, "bank.manage", { ownerId: bank.ownerId })) return fail("PERMISSION_DENIED");
  return bank;
}
const isFail = (x: unknown): x is ActionFailure => typeof x === "object" && x !== null && "ok" in x && x.ok === false;

const refresh = (bankId?: string) => {
  revalidatePath(BANKS_PATH);
  if (bankId) revalidatePath(`${BANKS_PATH}/${bankId}`);
};

// ═══════════════════ Ngân hàng ═══════════════════

export async function createBankAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!can(user, "bank.manage")) return fail("PERMISSION_DENIED");
  const parsed = createBankSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  if (parsed.data.bookId && !(await isBook(parsed.data.bookId))) return fail("NOT_FOUND", "Không tìm thấy sách.");

  const bank = await createBank(user.id, parsed.data);
  refresh();
  return ok(bank);
}

export async function updateBankAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  const parsed = updateBankSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  const bank = await ownBank(user, parsed.data.id);
  if (isFail(bank)) return bank;
  if (parsed.data.bookId && !(await isBook(parsed.data.bookId))) return fail("NOT_FOUND", "Không tìm thấy sách.");

  const { id, ...data } = parsed.data;
  await updateBank(id, data);
  await logActivity(id, user.id, "Sửa thông tin ngân hàng");
  refresh(id);
  return ok(null);
}

export async function deleteBankAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  const parsed = bankIdSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");
  const bank = await ownBank(user, parsed.data.id);
  if (isFail(bank)) return bank;

  await softDeleteBank(bank.id);
  refresh();
  return ok(null);
}

export async function copyBankAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = bankIdSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");
  const bank = await ownBank(user, parsed.data.id);
  if (isFail(bank)) return bank;

  const copy = await copyBank(bank.id, user.id);
  refresh();
  return ok(copy);
}

// ═══════════════════ Cấu trúc ═══════════════════

export async function addSectionsAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser();
  const parsed = addSectionsSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  const { bankId, parentId, titles } = parsed.data;
  const bank = await ownBank(user, bankId);
  if (isFail(bank)) return bank;
  if (parentId && !(await sectionInBank(bankId, parentId))) return fail("NOT_FOUND", "Không tìm thấy mục cha.");

  await addSections(bankId, parentId, titles);
  await logActivity(bankId, user.id, titles.length === 1 ? `Thêm cấu trúc “${titles[0]}”` : `Thêm ${titles.length} mục cấu trúc`);
  refresh(bankId);
  return ok({ count: titles.length });
}

export async function buildFromBookAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser();
  const parsed = bankIdSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");
  const bank = await ownBank(user, parsed.data.id);
  if (isFail(bank)) return bank;
  const full = await getBank(user, bank.id);
  if (!full?.bookId) return fail("VALIDATION_ERROR", "Ngân hàng chưa chọn sách — sửa thông tin ngân hàng để chọn sách.");
  if ((await listSections(bank.id)).length) return fail("CONFLICT", "Ngân hàng đã có cấu trúc.");

  const count = await buildSectionsFromBook(bank.id, full.bookId);
  await logActivity(bank.id, user.id, `Tạo cấu trúc theo sách “${full.book?.title}” (${count} mục)`);
  refresh(bank.id);
  return ok({ count });
}

/** Sửa / xóa / di chuyển 1 mục cấu trúc: kiểm mục thuộc ngân hàng của user. */
async function ownSection(user: SessionUser, sectionId: string) {
  const section = await getSection(sectionId);
  if (!section) return fail("NOT_FOUND", "Không tìm thấy mục.");
  const bank = await ownBank(user, section.bankId);
  if (isFail(bank)) return bank;
  return section;
}

export async function renameSectionAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  const parsed = renameSectionSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  const section = await ownSection(user, parsed.data.id);
  if (isFail(section)) return section;

  await renameSection(section.id, parsed.data.title);
  await logActivity(section.bankId, user.id, `Đổi tên “${section.title}” → “${parsed.data.title}”`);
  refresh(section.bankId);
  return ok(null);
}

export async function deleteSectionAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  const parsed = bankIdSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");
  const section = await ownSection(user, parsed.data.id);
  if (isFail(section)) return section;

  await deleteSection(section.bankId, section.id);
  await logActivity(section.bankId, user.id, `Xóa cấu trúc “${section.title}” (câu hỏi bên trong chuyển về “Chưa xếp bài”)`);
  refresh(section.bankId);
  return ok(null);
}

export async function moveSectionAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  const parsed = moveSectionSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");
  const section = await ownSection(user, parsed.data.id);
  if (isFail(section)) return section;

  await moveSection(section, parsed.data.direction);
  refresh(section.bankId);
  return ok(null);
}

// ═══════════════════ Câu hỏi ═══════════════════

export async function importItemsAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser();
  const parsed = importItemsSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  const { bankId, sectionId, items } = parsed.data;
  const bank = await ownBank(user, bankId);
  if (isFail(bank)) return bank;
  const section = sectionId ? await getSection(sectionId) : null;
  if (sectionId && section?.bankId !== bankId) return fail("NOT_FOUND", "Không tìm thấy bài.");

  await addItems(bankId, sectionId, items);
  await logActivity(bankId, user.id, `Nhập ${items.length} câu hỏi vào ${section ? `“${section.title}”` : "“Chưa xếp bài”"}`);
  refresh(bankId);
  return ok({ count: items.length });
}

export async function updateItemAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  const parsed = updateItemSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");
  const item = await getItemBank(parsed.data.id);
  if (!item) return fail("NOT_FOUND");
  const bank = await ownBank(user, item.bankId);
  if (isFail(bank)) return bank;
  if (parsed.data.sectionId && !(await sectionInBank(item.bankId, parsed.data.sectionId))) return fail("NOT_FOUND", "Không tìm thấy bài.");

  await updateItem(item.id, parsed.data);
  refresh(item.bankId);
  return ok(null);
}

export async function deleteItemsAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser();
  const parsed = deleteItemsSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");
  const bank = await ownBank(user, parsed.data.bankId);
  if (isFail(bank)) return bank;

  const count = await deleteItems(bank.id, parsed.data.ids);
  await logActivity(bank.id, user.id, `Xóa ${count} câu hỏi`);
  refresh(bank.id);
  return ok({ count });
}

// ═══════════════════ Tạo đề ═══════════════════

async function makeExam(user: SessionUser, bankId: string, ids: string[], settings: { title: string; durationMinutes: number }, how: string) {
  const bank = await getBank(user, bankId);
  if (!bank) return fail("NOT_FOUND", "Không tìm thấy ngân hàng.");
  const exam = await createExamFromItems(bank, user.id, ids, settings);
  if (!exam) return fail("NOT_FOUND", "Có câu hỏi không còn trong ngân hàng — tải lại trang.");
  await logActivity(bank.id, user.id, `Tạo đề “${settings.title}” (${ids.length} câu, ${how})`);
  revalidatePath("/de-thi");
  refresh(bank.id);
  return ok({ examId: exam.id });
}

export async function examFromItemsAction(input: unknown): Promise<ActionResult<{ examId: string }>> {
  const user = await requireUser();
  if (!can(user, "exam.create")) return fail("PERMISSION_DENIED");
  const parsed = examFromItemsSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  const bank = await ownBank(user, parsed.data.bankId);
  if (isFail(bank)) return bank;

  const { title, durationMinutes, itemIds } = parsed.data;
  return makeExam(user, bank.id, [...new Set(itemIds)], { title, durationMinutes }, "tự chọn");
}

export async function examFromMatrixAction(input: unknown): Promise<ActionResult<{ examId: string }>> {
  const user = await requireUser();
  if (!can(user, "exam.create")) return fail("PERMISSION_DENIED");
  const parsed = examFromMatrixSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  const bank = await ownBank(user, parsed.data.bankId);
  if (isFail(bank)) return bank;
  const total = parsed.data.rows.reduce((s, r) => s + r.count, 0);
  if (total > 200) return fail("VALIDATION_ERROR", "Đề tối đa 200 câu.");

  const picked = await pickMatrixItems(bank.id, parsed.data.rows);
  if (picked.error) return fail("VALIDATION_ERROR", picked.error);
  const { title, durationMinutes } = parsed.data;
  return makeExam(user, bank.id, picked.ids, { title, durationMinutes }, "ma trận");
}
