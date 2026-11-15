import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800",
  secondary: "border border-line bg-surface text-ink hover:bg-muted",
  ghost: "text-ink-soft hover:bg-muted hover:text-ink",
  danger: "bg-danger-600 text-white hover:bg-danger-700",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
};

/** Class của Button — gắn cho <Link> để tránh lồng <button> trong <a>. */
export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(BASE, VARIANT[variant], SIZE[size], className);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />
  );
});
