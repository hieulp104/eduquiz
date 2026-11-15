/** Ngân hàng câu hỏi riêng — kiểu dữ liệu + tiện ích client-safe (không import gì phía server). */
import type { Level } from "@/modules/exams/exam-text";

export const BANKS_PATH = "/ngan-hang";

/** Khóa "chưa xếp bài" (câu có sectionId = null). */
export const UNSORTED = "__none";

export type BankCard = {
  id: string;
  name: string;
  grade: number | null;
  subject: string | null;
  bookId: string | null;
  bookTitle: string | null;
  itemCount: number;
  updatedAt: string;
};

export type BankBookOption = { id: string; title: string; grade: number | null; subject: string | null };

export type SectionRow = { id: string; parentId: string | null; title: string; order: number; itemCount: number };

export type BankItemView = {
  id: string;
  sectionId: string | null;
  content: string;
  options: string[];
  correctIndex: number;
  level: Level | null;
  /** Mã ngắn để tìm nhanh (6 ký tự cuối id, viết hoa). */
  code: string;
};

export const itemCode = (id: string) => id.slice(-6).toUpperCase();

export type SectionTreeNode = SectionRow & { children: SectionTreeNode[]; depth: number; total: number };

/** Danh sách phẳng → cây (sắp theo order), kèm tổng số câu cả cây con. */
export function buildSectionTree(rows: SectionRow[]): SectionTreeNode[] {
  const byParent = new Map<string | null, SectionRow[]>();
  for (const r of rows) byParent.set(r.parentId, [...(byParent.get(r.parentId) ?? []), r]);
  const build = (parentId: string | null, depth: number): SectionTreeNode[] =>
    (byParent.get(parentId) ?? [])
      .sort((a, b) => a.order - b.order)
      .map((r) => {
        const children = build(r.id, depth + 1);
        return { ...r, children, depth, total: r.itemCount + children.reduce((s, c) => s + c.total, 0) };
      });
  return build(null, 0);
}

/** Cây → danh sách phẳng theo thứ tự hiển thị. */
export const flattenTree = (nodes: SectionTreeNode[]): SectionTreeNode[] => nodes.flatMap((n) => [n, ...flattenTree(n.children)]);

/** id của nút + mọi nút con cháu. */
export function subtreeIds(rows: Pick<SectionRow, "id" | "parentId">[], id: string): Set<string> {
  const out = new Set([id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const r of rows) {
      if (r.parentId && out.has(r.parentId) && !out.has(r.id)) {
        out.add(r.id);
        grew = true;
      }
    }
  }
  return out;
}

/** Ô ma trận: số câu có sẵn của 1 bài theo mức độ ("NONE" = chưa gắn mức). */
export type MatrixLevel = Level | "NONE";
export const MATRIX_LEVELS: MatrixLevel[] = ["NB", "TH", "VD", "NONE"];
export const MATRIX_LEVEL_LABEL: Record<MatrixLevel, string> = { NB: "Nhận biết", TH: "Thông hiểu", VD: "Vận dụng", NONE: "Chưa phân mức" };
