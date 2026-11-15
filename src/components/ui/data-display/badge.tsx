import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "neutral" | "brand" | "success" | "warning" | "danger";

const VARIANT: Record<Variant, string> = {
  neutral: "bg-muted text-ink-soft",
  brand: "bg-brand-50 text-brand-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
};

export function Badge({
  className,
  variant = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        VARIANT[variant],
        className,
      )}
      {...props}
    />
  );
}
