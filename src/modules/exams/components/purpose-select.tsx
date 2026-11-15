"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { EXAM_PURPOSE_GROUPS, examPurposeLabel } from "@/common/enums";
import { cn } from "@/lib/utils";

const PLACEHOLDER = "---Chọn mục đích---";

/** Bỏ dấu + chữ thường để tìm "giua ky" ra "Kiểm tra giữa kỳ". */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

/** Ô chọn "Mục đích tạo đề": danh sách theo nhóm (Học kỳ 1 / Học kỳ 2 / Mục đích khác) có ô tìm kiếm. */
export function PurposeSelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = fold(query.trim());
  const groups = EXAM_PURPOSE_GROUPS.map((g) => ({
    label: g.label,
    options: g.options.filter((o) => !q || fold(o.label).includes(q) || fold(g.label).includes(q)),
  })).filter((g) => g.options.length > 0);

  const pick = (v: string | null) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={root} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 text-left text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none",
          value ? "text-ink" : "text-ink-soft",
        )}
      >
        <span className="truncate">{examPurposeLabel(value, true) ?? PLACEHOLDER}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-ink-soft transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 rounded-lg border border-line bg-surface shadow-lg">
          <input
            ref={search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm ..."
            aria-label="Tìm mục đích"
            className="h-10 w-full rounded-t-lg border-b border-line bg-transparent px-4 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <ul role="listbox" className="max-h-80 overflow-y-auto p-1 text-sm">
            {!q && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={!value}
                  onClick={() => pick(null)}
                  className={cn("w-full rounded-md px-3 py-2 text-left text-ink-soft hover:bg-muted", !value && "bg-muted")}
                >
                  {PLACEHOLDER}
                </button>
              </li>
            )}
            {groups.map((g) => (
              <li key={g.label}>
                <p className="px-3 pt-3 pb-1 text-[15px] font-medium text-ink">{g.label}</p>
                <ul>
                  {g.options.map((o) => (
                    <li key={o.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={value === o.value}
                        onClick={() => pick(o.value)}
                        className={cn(
                          "w-full rounded-md py-2 pr-3 pl-7 text-left text-ink hover:bg-muted",
                          value === o.value && "bg-muted font-medium text-brand-700 dark:text-brand-300",
                        )}
                      >
                        {o.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {groups.length === 0 && <li className="px-3 py-4 text-center text-ink-soft">Không tìm thấy mục đích phù hợp</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
