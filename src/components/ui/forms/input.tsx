import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Class nền dùng chung cho Input / Select / Textarea. */
export const FIELD_CLASS =
  "w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink " +
  "placeholder:text-ink-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(FIELD_CLASS, "h-10", className)} {...props} />;
  },
);
