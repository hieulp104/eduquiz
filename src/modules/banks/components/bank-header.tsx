import Link from "next/link";
import { Activity, ArrowLeft, ChartPie, Grid3x3, ListChecks, ListTree, Plus, Search } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";
import { BANKS_PATH } from "@/modules/banks/banks.types";
import { CopyBankButton } from "./copy-bank-button";

export type BankTab = "cau-truc" | "hoat-dong" | "phan-tich";
const TABS: { key: BankTab; label: string; icon: typeof ListTree }[] = [
  { key: "cau-truc", label: "Cấu trúc", icon: ListTree },
  { key: "hoat-dong", label: "Các hoạt động", icon: Activity },
  { key: "phan-tich", label: "Phân tích", icon: ChartPie },
];

/**
 * Đầu trang ngân hàng: tên (số câu), ô tìm câu hỏi, tab + 4 nút (Copy · Tự chọn · Ma trận · Nhập câu hỏi).
 * Trang con (nhập / tự chọn / ma trận) truyền `tab = null` → hiện nút quay về thay cho tab.
 */
export function BankHeader({ bank, tab, q = "" }: { bank: { id: string; name: string; itemCount: number }; tab: BankTab | null; q?: string }) {
  const base = `${BANKS_PATH}/${bank.id}`;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 truncate text-ink">
          <span className="font-semibold">{bank.name}</span> <span className="text-sm text-ink-soft">({bank.itemCount} câu hỏi)</span>
        </p>
        {tab && (
          <form action={base} className="relative w-full sm:w-72">
            <input type="hidden" name="tab" value="cau-truc" />
            <label htmlFor="bank-q" className="sr-only">
              Tìm câu hỏi
            </label>
            <input
              id="bank-q"
              name="q"
              defaultValue={q}
              placeholder="Nhập mã hoặc nội dung câu hỏi"
              className="h-9 w-full rounded-md border border-line bg-surface pr-9 pl-3 text-sm text-ink shadow-sm placeholder:text-ink-faint focus:border-brand-500 focus:outline-none"
            />
            <Search className="pointer-events-none absolute top-2.5 right-3 size-4 text-ink-soft" />
          </form>
        )}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        {tab ? (
          <nav aria-label="Ngân hàng" className="flex gap-1">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={t.key === "cau-truc" ? base : `${base}?tab=${t.key}`}
                aria-current={tab === t.key ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-sm",
                  tab === t.key ? "border border-b-0 border-line bg-surface font-medium text-ink" : "text-ink-soft hover:text-ink",
                )}
              >
                <t.icon className="size-4" /> {t.label}
              </Link>
            ))}
          </nav>
        ) : (
          <Link href={base} className="flex items-center gap-1.5 pb-2 text-sm text-brand-700 hover:underline dark:text-brand-300">
            <ArrowLeft className="size-4" /> Về cấu trúc ngân hàng
          </Link>
        )}
        <div className="flex flex-wrap gap-2 pb-2">
          <CopyBankButton bankId={bank.id} />
          <Link href={`${base}/tu-chon`} className={buttonClass("secondary", "md", "border-brand-500 text-brand-700 dark:text-brand-300")}>
            <ListChecks className="size-4" /> Tự chọn câu hỏi
          </Link>
          <Link href={`${base}/ma-tran`} className={buttonClass("primary")}>
            <Grid3x3 className="size-4" /> Tạo ma trận đề thi
          </Link>
          <Link href={`${base}/nhap`} className={buttonClass("primary")}>
            <Plus className="size-4" /> Nhập câu hỏi
          </Link>
        </div>
      </div>
    </div>
  );
}
