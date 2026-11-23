import { prisma } from "@/shared/prisma/prisma.service";
import type {
  BankBook,
  BankTreeNode,
  WorksheetQuestion,
} from "@/modules/worksheet/worksheet.types";

/** Sách trong ngân hàng chung (nút gốc) của mọi môn, lọc theo lớp nếu có. */
export async function listBooks(grade?: number): Promise<BankBook[]> {
  const rows = await prisma.questionBankNode.findMany({
    where: { parentId: null, ...(grade ? { grade } : {}) },
    orderBy: [{ grade: "asc" }, { order: "asc" }],
    select: { id: true, grade: true, subject: true, title: true },
  });
  return rows.map((r) => ({
    id: r.id,
    grade: r.grade ?? 0,
    subject: r.subject ?? "",
    title: r.title,
  }));
}

/** Lấy toàn bộ nút thuộc 1 sách (cây nhỏ, vài trăm nút) — duyệt trong bộ nhớ. */
async function loadBookNodes(bookId: string) {
  const all: {
    id: string;
    parentId: string | null;
    title: string;
    order: number;
  }[] = [];
  let frontier = [bookId];
  while (frontier.length > 0) {
    const rows = await prisma.questionBankNode.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true, parentId: true, title: true, order: true },
    });
    all.push(...rows);
    frontier = rows.map((r) => r.id);
  }
  return all;
}

/** Cây kiến thức của sách, mỗi nút kèm tổng số câu trong nhánh. */
export async function getBookTree(bookId: string): Promise<BankTreeNode[]> {
  const nodes = await loadBookNodes(bookId);
  const counts = await prisma.bankQuestion.groupBy({
    by: ["nodeId"],
    where: { nodeId: { in: nodes.map((n) => n.id) } },
    _count: { _all: true },
  });
  const countBy = new Map(counts.map((c) => [c.nodeId, c._count._all]));

  const build = (parentId: string): BankTreeNode[] =>
    nodes
      .filter((n) => n.parentId === parentId)
      .sort((a, b) => a.order - b.order)
      .map((n) => {
        const children = build(n.id);
        const count =
          (countBy.get(n.id) ?? 0) + children.reduce((s, c) => s + c.count, 0);
        return { id: n.id, title: n.title, count, children };
      });
  return build(bookId);
}

/** Sách + số chủ đề / số bài — cho "Tạo thư mục theo sách" (chỉ đếm, không tải câu hỏi). */
export async function listBookOutlines() {
  const books = await listBooks();
  return Promise.all(
    books.map(async (b) => {
      const topics = await prisma.questionBankNode.findMany({
        where: { parentId: b.id },
        select: { _count: { select: { children: true } } },
      });
      return {
        id: b.id,
        title: b.title,
        topicCount: topics.length,
        lessonCount: topics.reduce((s, t) => s + t._count.children, 0),
      };
    }),
  );
}

/** Id của nút + mọi nút con cháu. */
async function subtreeIds(nodeId: string): Promise<string[]> {
  const ids = [nodeId];
  let frontier = [nodeId];
  while (frontier.length > 0) {
    const rows = await prisma.questionBankNode.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = rows.map((r) => r.id);
    ids.push(...frontier);
  }
  return ids;
}

/** Chọn ngẫu nhiên 1 câu trong nhánh, bỏ qua các câu đã có trên phiếu. */
export async function pickRandomQuestion(
  nodeId: string,
  excludeIds: string[],
): Promise<WorksheetQuestion | null> {
  const where = {
    nodeId: { in: await subtreeIds(nodeId) },
    id: { notIn: excludeIds },
  };
  const total = await prisma.bankQuestion.count({ where });
  if (total === 0) return null;
  const [q] = await prisma.bankQuestion.findMany({
    where,
    orderBy: { id: "asc" },
    skip: Math.floor(Math.random() * total),
    take: 1,
    select: {
      id: true,
      nodeId: true,
      type: true,
      content: true,
      options: true,
      correctIndex: true,
    },
  });
  return q ?? null;
}

/** Bốc ngẫu nhiên tối đa `count` câu khác nhau trong nhánh (cho ma trận đề). */
export async function pickRandomQuestions(
  nodeId: string,
  count: number,
  excludeIds: string[] = [],
): Promise<string[]> {
  const rows = await prisma.bankQuestion.findMany({
    where: {
      nodeId: { in: await subtreeIds(nodeId) },
      id: { notIn: excludeIds },
    },
    select: { id: true },
  });
  const ids = rows.map((r) => r.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, count);
}

/** Nút có thuộc sách `bookId` không (đi ngược lên gốc). */
export async function nodeBelongsToBook(
  nodeId: string,
  bookId: string,
): Promise<boolean> {
  let current: string | null = nodeId;
  for (let depth = 0; current && depth < 10; depth++) {
    if (current === bookId) return true;
    const row: { parentId: string | null } | null =
      await prisma.questionBankNode.findUnique({
        where: { id: current },
        select: { parentId: true },
      });
    current = row?.parentId ?? null;
  }
  return false;
}

/** Lấy lại câu hỏi từ DB theo đúng thứ tự trên phiếu — không tin nội dung client gửi lên. */
export async function getQuestionsInOrder(
  ids: string[],
): Promise<WorksheetQuestion[]> {
  const rows = await prisma.bankQuestion.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      nodeId: true,
      type: true,
      content: true,
      options: true,
      correctIndex: true,
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}
