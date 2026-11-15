import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/common/guards/page.guard";
import { getBank, listSections } from "@/modules/banks/banks.service";
import { buildSectionTree, flattenTree } from "@/modules/banks/banks.types";
import { BankHeader } from "@/modules/banks/components/bank-header";
import { ImportItems } from "@/modules/banks/components/import-items";

export const metadata: Metadata = { title: "Nhập câu hỏi" };

export default async function ImportItemsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ bai?: string }> }) {
  const { id } = await params;
  const { bai } = await searchParams;
  const user = await requirePagePermission("bank.manage");
  const bank = await getBank(user, id);
  if (!bank) notFound();
  const flat = flattenTree(buildSectionTree(await listSections(bank.id)));
  return (
    <div className="space-y-4">
      <BankHeader bank={{ id: bank.id, name: bank.name, itemCount: bank._count.items }} tab={null} />
      <ImportItems
        bankId={bank.id}
        sections={flat.map((n) => ({ id: n.id, title: n.title, depth: n.depth }))}
        initialSection={bai && flat.some((n) => n.id === bai) ? bai : null}
      />
    </div>
  );
}
