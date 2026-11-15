"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpDown, Filter, LoaderCircle, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { Alert, Button, Dropdown, DropdownItem, Modal, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  formatSchoolYear,
  nextClassName,
  schoolYearOptions,
  shiftSchoolYear,
  type BoardClass,
  type BoardGroup,
} from "@/modules/classes/class-board";
import { promoteClassesAction } from "@/modules/classes/classes.actions";

type Props = {
  open: boolean;
  onClose: () => void;
  classes: BoardClass[];
  groups: BoardGroup[];
  currentYear: string;
  /** Bấm "vào đây" khi chưa có lớp → mở hộp Thêm lớp học. */
  onCreateClass: () => void;
};

const NONE = "__none";

/**
 * "Tạo lớp cho khóa mới": chọn các lớp cũ → hệ thống tạo lớp mới (đặt tên mới, năm học mới)
 * và chép danh sách học sinh từ lớp cũ sang.
 */
export function PromoteClassesDialog({ open, onClose, classes, groups, currentYear, onCreateClass }: Props) {
  const router = useRouter();
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [groupSearch, setGroupSearch] = useState("");
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [desc, setDesc] = useState(false);
  const [showGroups, setShowGroups] = useState(true);
  const [wide, setWide] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [newYear, setNewYear] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- làm mới mỗi lần mở */
    setSelected([]);
    setNames({});
    setNewYear(null);
    setTried(false);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

  const byGroup = (gid: string | null) => classes.filter((c) => (gid === NONE ? !c.groupId : !gid || c.groupId === gid));
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return byGroup(groupFilter)
      .filter((c) => (!q || c.name.toLowerCase().includes(q)) && (!yearFilter || c.schoolYear === yearFilter))
      .sort((a, b) => (desc ? -1 : 1) * a.name.localeCompare(b.name, "vi", { numeric: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- byGroup chỉ phụ thuộc classes
  }, [classes, groupFilter, search, yearFilter, desc]);

  const picked = classes.filter((c) => selected.includes(c.id));
  // Năm học mới mặc định = năm sau của lớp cũ mới nhất được chọn.
  const latest = picked.map((c) => c.schoolYear).filter((y): y is string => Boolean(y)).sort().at(-1);
  const targetYear = newYear ?? (latest ? shiftSchoolYear(latest, 1) : shiftSchoolYear(currentYear, 1));
  const years = [...new Set(classes.map((c) => c.schoolYear).filter((y): y is string => Boolean(y)))].sort().reverse();
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allVisibleChecked = visible.length > 0 && visible.every((c) => selected.includes(c.id));

  function save() {
    setTried(true);
    if (picked.length === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await promoteClassesAction({
        schoolYear: targetYear,
        items: picked.map((c) => ({ sourceId: c.id, name: names[c.id] ?? nextClassName(c.name) })),
      });
      if (!res.ok) return setError(res.message);
      router.refresh();
      onClose();
    });
  }

  const groupItems = [
    { id: null as string | null, name: "Tất cả" },
    ...groups.map((g) => ({ id: g.id as string | null, name: g.name })),
    ...(classes.some((c) => !c.groupId) ? [{ id: NONE as string | null, name: "Khác" }] : []),
  ].filter((g) => !groupSearch.trim() || g.name.toLowerCase().includes(groupSearch.trim().toLowerCase()));

  const searchBox = "h-9 w-full rounded-md border border-line bg-surface pr-8 pl-3 text-sm placeholder:text-ink-faint focus:border-brand-500 focus:outline-none";
  const tool = "flex h-9 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-medium text-ink-soft hover:bg-muted";

  return (
    <Modal
      open={open}
      onClose={onClose}
      size={wide ? "full" : "lg"}
      title="Tạo lớp cho khóa mới"
      description="Khi tạo lớp cho khóa mới hệ thống sẽ tự động tạo lớp mới và copy danh sách học sinh từ các lớp ở khóa cũ. Chọn các lớp bên dưới để thực hiện tạo lớp mới"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-24">
            Hủy
          </Button>
          <Button onClick={save} disabled={pending} className="w-24">
            {pending && <LoaderCircle className="size-4 animate-spin" />} Lưu
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {classes.length === 0 && (
          <p className="text-sm">
            Thầy/Cô chưa tạo lớp. Vui lòng click{" "}
            <button type="button" onClick={onCreateClass} className="text-brand-700 hover:underline dark:text-brand-300">
              vào đây
            </button>{" "}
            để tạo lớp.
          </p>
        )}

        <div className={cn("grid gap-3", showGroups && "sm:grid-cols-[250px_minmax(0,1fr)]")}>
          {showGroups && (
            <div className="flex h-80 flex-col rounded-md border border-line p-2">
              <label className="relative">
                <span className="sr-only">Tìm kiếm nhóm lớp</span>
                <input value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)} placeholder="Tìm kiếm nhóm lớp" className={searchBox} />
                <Search className="pointer-events-none absolute top-2.5 right-2.5 size-4 text-ink-faint" />
              </label>
              <ul className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto">
                {groupItems.map((g) => {
                  const list = byGroup(g.id);
                  const sel = list.filter((c) => selected.includes(c.id)).length;
                  return (
                    <li key={g.id ?? "all"}>
                      <button
                        type="button"
                        onClick={() => setGroupFilter(g.id)}
                        className={cn(
                          "w-full truncate rounded-md px-3 py-2 text-left text-sm",
                          groupFilter === g.id ? "bg-brand-700 font-medium text-white" : "text-ink hover:bg-muted",
                        )}
                      >
                        {g.name} ({sel}/{list.length})
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="flex h-80 flex-col rounded-md border border-line">
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-2">
              <button type="button" onClick={() => setShowGroups((v) => !v)} className={tool} aria-label={showGroups ? "Ẩn nhóm lớp" : "Hiện nhóm lớp"}>
                {showGroups ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
              </button>
              <label className="relative min-w-40 flex-1">
                <span className="sr-only">Tìm kiếm lớp</span>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm kiếm lớp" className={searchBox} />
                <Search className="pointer-events-none absolute top-2.5 right-2.5 size-4 text-ink-faint" />
              </label>
              <button type="button" onClick={() => setDesc((d) => !d)} className={tool}>
                <ArrowUpDown className="size-4" /> Sắp xếp theo tên {desc ? "(Z→A)" : "(A→Z)"}
              </button>
              <Dropdown
                label="Lọc theo năm học"
                align="right"
                triggerClassName={cn(tool, yearFilter && "border-brand-500 text-brand-600")}
                trigger={
                  <>
                    <Filter className="size-4" /> Bộ lọc
                  </>
                }
              >
                <DropdownItem active={!yearFilter} onSelect={() => setYearFilter(null)}>
                  Tất cả năm học
                </DropdownItem>
                {years.map((y) => (
                  <DropdownItem key={y} active={yearFilter === y} onSelect={() => setYearFilter(y)}>
                    {formatSchoolYear(y)}
                  </DropdownItem>
                ))}
              </Dropdown>
              <button type="button" onClick={() => setWide((w) => !w)} className={tool} aria-label={wide ? "Thu nhỏ" : "Phóng to"}>
                {wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
            </div>
            {visible.length === 0 ? (
              <p className="m-auto text-sm text-ink-soft">Không có lớp nào</p>
            ) : (
              <ul className="min-h-0 flex-1 overflow-y-auto p-2 text-sm">
                <li>
                  <label className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 font-medium hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={allVisibleChecked}
                      onChange={() =>
                        setSelected((s) =>
                          allVisibleChecked ? s.filter((id) => !visible.some((c) => c.id === id)) : [...new Set([...s, ...visible.map((c) => c.id)])],
                        )
                      }
                      className="size-4 accent-brand-600"
                    />
                    Chọn tất cả ({visible.length})
                  </label>
                </li>
                {visible.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-muted">
                      <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} className="size-4 accent-brand-600" />
                      <span className="flex-1 font-medium">{c.name}</span>
                      <span className="text-xs text-ink-soft">
                        {formatSchoolYear(c.schoolYear)} · {c.memberCount} học sinh
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {tried && picked.length === 0 && <p className="text-xs text-danger-600">Vui lòng chọn lớp</p>}

        <div className="overflow-hidden rounded-md border border-line">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-muted px-4 py-2.5">
            <p className="text-sm font-medium">Các lớp tương ứng sẽ tạo</p>
            <label className="flex items-center gap-2 text-sm">
              Năm học mới
              <Select value={targetYear} onChange={(e) => setNewYear(e.target.value)} className="h-8 w-36">
                {[...new Set([...schoolYearOptions(currentYear), targetYear])].sort().map((y) => (
                  <option key={y} value={y}>
                    {formatSchoolYear(y)}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          {picked.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-soft">Chưa có lớp nào được tạo ra.</p>
          ) : (
            <ul className="max-h-60 divide-y divide-line overflow-y-auto">
              {picked.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                  <span className="w-40 truncate text-ink-soft" title={c.name}>
                    {c.name} <span className="text-xs">({formatSchoolYear(c.schoolYear)})</span>
                  </span>
                  <ArrowRight className="size-4 text-ink-faint" />
                  <input
                    aria-label={`Tên lớp mới cho ${c.name}`}
                    value={names[c.id] ?? nextClassName(c.name)}
                    maxLength={100}
                    onChange={(e) => setNames((n) => ({ ...n, [c.id]: e.target.value }))}
                    className="h-8 min-w-32 flex-1 rounded-md border border-line bg-surface px-2 font-medium focus:border-brand-500 focus:outline-none"
                  />
                  <span className="text-xs text-ink-soft">chép {c.memberCount} học sinh</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
