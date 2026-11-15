import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
