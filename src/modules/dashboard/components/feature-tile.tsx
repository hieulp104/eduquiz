import Link from "next/link";
import { FeatureIcon } from "@/components/layout/feature-icon";
import type { Feature, QuickLink } from "@/config/navigation";
import { cn } from "@/lib/utils";

/** Ô chức năng: icon trong khung vuông ở giữa, tên bên dưới. */
export function FeatureTile({ feature }: { feature: Feature }) {
  return (
    <Link
      href={feature.href}
      className="group relative flex h-[140px] flex-col items-center justify-center gap-4 rounded-lg bg-surface px-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      {feature.badge && <TileBadge>{feature.badge}</TileBadge>}
      <span className="flex size-14 items-center justify-center rounded-xl border border-line bg-brand-50/60 text-brand-700 transition-colors group-hover:bg-brand-50 dark:bg-muted dark:text-brand-300">
        <FeatureIcon name={feature.icon} className="size-6" />
      </span>
      <span className="text-base font-medium text-ink">{feature.label}</span>
    </Link>
  );
}

/** Ô "Truy cập nhanh": nằm ngang, icon nhỏ bên trái. */
export function QuickLinkTile({ link }: { link: QuickLink }) {
  return (
    <Link
      href={link.href}
      className={cn(
        "relative flex h-20 items-center gap-3.5 rounded-lg px-4 shadow-sm transition hover:shadow-md",
        link.highlight
          ? "border-2 border-brand-500 bg-brand-50 dark:bg-brand-900/30"
          : "bg-surface",
      )}
    >
      {link.badge && <TileBadge tone="danger">{link.badge}</TileBadge>}
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          link.highlight ? "bg-brand-600 text-white" : "bg-muted text-brand-700 dark:text-brand-300",
        )}
      >
        <FeatureIcon name={link.icon} className="size-5" />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "line-clamp-2 text-[15px] leading-snug font-medium",
            link.highlight ? "font-semibold text-brand-700 dark:text-brand-300" : "text-ink",
          )}
        >
          {link.label}
        </span>
        {link.description && (
          <span
            className={cn(
              "mt-0.5 block truncate text-sm",
              link.highlight ? "text-brand-700/80 dark:text-brand-300/80" : "text-ink-soft",
            )}
          >
            {link.description}
          </span>
        )}
      </span>
    </Link>
  );
}

function TileBadge({ children, tone = "brand" }: { children: React.ReactNode; tone?: "brand" | "danger" }) {
  return (
    <span
      className={cn(
        "absolute -top-2 right-2 rounded-md px-2 py-0.5 text-xs font-bold text-white shadow-sm",
        tone === "danger" ? "bg-danger-600" : "bg-brand-600",
      )}
    >
      {children}
    </span>
  );
}
