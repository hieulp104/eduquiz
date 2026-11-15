import type { Metadata } from "next";
import { requirePagePermission } from "@/common/guards/page.guard";
import { SHARED_BANK_HREF } from "@/config/navigation";
import { listBanks, listBookOptions } from "@/modules/banks/banks.service";
import { BankList } from "@/modules/banks/components/bank-list";

export const metadata: Metadata = { title: "Ngân hàng câu hỏi" };

export default async function BanksPage() {
  const user = await requirePagePermission("bank.manage");
  const [banks, books] = await Promise.all([listBanks(user), listBookOptions()]);
  return <BankList banks={banks} books={books} sharedBankHref={SHARED_BANK_HREF} />;
}
