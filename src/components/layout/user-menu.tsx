"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme";
import { logoutAction } from "@/modules/auth/auth.actions";

/** "Lê Thị Mơ" → "LM": chữ đầu của từ đầu + từ cuối. */
function initials(fullName: string) {
  const words = fullName.trim().split(/\s+/);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function UserMenu({ fullName, roleLabel }: { fullName: string; roleLabel: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Bấm ra ngoài / nhấn Esc thì đóng menu.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-muted"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-ink ring-1 ring-line">
          {initials(fullName)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-40 truncate text-sm font-medium text-ink">{fullName}</span>
          <span className="block text-xs font-semibold text-brand-700 dark:text-brand-300">{roleLabel}</span>
        </span>
        <ChevronDown className="size-4 text-ink-faint" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-52 rounded-lg border border-line bg-surface p-1.5 shadow-lg">
          <ThemeToggle className="w-full" />
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-danger-600 hover:bg-danger-50"
            >
              <LogOut className="size-4" />
              Đăng xuất
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
