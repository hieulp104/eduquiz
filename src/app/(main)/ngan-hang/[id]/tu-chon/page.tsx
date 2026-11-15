import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/common/guards/page.guard";
import { getBank, listItems, listSections } from "@/modules/banks/banks.service";
import { buildSectionTree, flattenTree } from "@/modules/banks/banks.types";
import { BankHeader } from "@/modules/banks/components/bank-header";
import { PickItems } from "@/modules/banks/components/pick-items";

export const metadata: Metadata = { title: "Tự chọn câu hỏi" };

export default async function PickItemsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("bank.manage");
  const bank = await getBank(user, id);
  if (!bank) notFound();
  const [sections, items] = await Promise.all([listSections(bank.id), listItems(bank.id)]);
  const flat = flattenTree(buildSectionTree(sections)).map((n) => ({ id: n.id, title: n.title, depth: n.depth }));
  return (
    <div className="space-y-4">
      <BankHeader bank={{ id: bank.id, name: bank.name, itemCount: bank._count.items }} tab={null} />
      <PickItems bankId={bank.id} bankName={bank.name} sections={sections} flat={flat} items={items} />
    </div>
  );
}
