"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, GraduationCap, Inbox, Landmark, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";
import { GRADES, gradeLabel } from "@/common/enums";
import { deleteBankAction } from "@/modules/banks/banks.actions";
import { BANKS_PATH, type BankBookOption, type BankCard } from "@/modules/banks/banks.types";
import { BankDialog, type BankDraft } from "./bank-dialog";

const CARD = "rounded-xl border border-line bg-surface shadow-sm";

/** Trang "Ngân hàng câu hỏi": lọc theo lớp / môn, tìm kiếm, lưới thẻ ngân hàng. */
export function BankList({ banks, books, sharedBankHref }: { banks: BankCard[]; books: BankBookOption[]; sharedBankHref: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"create" | BankDraft | null>(null);

  const subjects = useMemo(
    () => [...new Set(banks.filter((b) => grade == null || b.grade === grade).map((b) => b.subject).filter((s): s is string => Boolean(s)))].sort((a, b) => a.localeCompare(b, "vi")),
    [banks, grade],
  );
  const shown = banks.filter(
    (b) =>
      (grade == null || b.grade === grade) &&
      (!subject || b.subject === subject) &&
      (!q.trim() || b.name.toLowerCase().includes(q.trim().toLowerCase())),
  );

  async function remove(b: BankCard) {
    if (!confirm(`Xóa ngân hàng “${b.name}” (${b.itemCount} câu hỏi)? Đề đã tạo từ ngân hàng vẫn giữ nguyên.`)) return;
    const res = await deleteBankAction({ id: b.id });
    if (!res.ok) return alert(res.message);
    router.refresh();
  }

  const pill = (active: boolean) =>
    cn("shrink-0 rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors", active ? "border-brand-700 bg-brand-700 text-white" : "border-line bg-surface text-ink hover:border-brand-300");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-ink">Ngân hàng câu hỏi</h1>
          <p className="text-sm text-ink-soft">{banks.length} Ngân hàng</p>
        </div>
        <div className="flex gap-2">
          <Link href={sharedBankHref} className={buttonClass("secondary")}>
            <Landmark className="size-4" /> Ngân hàng chung
          </Link>
          <button type="button" onClick={() => setDialog("create")} className={buttonClass("primary")}>
            <Plus className="size-4" /> Tạo ngân hàng mới
          </button>
        </div>
      </div>

      {banks.length === 0 ? (
        <div className={cn(CARD, "flex flex-col items-center px-4 py-20 text-center")}>
          <Inbox className="size-14 text-brand-300" strokeWidth={1} />
          <p className="mt-4 text-ink">Bạn chưa có ngân hàng câu hỏi nào</p>
          <p className="mt-1 text-sm text-ink-soft">Tạo ngân hàng, dựng cấu trúc chương / bài, nhập câu hỏi rồi tạo đề thi nhanh.</p>
          <button type="button" onClick={() => setDialog("create")} className={buttonClass("primary", "md", "mt-5")}>
            <Plus className="size-4" /> Tạo ngân hàng mới
          </button>
        </div>
      ) : (
        <>
          <label className="relative block">
            <span className="sr-only">Tìm kiếm ngân hàng</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm kiếm"
              className="h-10 w-full rounded-lg border border-line bg-surface pr-10 pl-3 text-sm text-ink shadow-sm placeholder:text-ink-faint focus:border-brand-500 focus:outline-none"
            />
            <Search className="pointer-events-none absolute top-3 right-3 size-4 text-ink-soft" />
          </label>

          <div className={cn(CARD, "divide-y divide-line px-4")}>
            <div className="flex items-center gap-2 overflow-x-auto py-3">
              <span className="mr-1 flex shrink-0 items-center gap-1 text-xs font-medium tracking-wider text-ink-soft uppercase">
                <GraduationCap className="size-4" /> Lớp
              </span>
              {[null, ...GRADES, 0].map((g) => (
                <button
                  key={String(g)}
                  type="button"
                  onClick={() => {
                    setGrade(g);
                    setSubject(null);
                  }}
                  className={pill(grade === g)}
                >
                  {g == null ? "Tất cả" : gradeLabel(g)}
                </button>
              ))}
            </div>
            {subjects.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 py-3">
                <span className="mr-1 flex items-center gap-1 text-xs font-medium tracking-wider text-ink-soft uppercase">
                  <BookOpen className="size-4" /> Môn
                </span>
                <button type="button" onClick={() => setSubject(null)} className={pill(subject == null)}>
                  Tất cả
                </button>
                {subjects.map((s) => (
                  <button key={s} type="button" onClick={() => setSubject(s)} className={pill(subject === s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {shown.length === 0 ? (
            <div className={cn(CARD, "flex flex-col items-center px-4 py-16 text-center")}>
              <Inbox className="size-12 text-brand-300" strokeWidth={1} />
              <p className="mt-3 text-ink">Không có ngân hàng câu hỏi nào phù hợp với tìm kiếm của bạn</p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((b) => (
                <li key={b.id} className={cn(CARD, "flex flex-col transition-colors hover:border-brand-500")}>
                  <Link href={`${BANKS_PATH}/${b.id}`} className="flex-1 px-4 pt-4 pb-3">
                    <p className="line-clamp-2 font-medium text-ink">{b.name}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      {b.grade != null && <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-ink-soft"><GraduationCap className="size-3.5" />{gradeLabel(b.grade)}</span>}
                      {b.subject && <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-ink-soft"><BookOpen className="size-3.5" />{b.subject}</span>}
                    </div>
                    {b.bookTitle && <p className="mt-2 truncate text-xs text-brand-600 dark:text-brand-300">Sách: {b.bookTitle}</p>}
                  </Link>
                  <div className="flex items-center gap-2 border-t border-line px-4 py-2.5">
                    <p className="flex-1 text-sm text-ink-soft">
                      <span className="font-semibold text-ink">{b.itemCount}</span> câu hỏi
                    </p>
                    <button
                      type="button"
                      onClick={() => setDialog({ id: b.id, name: b.name, grade: b.grade, subject: b.subject, bookId: b.bookId })}
                      aria-label={`Sửa ${b.name}`}
                      title="Sửa"
                      className="rounded-md border border-line p-1.5 text-ink-soft hover:bg-muted hover:text-brand-600"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(b)}
                      aria-label={`Xóa ${b.name}`}
                      title="Xóa"
                      className="rounded-md border border-line p-1.5 text-danger-600 hover:bg-danger-50"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <BankDialog open={dialog !== null} onClose={() => setDialog(null)} books={books} editing={dialog === "create" ? null : dialog} />
    </div>
  );
}
