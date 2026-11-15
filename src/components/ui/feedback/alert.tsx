import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "info" | "success" | "danger";

const VARIANT: Record<Variant, string> = {
  info: "border-brand-200 bg-brand-50 text-brand-800",
  success: "border-success-200 bg-success-50 text-success-700",
  danger: "border-danger-200 bg-danger-50 text-danger-700",
};

export function Alert({
  className,
  variant = "info",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      className={cn("rounded-lg border px-3.5 py-3 text-sm", VARIANT[variant], className)}
      {...props}
    />
  );
}
