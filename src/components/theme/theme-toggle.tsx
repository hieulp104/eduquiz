"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_STORAGE_KEY } from "./constants";

type Mode = "light" | "dark";

function currentMode(): Mode {
  const attr = document.documentElement.dataset.theme;
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

/** Nút chuyển sáng/tối — chọn xong lưu lại cho lần sau. */
export function ThemeToggle({ className }: { className?: string }) {
  const mode = useSyncExternalStore(subscribe, currentMode, () => "light" as Mode);
  const next: Mode = mode === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          /* trình duyệt chặn localStorage — chỉ áp cho phiên này */
        }
      }}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-soft hover:bg-muted hover:text-ink",
        className,
      )}
    >
      {mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {mode === "dark" ? "Chế độ sáng" : "Chế độ tối"}
    </button>
  );
}
