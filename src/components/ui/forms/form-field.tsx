import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
};

/** Nhãn + ô nhập + gợi ý, dùng thống nhất cho mọi form. */
export function FormField({ label, htmlFor, hint, className, children }: Props) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}
