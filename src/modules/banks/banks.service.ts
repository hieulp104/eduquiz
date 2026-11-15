import { randomInt } from "node:crypto";
import { prisma } from "@/shared/prisma/prisma.service";
import type { Prisma } from "@/generated/prisma/client";
import { scopeOf, type SessionUser } from "@/common/permissions/permissions";
import { createExam, type ExamCreateData } from "@/modules/exams/exams.service";
import { distributePoints } from "@/modules/exams/exam-points";
import { LEVEL_DB, LEVEL_FROM_DB, type Level } from "@/modules/exams/exam-text";
import { itemCode, subtreeIds, type BankBookOption, type BankCard, type BankItemView, type MatrixLevel, type SectionRow } from "@/modules/banks/banks.types";

// ═══════════════════ Ngân hàng ═══════════════════

const ownerWhere = (user: SessionUser): Prisma.QuestionBankWhereInput =>
  scopeOf(user, "bank.manage") === "ALL" ? { deletedAt: null } : { deletedAt: null, ownerId: user.id };

export async function listBanks(user: SessionUser): Promise<BankCard[]> {
  const rows = await prisma.questionBank.findMany({
    where: ownerWhere(user),
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      grade: true,
      subject: true,
      updatedAt: true,
      bookId: true,
      book: { select: { title: true } },
      _count: { select: { items: true } },
    },
  });
  return rows.map((b) => ({
    bookId: b.bookId,
    id: b.id,
    name: b.name,
    grade: b.grade,
    subject: b.subject,
    bookTitle: b.book?.title ?? null,
    itemCount: b._count.items,
    updatedAt: b.updatedAt.toISOString(),
  }));
}

/** Sách có mục lục trong Ngân hàng chung (nút gốc). */
export async function listBookOptions(): Promise<BankBookOption[]> {
  return prisma.questionBankNode.findMany({
    where: { parentId: null },
    orderBy: [{ grade: "asc" }, { title: "asc" }],
    select: { id: true, title: true, grade: true, subject: true },
  });
}

export async function isBook(id: string) {
  return Boolean(await prisma.questionBankNode.findFirst({ where: { id, parentId: null }, select: { id: true } }));
}

/** Ngân hàng (chưa xóa) + chủ — để kiểm quyền. */
export async function getBankOwner(id: string) {
  return prisma.questionBank.findFirst({ where: { id, deletedAt: null }, select: { id: true, ownerId: true, name: true } });
}

export async function getBank(user: SessionUser, id: string) {
  return prisma.questionBank.findFirst({
    where: { id, ...ownerWhere(user) },
    select: {
      id: true,
      name: true,
      grade: true,
      subject: true,
      bookId: true,
      ownerId: true,
      book: { select: { title: true } },
      _count: { select: { items: true } },
    },
  });
}

export async function createBank(ownerId: string, data: { name: string; grade: number | null; subject: string | null; bookId: string | null }) {
  return prisma.$transaction(async (tx) => {
    const bank = await tx.questionBank.create({ data: { ownerId, ...data }, select: { id: true } });
    await tx.bankActivity.create({ data: { bankId: bank.id, actorId: ownerId, message: `Thêm mới ngân hàng câu hỏi “${data.name}”` } });
    return bank;
  });
}

export async function updateBank(id: string, data: { name: string; grade: number | null; subject: string | null; bookId: string | null }) {
  await prisma.questionBank.update({ where: { id }, data });
}

export async function softDeleteBank(id: string) {
  await prisma.questionBank.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function logActivity(bankId: string, actorId: string, message: string) {
  await prisma.$transaction([
    prisma.bankActivity.create({ data: { bankId, actorId, message } }),
    // Đổi updatedAt để ngân hàng vừa sửa lên đầu danh sách.
    prisma.questionBank.update({ where: { id: bankId }, data: { updatedAt: new Date() } }),
  ]);
}

export async function listActivities(bankId: string) {
  return prisma.bankActivity.findMany({
    where: { bankId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, message: true, createdAt: true, actor: { select: { fullName: true } } },
  });
}

/** "Copy ngân hàng": chép cấu trúc + câu hỏi thành ngân hàng mới của `ownerId`. */
export async function copyBank(bankId: string, ownerId: string) {
  const src = await prisma.questionBank.findUniqueOrThrow({
    where: { id: bankId },
    include: { sections: true, items: { orderBy: { createdAt: "asc" } } },
  });
  return prisma.$transaction(
    async (tx) => {
      const bank = await tx.questionBank.create({
        data: { ownerId, name: `${src.name} (bản sao)`.slice(0, 150), grade: src.grade, subject: src.subject, bookId: src.bookId },
        select: { id: true },
      });
      // Tạo mục cha trước con: lặp theo tầng.
      const newId = new Map<string, string>();
      let pending = [...src.sections];
      while (pending.length) {
        const ready = pending.filter((s) => !s.parentId || newId.has(s.parentId));
        if (!ready.length) break;
        for (const s of ready) {
          const row = await tx.bankSection.create({
            data: { bankId: bank.id, parentId: s.parentId ? newId.get(s.parentId)! : null, title: s.title, order: s.order },
            select: { id: true },
          });
          newId.set(s.id, row.id);
        }
        pending = pending.filter((s) => !newId.has(s.id));
      }
      await tx.bankItem.createMany({
        data: src.items.map((i) => ({
          bankId: bank.id,
          sectionId: i.sectionId ? (newId.get(i.sectionId) ?? null) : null,
          content: i.content,
          options: i.options,
          correctIndex: i.correctIndex,
          level: i.level,
        })),
      });
      await tx.bankActivity.create({
        data: { bankId: bank.id, actorId: ownerId, message: `Sao chép từ ngân hàng “${src.name}” (${src.items.length} câu hỏi)` },
      });
      return bank;
    },
    { timeout: 60_000 },
  );
}

// ═══════════════════ Cấu trúc ═══════════════════

export async function listSections(bankId: string): Promise<SectionRow[]> {
  const rows = await prisma.bankSection.findMany({
    where: { bankId },
    orderBy: { order: "asc" },
    select: { id: true, parentId: true, title: true, order: true, _count: { select: { items: true } } },
  });
  return rows.map(({ _count, ...r }) => ({ ...r, itemCount: _count.items }));
}

export async function getSection(id: string) {
  return prisma.bankSection.findUnique({ where: { id }, select: { id: true, bankId: true, parentId: true, title: true, order: true } });
}

export async function addSections(bankId: string, parentId: string | null, titles: string[]) {
  const last = await prisma.bankSection.findFirst({ where: { bankId, parentId }, orderBy: { order: "desc" }, select: { order: true } });
  const start = (last?.order ?? 0) + 1;
  await prisma.bankSection.createMany({ data: titles.map((title, i) => ({ bankId, parentId, title, order: start + i })) });
}

export async function renameSection(id: string, title: string) {
  await prisma.bankSection.update({ where: { id }, data: { title } });
}

/** Xóa chương / bài và cả mục con; câu hỏi bên trong về "Chưa xếp bài" (không mất câu). */
export async function deleteSection(bankId: string, id: string) {
  const all = await prisma.bankSection.findMany({ where: { bankId }, select: { id: true, parentId: true } });
  const ids = subtreeIds(all, id);
  await prisma.$transaction([
    prisma.bankItem.updateMany({ where: { sectionId: { in: [...ids] } }, data: { sectionId: null } }),
    prisma.bankSection.delete({ where: { id } }),
  ]);
  return ids.size;
}

/** Đổi chỗ với mục liền trên / dưới cùng cấp. */
export async function moveSection(section: { id: string; bankId: string; parentId: string | null; order: number }, direction: "up" | "down") {
  const neighbor = await prisma.bankSection.findFirst({
    where: {
      bankId: section.bankId,
      parentId: section.parentId,
      order: direction === "up" ? { lt: section.order } : { gt: section.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select: { id: true, order: true },
  });
  if (!neighbor) return;
  await prisma.$transaction([
    prisma.bankSection.update({ where: { id: section.id }, data: { order: neighbor.order } }),
    prisma.bankSection.update({ where: { id: neighbor.id }, data: { order: section.order } }),
  ]);
}

/**
 * "Tạo cấu trúc theo sách": chép chủ đề → bài của sách (Ngân hàng chung) thành chương → bài.
 * Bỏ tầng "dạng" (quá chi tiết cho ngân hàng riêng). Chỉ chạy khi ngân hàng chưa có cấu trúc.
 */
export async function buildSectionsFromBook(bankId: string, bookId: string) {
  const topics = await prisma.questionBankNode.findMany({
    where: { parentId: bookId },
    orderBy: { order: "asc" },
    select: { title: true, children: { orderBy: { order: "asc" }, select: { title: true } } },
  });
  await prisma.$transaction(async (tx) => {
    for (const [ti, t] of topics.entries()) {
      const chapter = await tx.bankSection.create({ data: { bankId, parentId: null, title: t.title, order: ti + 1 }, select: { id: true } });
      await tx.bankSection.createMany({ data: t.children.map((l, li) => ({ bankId, parentId: chapter.id, title: l.title, order: li + 1 })) });
    }
  });
  return topics.reduce((s, t) => s + 1 + t.children.length, 0);
}

// ═══════════════════ Câu hỏi ═══════════════════

type ItemRow = { id: string; sectionId: string | null; content: string; options: string[]; correctIndex: number; level: keyof typeof LEVEL_FROM_DB | null };

const toView = (i: ItemRow): BankItemView => ({ ...i, level: i.level ? LEVEL_FROM_DB[i.level] : null, code: itemCode(i.id) });

const itemSelect = { id: true, sectionId: true, content: true, options: true, correctIndex: true, level: true } as const;

export async function listItems(bankId: string): Promise<BankItemView[]> {
  const rows = await prisma.bankItem.findMany({ where: { bankId }, orderBy: { createdAt: "asc" }, select: itemSelect });
  return rows.map(toView);
}

export async function sectionInBank(bankId: string, sectionId: string) {
  return Boolean(await prisma.bankSection.findFirst({ where: { id: sectionId, bankId }, select: { id: true } }));
}

export async function addItems(
  bankId: string,
  sectionId: string | null,
  items: { content: string; options: string[]; correctIndex: number; level: Level | null }[],
) {
  await prisma.bankItem.createMany({
    data: items.map((i) => ({ bankId, sectionId, content: i.content, options: i.options, correctIndex: i.correctIndex, level: i.level ? LEVEL_DB[i.level] : null })),
  });
}

export async function getItemBank(id: string) {
  return prisma.bankItem.findUnique({ where: { id }, select: { id: true, bankId: true } });
}

export async function updateItem(id: string, data: { level?: Level | null; sectionId?: string | null }) {
  await prisma.bankItem.update({
    where: { id },
    data: {
      ...(data.level !== undefined ? { level: data.level ? LEVEL_DB[data.level] : null } : {}),
      ...(data.sectionId !== undefined ? { sectionId: data.sectionId } : {}),
    },
  });
}

export async function deleteItems(bankId: string, ids: string[]) {
  return (await prisma.bankItem.deleteMany({ where: { bankId, id: { in: ids } } })).count;
}

// ═══════════════════ Tạo đề ═══════════════════

/** Số câu có sẵn theo (bài, mức độ) — cho bảng ma trận. Khóa "<sectionId|__none>:<NB|TH|VD|NONE>". */
export async function matrixAvailability(bankId: string): Promise<Record<string, number>> {
  const rows = await prisma.bankItem.groupBy({ by: ["sectionId", "level"], where: { bankId }, _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [`${r.sectionId ?? "__none"}:${r.level ? LEVEL_FROM_DB[r.level] : "NONE"}`, r._count._all]));
}

/** Bốc ngẫu nhiên đúng số câu cho từng ô; thiếu câu → trả lỗi. */
export async function pickMatrixItems(bankId: string, rows: { sectionId: string | null; level: MatrixLevel; count: number }[]) {
  const picked: string[] = [];
  for (const r of rows) {
    const pool = await prisma.bankItem.findMany({
      where: { bankId, sectionId: r.sectionId, level: r.level === "NONE" ? null : LEVEL_DB[r.level] },
      select: { id: true },
    });
    if (pool.length < r.count) return { error: `Có ô cần ${r.count} câu nhưng ngân hàng chỉ có ${pool.length} câu.`, ids: [] };
    const ids = pool.map((p) => p.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    picked.push(...ids.slice(0, r.count));
  }
  return { error: null, ids: picked };
}

/** Câu (theo đúng thứ tự `ids`) → đề mới ở thư mục gốc, tổng 10 điểm chia đều. Lấy lại câu từ DB — không tin client. */
export async function createExamFromItems(
  bank: { id: string; grade: number | null; subject: string | null },
  teacherId: string,
  ids: string[],
  settings: { title: string; durationMinutes: number },
) {
  const rows = await prisma.bankItem.findMany({ where: { bankId: bank.id, id: { in: ids } }, select: itemSelect });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const items = ids.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r));
  if (items.length !== new Set(ids).size) return null;
  const { points } = distributePoints(items.length, [], 10);
  const data: ExamCreateData = {
    title: settings.title,
    description: "",
    durationMinutes: settings.durationMinutes,
    grade: bank.grade,
    subject: bank.subject ?? "",
    purpose: null,
    folderId: null,
    questions: items.map((q, i) => ({
      content: q.content,
      points: points[i],
      level: q.level,
      options: q.options.map((content, oi) => ({ content, isCorrect: oi === q.correctIndex })),
    })),
  };
  return createExam(teacherId, data);
}
