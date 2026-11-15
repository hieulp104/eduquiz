import Link from "next/link";
import { Download, Eye, FileText, Link2, NotebookPen, Presentation, ScrollText, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { gradeLabel } from "@/common/enums";
import { CONTENT_KIND_LABEL, CONTENT_PATH, type ContentCard as Card, type ContentKind } from "@/modules/content/content.types";

/** Biểu tượng + màu theo loại (dùng token, có biến thể tối). */
export const KIND_STYLE: Record<ContentKind, { icon: typeof FileText; className: string }> = {
  EXAM: { icon: ScrollText, className: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" },
  REFERENCE: { icon: FileText, className: "bg-success-50 text-success-700 dark:bg-success-700/20 dark:text-success-200" },
  VIDEO: { icon: Link2, className: "bg-danger-50 text-danger-600 dark:bg-danger-700/20 dark:text-danger-200" },
  SLIDE: { icon: Presentation, className: "bg-warning-50 text-warning-700 dark:bg-warning-700/20 dark:text-warning-50" },
  LESSON_PLAN: { icon: NotebookPen, className: "bg-muted text-ink-soft" },
};

export function KindIcon({ kind, className }: { kind: ContentKind; className?: string }) {
  const { icon: Icon, className: tone } = KIND_STYLE[kind];
  return (
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tone, className)}>
      <Icon className="size-5" strokeWidth={1.75} />
    </span>
  );
}

export const metaLine = (c: { grade: number | null; subject: string | null }) =>
  [c.grade != null ? gradeLabel(c.grade) : null, c.subject].filter(Boolean).join(" · ") || "Chưa phân loại";

/** Thẻ 1 mục trong kho (lưới 3 cột). */
export function ContentCardView({ item }: { item: Card }) {
  const isVideo = item.kind === "VIDEO";
  return (
    <Link
      href={`${CONTENT_PATH}/${item.id}`}
      className="group flex h-full flex-col rounded-lg border border-line bg-surface p-3.5 shadow-sm transition-colors hover:border-brand-500"
    >
      <div className="flex gap-3">
        <KindIcon kind={item.kind} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium text-ink group-hover:text-brand-700 dark:group-hover:text-brand-300">{item.title}</p>
          <p className="mt-0.5 truncate text-xs text-brand-600 dark:text-brand-300">{metaLine(item)}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-3 border-t border-line pt-2.5 text-xs text-ink-soft [&:not(:first-child)]:mt-3">
        <span className="flex min-w-0 flex-1 items-center gap-1 truncate">
          <User className="size-3.5 shrink-0" /> {item.ownerName}
        </span>
        {item.extra && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-medium">{item.extra}</span>}
        <span className="flex shrink-0 items-center gap-1" title={isVideo ? "Lượt xem" : "Lượt tải"}>
          {isVideo ? <Eye className="size-3.5" /> : <Download className="size-3.5" />}
          {isVideo ? item.viewCount : item.downloadCount}
        </span>
      </div>
      <span className="sr-only">{CONTENT_KIND_LABEL[item.kind].short}</span>
    </Link>
  );
}
