import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/common/guards/page.guard";
import { getBank, listSections, matrixAvailability } from "@/modules/banks/banks.service";
import { buildSectionTree, flattenTree, MATRIX_LEVELS, UNSORTED, type MatrixLevel } from "@/modules/banks/banks.types";
import { BankHeader } from "@/modules/banks/components/bank-header";
import { MatrixForm, type MatrixRow } from "@/modules/banks/components/matrix-form";

export const metadata: Metadata = { title: "Tạo ma trận đề thi" };

export default async function MatrixPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("bank.manage");
  const bank = await getBank(user, id);
  if (!bank) notFound();
  const [sections, avail] = await Promise.all([listSections(bank.id), matrixAvailability(bank.id)]);
  const availOf = (sid: string) => Object.fromEntries(MATRIX_LEVELS.map((l) => [l, avail[`${sid}:${l}`] ?? 0])) as Record<MatrixLevel, number>;
  const rows: MatrixRow[] = [
    ...flattenTree(buildSectionTree(sections)).map((n) => ({ id: n.id, title: n.title, depth: n.depth, avail: availOf(n.id) })),
    { id: UNSORTED, title: "Chưa xếp bài", depth: 0, avail: availOf(UNSORTED) },
  ].filter((r) => r.id !== UNSORTED || MATRIX_LEVELS.some((l) => r.avail[l] > 0));
  return (
    <div className="space-y-4">
      <BankHeader bank={{ id: bank.id, name: bank.name, itemCount: bank._count.items }} tab={null} />
      <MatrixForm bankId={bank.id} bankName={bank.name} rows={rows} />
    </div>
  );
}
