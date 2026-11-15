"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Menu thả xuống: bấm nút mở, bấm ra ngoài / Esc / chọn mục thì đóng. */
export function Dropdown({
  label,
  trigger,
  children,
  align = "left",
  triggerClassName,
}: {
  /** Nhãn cho trình đọc màn hình + tooltip. */
  label: string;
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className={cn(
            "absolute top-full z-30 mt-1 min-w-48 rounded-lg border border-line bg-surface py-1.5 text-sm shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({
  children,
  icon,
  onSelect,
  danger,
  active,
}: {
  children: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  /** Đang được chọn (hiện đậm + màu thương hiệu). */
  active?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 px-4 py-2 text-left whitespace-nowrap hover:bg-muted",
        danger ? "text-danger-600" : active ? "font-medium text-brand-600" : "text-ink",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export const DropdownSeparator = () => <div role="separator" className="my-1.5 border-t border-line" />;
