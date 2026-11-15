import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/common/guards/page.guard";
import { cn, timeAgo } from "@/lib/utils";
import { getBank, listActivities, listItems, listSections } from "@/modules/banks/banks.service";
import { buildSectionTree, flattenTree, subtreeIds, MATRIX_LEVEL_LABEL, MATRIX_LEVELS, type BankItemView, type MatrixLevel, type SectionRow } from "@/modules/banks/banks.types";
import { BankHeader, type BankTab } from "@/modules/banks/components/bank-header";
import { BankStructure } from "@/modules/banks/components/bank-structure";

export const metadata: Metadata = { title: "Ngân hàng câu hỏi" };

const CARD = "rounded-xl rounded-tl-none border border-line bg-surface shadow-sm";

export default async function BankDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; q?: string; bai?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requirePagePermission("bank.manage");
  const bank = await getBank(user, id);
  if (!bank) notFound();
  const tab: BankTab = sp.tab === "hoat-dong" || sp.tab === "phan-tich" ? sp.tab : "cau-truc";
  const q = (sp.q ?? "").slice(0, 100);

  return (
    <div className="space-y-0">
      <BankHeader bank={{ id: bank.id, name: bank.name, itemCount: bank._count.items }} tab={tab} q={q} />
      <div className={CARD}>
        {tab === "cau-truc" && <StructureTab bankId={bank.id} bookTitle={bank.book?.title ?? null} q={q} initialSection={sp.bai ?? null} />}
        {tab === "hoat-dong" && <ActivityTab bankId={bank.id} />}
        {tab === "phan-tich" && <AnalysisTab bankId={bank.id} />}
      </div>
    </div>
  );
}

async function StructureTab({ bankId, bookTitle, q, initialSection }: { bankId: string; bookTitle: string | null; q: string; initialSection: string | null }) {
  const [sections, items] = await Promise.all([listSections(bankId), listItems(bankId)]);
  const valid = initialSection && sections.some((s) => s.id === initialSection) ? initialSection : null;
  return <BankStructure bankId={bankId} bookTitle={bookTitle} sections={sections} items={items} q={q} initialSection={valid} />;
}

async function ActivityTab({ bankId }: { bankId: string }) {
  const rows = await listActivities(bankId);
  const now = new Date();
  if (!rows.length) return <p className="px-6 py-10 text-center text-sm text-ink-soft">Chưa có hoạt động nào.</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((a) => (
        <li key={a.id} className="flex items-center gap-3 px-5 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-ink ring-1 ring-line">
            {initials(a.actor.fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{a.actor.fullName}</p>
            <p className="truncate text-sm text-ink-soft">{a.message}</p>
          </div>
          <time dateTime={a.createdAt.toISOString()} className="shrink-0 text-xs text-ink-faint">
            {timeAgo(a.createdAt, now)}
          </time>
        </li>
      ))}
    </ul>
  );
}

const initials = (name: string) =>
  // "Nguyễn Thị Lan" → "NL" (chữ đầu của họ + tên, giống góc tài khoản).
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((_, i, all) => i === 0 || i === all.length - 1)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/** Thống kê số câu theo chương / bài × mức độ (mỗi dòng tính cả mục con). */
async function AnalysisTab({ bankId }: { bankId: string }) {
  const [sections, items] = await Promise.all([listSections(bankId), listItems(bankId)]);
  const flat = flattenTree(buildSectionTree(sections));
  const count = (list: BankItemView[]) => {
    const c: Record<MatrixLevel, number> = { NB: 0, TH: 0, VD: 0, NONE: 0 };
    for (const i of list) c[i.level ?? "NONE"]++;
    return c;
  };
  const under = (row: SectionRow) => {
    const ids = subtreeIds(sections, row.id);
    return items.filter((i) => i.sectionId && ids.has(i.sectionId));
  };
  const total = count(items);
  const unsorted = items.filter((i) => !i.sectionId);

  return (
    <div className="space-y-5 p-5">
      <div className="grid gap-3 sm:grid-cols-5">
        <Stat label="Tổng số câu" value={items.length} strong />
        {MATRIX_LEVELS.map((l) => (
          <Stat key={l} label={MATRIX_LEVEL_LABEL[l]} value={total[l]} percent={items.length ? Math.round((total[l] / items.length) * 100) : 0} />
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-ink-soft">
            <tr>
              <th className="px-4 py-2.5 font-medium">Chương / bài</th>
              {MATRIX_LEVELS.map((l) => (
                <th key={l} className="w-28 px-3 py-2.5 text-right font-medium">
                  {MATRIX_LEVEL_LABEL[l]}
                </th>
              ))}
              <th className="w-20 px-4 py-2.5 text-right font-medium">Tổng</th>
            </tr>
          </thead>
          <tbody>
            {[...flat.map((n) => ({ key: n.id, title: n.title, depth: n.depth, list: under(n) })), ...(unsorted.length ? [{ key: "none", title: "Chưa xếp bài", depth: 0, list: unsorted }] : [])].map((r) => {
              const c = count(r.list);
              return (
                <tr key={r.key} className="border-t border-line">
                  <td className={cn("px-4 py-2 text-ink", r.depth === 0 && "font-medium")} style={{ paddingLeft: 16 + r.depth * 20 }}>
                    {r.title}
                  </td>
                  {MATRIX_LEVELS.map((l) => (
                    <td key={l} className={cn("px-3 py-2 text-right", c[l] ? "text-ink" : "text-ink-faint")}>
                      {c[l]}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right font-semibold text-ink">{r.list.length}</td>
                </tr>
              );
            })}
            {!flat.length && !unsorted.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-soft">
                  Không có dữ liệu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, percent, strong }: { label: string; value: number; percent?: number; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-line px-4 py-3">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold", strong ? "text-brand-700 dark:text-brand-300" : "text-ink")}>{value}</p>
      {percent !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" title={`${percent}%`}>
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}
