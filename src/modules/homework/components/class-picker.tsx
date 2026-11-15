"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Filter, Maximize2, Minimize2, PanelLeft, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type ClassOption = { id: string; name: string; subject: string | null; memberCount: number };

type Props = {
  classes: ClassOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
};

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-[30px] w-full rounded-md border border-line bg-surface pr-8 pl-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none"
      />
      <Search className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink-soft" />
    </label>
  );
}

/**
 * Chọn lớp để giao bài — 2 khung: trái là nhóm lớp, phải là danh sách lớp có ô chọn.
 * Hiện chỉ có nhóm "Tất cả"; khi thêm tính năng nhóm lớp thì nạp thêm nhóm vào khung trái.
 */
export function ClassPicker({ classes, selected, onChange }: Props) {
  const [groupQuery, setGroupQuery] = useState("");
  const [query, setQuery] = useState("");
  const [showGroups, setShowGroups] = useState(true);
  const [onlySelected, setOnlySelected] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return classes.filter(
      (c) =>
        (!q || c.name.toLowerCase().includes(q) || c.subject?.toLowerCase().includes(q)) &&
        (!onlySelected || selected.includes(c.id)),
    );
  }, [classes, query, onlySelected, selected]);

  const allVisibleSelected = visible.length > 0 && visible.every((c) => selected.includes(c.id));
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const toggleAllVisible = () =>
    onChange(
      allVisibleSelected
        ? selected.filter((id) => !visible.some((c) => c.id === id))
        : [...new Set([...selected, ...visible.map((c) => c.id)])],
    );

  const groupLabel = "Tất cả";
  const groupMatches = !groupQuery.trim() || groupLabel.toLowerCase().includes(groupQuery.trim().toLowerCase());

  return (
    <div className="space-y-3">
      {classes.length === 0 && (
        <p className="text-sm text-ink">
          Thầy/Cô chưa tạo lớp. Vui lòng click{" "}
          <Link href="/lop-hoc" className="text-brand-700 hover:underline dark:text-brand-300">
            vào đây
          </Link>{" "}
          để tạo lớp.
        </p>
      )}

      <div
        className={cn(
          "grid gap-3",
          showGroups ? "md:grid-cols-[250px_1fr]" : "grid-cols-1",
          expanded ? "h-[520px]" : "h-[300px]",
        )}
      >
        {showGroups && (
          <div className="hidden flex-col overflow-hidden rounded-lg border border-line md:flex">
            <div className="border-b border-line p-2">
              <SearchBox value={groupQuery} onChange={setGroupQuery} placeholder="Tìm kiếm nhóm lớp" />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {groupMatches && (
                <button
                  type="button"
                  className="w-full rounded-md bg-brand-800 px-3 py-2 text-left text-sm font-semibold text-white"
                >
                  {groupLabel} ({selected.length}/{classes.length})
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-line">
          <div className="flex items-center gap-2 border-b border-line p-2">
            <button
              type="button"
              onClick={() => setShowGroups((v) => !v)}
              title={showGroups ? "Ẩn nhóm lớp" : "Hiện nhóm lớp"}
              className="hidden size-[30px] shrink-0 items-center justify-center rounded-md border border-line text-ink-soft hover:bg-muted md:flex"
            >
              <PanelLeft className="size-4" />
            </button>
            <div className="ml-auto w-full max-w-[232px]">
              <SearchBox value={query} onChange={setQuery} placeholder="Tìm kiếm lớp" />
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                className={cn(
                  "flex h-[30px] items-center gap-1.5 rounded-md border border-line px-2 text-xs font-medium text-ink hover:bg-muted",
                  onlySelected && "border-brand-500 text-brand-700",
                )}
              >
                <Filter className="size-4" /> Bộ lọc
              </button>
              {filterOpen && (
                <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-line bg-surface p-2 shadow-lg">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={onlySelected}
                      onChange={(e) => setOnlySelected(e.target.checked)}
                      className="size-4 accent-brand-600"
                    />
                    Chỉ lớp đã chọn
                  </label>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Thu nhỏ" : "Mở rộng"}
              className="flex size-[30px] shrink-0 items-center justify-center rounded-md text-ink-soft hover:bg-muted"
            >
              {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-ink">Không có lớp nào</div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <label className="sticky top-0 flex cursor-pointer items-center gap-3 border-b border-line bg-muted px-3 py-2 text-xs font-medium text-ink-soft">
                <Checkbox checked={allVisibleSelected} onChange={toggleAllVisible} />
                Chọn tất cả ({visible.length})
              </label>
              <ul className="divide-y divide-line">
                {visible.map((c) => {
                  const checked = selected.includes(c.id);
                  return (
                    <li key={c.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted",
                          checked && "bg-brand-50/60 dark:bg-brand-900/20",
                        )}
                      >
                        <Checkbox checked={checked} onChange={() => toggle(c.id)} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{c.name}</span>
                          {c.subject && <span className="block truncate text-xs text-ink-soft">{c.subject}</span>}
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-xs text-ink-soft">
                          <Users className="size-3.5" /> {c.memberCount}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <span className="relative flex size-4 shrink-0">
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/40",
          checked ? "border-brand-700 bg-brand-700 text-white" : "border-ink-faint bg-surface",
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
    </span>
  );
}
