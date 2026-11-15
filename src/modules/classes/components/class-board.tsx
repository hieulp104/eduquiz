"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  BookOpen,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  FileSpreadsheet,
  Filter,
  FolderPlus,
  LayoutGrid,
  List,
  Plus,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { Dropdown, DropdownItem, DropdownSeparator, PromptDialog } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatSchoolYear, type BoardClass, type BoardGroup } from "@/modules/classes/class-board";
import { createClassGroupAction } from "@/modules/classes/classes.actions";
import { AddClassesDialog } from "./add-classes-dialog";
import { ImportClassesDialog } from "./import-classes-dialog";
import { PromoteClassesDialog } from "./promote-classes-dialog";

type Props = { classes: BoardClass[]; groups: BoardGroup[]; currentYear: string };

type Sort = "name" | "nameDesc" | "newest" | "members";
const SORT_LABEL: Record<Sort, string> = {
  name: "Sắp xếp theo tên",
  nameDesc: "Tên (Z → A)",
  newest: "Mới tạo trước",
  members: "Sĩ số nhiều trước",
};
const NONE = "__none";
/** Lớp người khác phân quyền cho mình ("Quản lý giáo viên"). */
const SHARED = "__shared";
const sectionOf = (c: BoardClass) => (c.sharedBy ? SHARED : (c.groupId ?? NONE));

/** Trang "Danh sách lớp" của giáo viên: nút Thêm (4 cách tạo), lọc, tìm, sắp xếp, lớp gom theo nhóm. */
export function ClassBoard({ classes, groups, currentYear }: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"add" | "excel" | "promote" | "group" | null>(null);
  const [addGroupId, setAddGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const ownClasses = useMemo(() => classes.filter((c) => !c.sharedBy), [classes]);
  const hasShared = ownClasses.length < classes.length;
  const years = [...new Set(classes.map((c) => c.schoolYear).filter((y): y is string => Boolean(y)))].sort().reverse();
  const filtering = Boolean(search.trim() || yearFilter || groupFilter);

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = classes
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .filter((c) => !yearFilter || c.schoolYear === yearFilter)
      .sort((a, b) => {
        if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
        if (sort === "members") return b.memberCount - a.memberCount;
        const r = a.name.localeCompare(b.name, "vi", { numeric: true });
        return sort === "nameDesc" ? -r : r;
      });
    return [...groups.map((g) => ({ id: g.id, name: g.name })), { id: NONE, name: "Khác" }, { id: SHARED, name: "Lớp được phân quyền" }]
      .filter((g) => !groupFilter || g.id === groupFilter)
      .map((g) => ({ ...g, classes: list.filter((c) => sectionOf(c) === g.id) }))
      // Nhóm trống chỉ hiện khi không lọc (để thấy nhóm vừa tạo); "Khác" / "được phân quyền" trống thì ẩn.
      .filter((s) => s.classes.length > 0 || (!filtering && s.id !== NONE && s.id !== SHARED));
  }, [classes, groups, search, sort, yearFilter, groupFilter, filtering]);

  const allCollapsed = sections.length > 0 && sections.every((s) => collapsed.has(s.id));
  const toggle = (id: string) =>
    setCollapsed((c) => {
      const next = new Set(c);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const openAdd = (groupId: string | null = null) => {
    setAddGroupId(groupId);
    setDialog("add");
  };
  const box = "flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink shadow-sm hover:bg-muted";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-ink">Danh sách lớp</h1>
          <p className="text-sm text-ink-soft">{classes.length} lớp</p>
        </div>
        <div className="flex items-center gap-2">
          <Dropdown
            label="Thêm"
            align="right"
            triggerClassName="flex h-9 items-center gap-1.5 rounded-md bg-brand-700 px-7 text-sm font-medium text-white hover:bg-brand-800"
            trigger={
              <>
                <Plus className="size-4" /> Thêm
              </>
            }
          >
            <DropdownItem icon={<Plus className="size-4" />} onSelect={() => openAdd()}>
              Tạo lớp học
            </DropdownItem>
            <DropdownItem icon={<FileSpreadsheet className="size-4" />} onSelect={() => setDialog("excel")}>
              Tạo danh sách lớp bằng excel
            </DropdownItem>
            <DropdownItem icon={<BookOpen className="size-4" />} onSelect={() => setDialog("promote")}>
              Tạo lớp cho khóa mới
            </DropdownItem>
            <DropdownItem icon={<FolderPlus className="size-4" />} onSelect={() => setDialog("group")}>
              Tạo nhóm
            </DropdownItem>
          </Dropdown>
          <Dropdown
            label="Bộ lọc"
            align="right"
            triggerClassName={cn(box, (yearFilter || groupFilter) && "border-brand-500 text-brand-600")}
            trigger={
              <>
                <Filter className="size-4" /> Bộ lọc
              </>
            }
          >
            <p className="px-4 pt-1 pb-1 text-xs font-medium text-ink-soft">Năm học</p>
            <DropdownItem active={!yearFilter} onSelect={() => setYearFilter(null)}>
              Tất cả năm học
            </DropdownItem>
            {years.map((y) => (
              <DropdownItem key={y} active={yearFilter === y} onSelect={() => setYearFilter(y)}>
                {formatSchoolYear(y)}
              </DropdownItem>
            ))}
            <DropdownSeparator />
            <p className="px-4 pt-1 pb-1 text-xs font-medium text-ink-soft">Nhóm lớp</p>
            <DropdownItem active={!groupFilter} onSelect={() => setGroupFilter(null)}>
              Tất cả nhóm
            </DropdownItem>
            {[...groups, { id: NONE, name: "Khác" }, ...(hasShared ? [{ id: SHARED, name: "Lớp được phân quyền" }] : [])].map((g) => (
              <DropdownItem key={g.id} active={groupFilter === g.id} onSelect={() => setGroupFilter(g.id)}>
                {g.name}
              </DropdownItem>
            ))}
          </Dropdown>
          <Dropdown label="Cài đặt hiển thị" align="right" triggerClassName={cn(box, "px-2.5")} trigger={<Settings className="size-4" />}>
            <DropdownItem icon={<LayoutGrid className="size-4" />} active={view === "grid"} onSelect={() => setView("grid")}>
              Hiển thị dạng lưới
            </DropdownItem>
            <DropdownItem icon={<List className="size-4" />} active={view === "list"} onSelect={() => setView("list")}>
              Hiển thị dạng danh sách
            </DropdownItem>
          </Dropdown>
        </div>
      </div>

      <div className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Tìm kiếm theo tên lớp</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm theo tên lớp"
            className="h-9 w-full rounded-md border border-line bg-surface pr-9 pl-3 text-sm text-ink shadow-sm placeholder:text-ink-faint focus:border-brand-500 focus:outline-none"
          />
          <Search className="pointer-events-none absolute top-2.5 right-3 size-4 text-ink-soft" />
        </label>
        <Dropdown
          label="Sắp xếp"
          align="right"
          triggerClassName={cn(box, "text-ink-soft")}
          trigger={
            <>
              <ArrowUpDown className="size-4" /> {SORT_LABEL[sort]}
            </>
          }
        >
          {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
            <DropdownItem key={s} active={sort === s} onSelect={() => setSort(s)}>
              {s === "name" ? "Tên (A → Z)" : SORT_LABEL[s]}
            </DropdownItem>
          ))}
        </Dropdown>
        <button
          type="button"
          onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(sections.map((s) => s.id)))}
          title={allCollapsed ? "Mở rộng tất cả nhóm" : "Thu gọn tất cả nhóm"}
          aria-label={allCollapsed ? "Mở rộng tất cả nhóm" : "Thu gọn tất cả nhóm"}
          className={cn(box, "px-2.5 text-ink-soft")}
        >
          {allCollapsed ? <ChevronsUpDown className="size-4" /> : <ChevronsDownUp className="size-4" />}
        </button>
      </div>

      {sections.length === 0 ? (
        <p className="py-20 text-center text-sm text-ink-soft">
          {filtering ? "Không có lớp nào khớp tìm kiếm / bộ lọc." : "Chưa có lớp nào — bấm “Thêm” để tạo lớp."}
        </p>
      ) : (
        <div className="space-y-3">
          {sections.map((s) => {
            const open = !collapsed.has(s.id);
            return (
              <section key={s.id} className="rounded-lg border border-line bg-surface shadow-sm">
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggle(s.id)}
                    aria-expanded={open}
                    className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-ink"
                  >
                    <ChevronDown className={cn("size-4 text-ink-soft transition-transform", !open && "-rotate-90")} />
                    {s.name}
                    <span className="font-normal text-ink-soft">({s.classes.length} lớp)</span>
                  </button>
                  {s.id !== SHARED && (
                    <button
                      type="button"
                      onClick={() => openAdd(s.id === NONE ? null : s.id)}
                      className="flex items-center gap-1 text-xs text-brand-700 hover:underline dark:text-brand-300"
                    >
                      <Plus className="size-3.5" /> Thêm lớp
                    </button>
                  )}
                </div>
                {open &&
                  (s.classes.length === 0 ? (
                    <p className="border-t border-line px-4 py-4 text-sm text-ink-faint">Nhóm chưa có lớp nào.</p>
                  ) : view === "grid" ? (
                    <ul className="grid gap-3 border-t border-line p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {s.classes.map((c) => (
                        <li key={c.id}>
                          <Link
                            href={`/lop-hoc/${c.id}`}
                            className="group block h-full rounded-md border border-line px-4 py-3 transition-colors hover:border-brand-500"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium text-ink group-hover:text-brand-600">{c.name}</p>
                              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-ink-soft" title="Mã vào lớp">
                                {c.joinCode}
                              </span>
                            </div>
                            <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-soft">
                              <Users className="size-4" /> {c.memberCount} học sinh · {c.assignmentCount} bài
                            </p>
                            <p className="mt-1 text-xs text-ink-faint">
                              {c.sharedBy ? `Chủ lớp: ${c.sharedBy} · ` : ""}
                              {c.schoolYear ? `Năm học ${formatSchoolYear(c.schoolYear)}` : "Chưa có năm học"}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <table className="w-full border-t border-line text-sm">
                      <tbody>
                        {s.classes.map((c) => (
                          <tr key={c.id} className="border-b border-line last:border-0 hover:bg-muted/60">
                            <td className="px-4 py-2.5">
                              <Link href={`/lop-hoc/${c.id}`} className="font-medium text-ink hover:text-brand-600">
                                {c.name}
                              </Link>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs text-ink-soft">{c.joinCode}</td>
                            <td className="px-4 py-2.5 text-ink-soft">{c.memberCount} học sinh</td>
                            <td className="px-4 py-2.5 text-ink-soft">{c.assignmentCount} bài</td>
                            <td className="px-4 py-2.5 text-right text-xs text-ink-faint">{formatSchoolYear(c.schoolYear)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ))}
              </section>
            );
          })}
        </div>
      )}

      <AddClassesDialog
        open={dialog === "add"}
        onClose={() => setDialog(null)}
        groups={groups}
        currentYear={currentYear}
        defaultGroupId={addGroupId}
      />
      <ImportClassesDialog open={dialog === "excel"} onClose={() => setDialog(null)} />
      <PromoteClassesDialog
        open={dialog === "promote"}
        onClose={() => setDialog(null)}
        classes={ownClasses}
        groups={groups}
        currentYear={currentYear}
        onCreateClass={() => openAdd()}
      />
      <PromptDialog
        open={dialog === "group"}
        title="Tạo nhóm"
        label="Tên nhóm"
        placeholder="Nhập tên nhóm"
        submitLabel="Thêm"
        onClose={() => setDialog(null)}
        onSubmit={async (name) => {
          const res = await createClassGroupAction({ name });
          if (!res.ok) return res.message;
          router.refresh();
          return null;
        }}
      />
    </div>
  );
}
