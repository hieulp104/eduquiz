import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Clock, Layers3, Search, UserRound } from "lucide-react";
import { requirePagePermission } from "@/common/guards/page.guard";
import { hasPermission } from "@/common/permissions/permissions";
import { GRADES, gradeLabel } from "@/common/enums";
import { cn } from "@/lib/utils";
import { listContent, listContentSections, listShareableExams, type ContentFilter } from "@/modules/content/content.service";
import {
  CONTENT_KIND_LABEL,
  CONTENT_KINDS,
  CONTENT_PATH,
  KIND_SLUG,
  kindFromSlug,
  type ContentCard,
  type ContentKind,
} from "@/modules/content/content.types";
import { ContentCardView, KindIcon } from "@/modules/content/components/content-card";
import { ContributeButton } from "@/modules/content/components/contribute-button";

export const metadata: Metadata = { title: "Kho nội dung" };

type Search = { loai?: string; khoi?: string; q?: string; "dong-gop"?: string };

const CARD = "rounded-xl border border-line bg-surface shadow-sm";

/** Kho nội dung: trái = đóng góp + loại; phải = tab khối, tìm kiếm, các mục theo loại. */
export default async function ContentLibraryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requirePagePermission("content.view");
  const sp = await searchParams;
  const kind = kindFromSlug(sp.loai);
  const mine = sp.loai === "cua-toi";
  const latest = sp.loai === "moi-nhat";
  const gradeNum = sp.khoi === undefined || sp.khoi === "" ? null : Number(sp.khoi);
  const grade = gradeNum != null && Number.isInteger(gradeNum) && gradeNum >= 0 && gradeNum <= 12 ? gradeNum : null;
  const q = (sp.q ?? "").slice(0, 100);
  const filter: ContentFilter = { grade, q, ...(mine ? { ownerId: user.id } : {}) };
  const canShare = hasPermission(user, "content.share");

  const href = (patch: Partial<Record<"loai" | "khoi" | "q", string | null>>) => {
    const next = { loai: sp.loai ?? null, khoi: grade != null ? String(grade) : null, q: q || null, ...patch };
    const params = new URLSearchParams(Object.entries(next).filter((e): e is [string, string] => Boolean(e[1])));
    const s = params.toString();
    return s ? `${CONTENT_PATH}?${s}` : CONTENT_PATH;
  };

  const [exams, data] = await Promise.all([
    canShare ? listShareableExams(user.id) : Promise.resolve([]),
    kind || mine || latest ? listContent({ ...filter, kind }).then((r) => ({ single: r })) : listContentSections(filter).then((r) => ({ sections: r })),
  ]);

  const nav: { slug: string | null; label: string; icon: React.ReactNode }[] = [
    { slug: null, label: "Tất cả tài liệu", icon: <Layers3 className="size-4" /> },
    { slug: "moi-nhat", label: "Tài liệu mới nhất", icon: <Clock className="size-4" /> },
    ...CONTENT_KINDS.map((k) => ({ slug: KIND_SLUG[k], label: CONTENT_KIND_LABEL[k].section, icon: <KindIcon kind={k} className="size-6 rounded-md [&_svg]:size-3.5" /> })),
    ...(canShare ? [{ slug: "cua-toi", label: "Đóng góp của bạn", icon: <UserRound className="size-4" /> }] : []),
  ];
  const active = sp.loai && nav.some((n) => n.slug === sp.loai) ? sp.loai : null;
  const title = nav.find((n) => n.slug === active)?.label ?? "Tất cả tài liệu";

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* ───── Trái ───── */}
      <aside className={cn(CARD, "shrink-0 p-3 lg:sticky lg:top-4 lg:w-60")}>
        {canShare && <ContributeButton exams={exams} presetExamId={sp["dong-gop"] ?? null} />}
        <nav aria-label="Loại nội dung" className="mt-3 space-y-0.5">
          {nav.map((n) => (
            <Link
              key={n.label}
              href={href({ loai: n.slug })}
              aria-current={active === n.slug ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                active === n.slug ? "bg-muted font-medium text-brand-700 dark:text-brand-300" : "text-ink hover:bg-muted/60",
              )}
            >
              <span className="flex size-6 items-center justify-center text-ink-soft">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* ───── Phải ───── */}
      <div className="min-w-0 flex-1 space-y-4">
        <div className={cn(CARD, "flex flex-col gap-3 p-3 xl:flex-row xl:items-center")}>
          <nav aria-label="Khối" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1 xl:pb-0">
            {[null, ...GRADES, 0].map((g) => (
              <Link
                key={String(g)}
                href={href({ khoi: g == null ? null : String(g) })}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap",
                  grade === g ? "bg-brand-700 text-white" : "bg-muted text-ink-soft hover:text-ink",
                )}
              >
                {g == null ? "Tất cả" : gradeLabel(g)}
              </Link>
            ))}
          </nav>
          <form action={CONTENT_PATH} className="relative xl:w-72">
            {sp.loai && <input type="hidden" name="loai" value={sp.loai} />}
            {grade != null && <input type="hidden" name="khoi" value={grade} />}
            <label className="sr-only" htmlFor="content-q">
              Tìm kiếm nội dung
            </label>
            <input
              id="content-q"
              name="q"
              defaultValue={q}
              placeholder="Tìm theo tên, môn…"
              className="h-9 w-full rounded-md border border-line bg-surface pr-9 pl-3 text-sm text-ink shadow-sm placeholder:text-ink-faint focus:border-brand-500 focus:outline-none"
            />
            <Search className="pointer-events-none absolute top-2.5 right-3 size-4 text-ink-soft" />
          </form>
        </div>

        {"single" in data ? (
          <Section title={title} count={data.single.total} items={data.single.items} empty={emptyText(mine, q, grade)} />
        ) : (
          <>
            <Section title="Tài liệu mới nhất" count={data.sections.latest.total} items={data.sections.latest.items} more={href({ loai: "moi-nhat" })} empty={emptyText(false, q, grade)} />
            {data.sections.byKind.map((s) => (
              <Section
                key={s.kind}
                kind={s.kind}
                title={CONTENT_KIND_LABEL[s.kind].section}
                count={s.total}
                items={s.items}
                more={href({ loai: KIND_SLUG[s.kind] })}
                empty="Chưa có nội dung."
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function emptyText(mine: boolean, q: string, grade: number | null) {
  if (mine) return "Bạn chưa đóng góp nội dung nào — bấm “Đóng góp nội dung” để chia sẻ đề, tài liệu hoặc link video.";
  if (q || grade != null) return "Không có nội dung nào khớp bộ lọc.";
  return "Kho chưa có nội dung — hãy là người đầu tiên đóng góp.";
}

function Section({
  title,
  count,
  items,
  more,
  empty,
  kind,
}: {
  title: string;
  count: number;
  items: ContentCard[];
  more?: string;
  empty: string;
  kind?: ContentKind;
}) {
  return (
    <section className={cn(CARD, "p-4")}>
      <div className="mb-3 flex items-center gap-2.5">
        {kind && <KindIcon kind={kind} className="size-7 rounded-md [&_svg]:size-4" />}
        <h2 className="font-medium text-ink">{title}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-ink-soft">{count}</span>
        {more && count > items.length && (
          <Link href={more} className="ml-auto flex items-center gap-0.5 text-sm text-brand-700 hover:underline dark:text-brand-300">
            Xem tất cả <ChevronRight className="size-4" />
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">{empty}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((it) => (
            <li key={it.id}>
              <ContentCardView item={it} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
