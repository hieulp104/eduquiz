import type { ReactNode } from "react";

/** Tiêu đề trang + mô tả + nút hành động bên phải. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {description && <div className="mt-1 text-sm text-ink-soft">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
