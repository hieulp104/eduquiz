"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EllipsisVertical,
  Inbox,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Dropdown, DropdownItem, PromptDialog } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  createTeacherGroupAction,
  deleteTeacherTargetAction,
  renameTeacherGroupAction,
} from "@/modules/teachers/teachers.actions";
import type { ManagedTeacherItem, PermissionTarget, TeacherBoard } from "@/modules/teachers/teachers.types";
import { AddTeacherDialog } from "./add-teacher-dialog";
import { PermissionPanel } from "./permission-panel";

type Prompt =
  | { mode: "createGroup" }
  | { mode: "renameGroup"; id: string; name: string };

const sameTarget = (a: PermissionTarget | null, b: PermissionTarget) => a?.kind === b.kind && a.id === b.id;

/** Trang "Quản lý giáo viên": danh sách nhóm + giáo viên (trái), phân quyền lớp (giữa), đã phân quyền (phải). */
export function TeacherManager({ board }: { board: TeacherBoard }) {
  const router = useRouter();
  const [picked, setPicked] = useState<PermissionTarget | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedTeacherItem | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Mục đang chọn bị xóa (hoặc chưa chọn) → chọn nhóm / giáo viên đầu tiên.
  const exists = (t: PermissionTarget | null) =>
    t && (t.kind === "group" ? board.groups.some((g) => g.id === t.id) : board.teachers.some((m) => m.id === t.id));
  const selected: PermissionTarget | null = exists(picked)
    ? picked
    : board.groups[0]
      ? { kind: "group", id: board.groups[0].id }
      : board.teachers[0]
        ? { kind: "teacher", id: board.teachers[0].id }
        : null;

  const q = query.trim().toLowerCase();
  const groups = useMemo(() => board.groups.filter((g) => !q || g.name.toLowerCase().includes(q)), [board.groups, q]);
  const teachers = useMemo(
    () =>
      board.teachers.filter(
        (t) => !q || [t.name, t.accountName ?? "", t.phone ?? "", t.email ?? ""].some((s) => s.toLowerCase().includes(q)),
      ),
    [board.teachers, q],
  );

  async function remove(target: PermissionTarget, name: string) {
    const msg =
      target.kind === "group"
        ? `Xóa nhóm “${name}”? Giáo viên trong nhóm vẫn còn, nhưng mất các lớp được phân quyền qua nhóm.`
        : `Xóa giáo viên “${name}” khỏi danh sách? Giáo viên sẽ mất mọi lớp bạn đã phân quyền.`;
    if (!confirm(msg)) return;
    const res = await deleteTeacherTargetAction(target);
    if (!res.ok) return alert(res.message);
    setToast(target.kind === "group" ? "Đã xóa nhóm" : "Đã xóa giáo viên");
    router.refresh();
  }

  const addMenu = (trigger: React.ReactNode, triggerClassName: string, align: "left" | "right" = "left") => (
    <Dropdown label="Thêm giáo viên" align={align} trigger={trigger} triggerClassName={triggerClassName}>
      <DropdownItem icon={<UserPlus className="size-4" />} onSelect={() => setAddOpen(true)}>
        Thêm giáo viên
      </DropdownItem>
      <DropdownItem icon={<Plus className="size-4" />} onSelect={() => setPrompt({ mode: "createGroup" })}>
        Thêm nhóm giáo viên
      </DropdownItem>
    </Dropdown>
  );

  const empty = board.groups.length === 0 && board.teachers.length === 0;

  return (
    <>
      {toast && (
        <div
          role="status"
          className="fixed top-3 left-1/2 z-50 -translate-x-1/2 rounded-md bg-success-600 px-8 py-3 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}

      {empty ? (
        <div className="flex min-h-[calc(100dvh-9.5rem)] flex-col items-center justify-center rounded-xl border border-line bg-surface px-4 text-center shadow-sm">
          <Inbox className="size-14 text-brand-300" strokeWidth={1} />
          <p className="mt-5 max-w-xs text-sm text-ink">Chưa có nhóm hoặc giáo viên nào! Vui lòng tạo thêm</p>
          <p className="mt-1.5 max-w-xs text-sm text-ink-faint">Thêm giáo viên hoặc tạo nhóm để bắt đầu phân quyền</p>
          <div className="mt-5">
            {addMenu(
              <>
                <Plus className="size-4" /> Thêm giáo viên
              </>,
              "flex h-10 items-center gap-2 rounded-md bg-brand-700 px-5 text-sm font-medium text-white hover:bg-brand-800",
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:h-[calc(100dvh-9.5rem)] lg:flex-row">
          {/* ───── Trái: nhóm + giáo viên ───── */}
          {!collapsed && (
            <aside className="rounded-xl border border-line bg-surface shadow-sm flex shrink-0 flex-col p-4 lg:w-72">
              <div className="flex items-center gap-2 border-b border-line pb-3">
                <p className="flex-1 font-medium text-ink">Danh sách</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen((o) => !o);
                    setQuery("");
                  }}
                  aria-label="Tìm kiếm"
                  title="Tìm kiếm"
                  className={cn("rounded-md border border-line p-2 text-ink-soft hover:bg-muted", searchOpen && "border-brand-500 text-brand-600")}
                >
                  <Search className="size-4" />
                </button>
                {addMenu(
                  <Plus className="size-4" />,
                  "flex size-[34px] items-center justify-center rounded-md bg-brand-700 text-white shadow-sm hover:bg-brand-800",
                  "right",
                )}
              </div>
              {searchOpen && (
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm nhóm, giáo viên"
                  className="mt-3 h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none"
                />
              )}

              <div className="mt-3 min-h-0 flex-1 space-y-5 overflow-y-auto">
                <section>
                  <h2 className="flex items-center justify-between px-1 text-xs font-semibold tracking-wider text-ink-soft uppercase">
                    Nhóm giáo viên <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-ink-soft">{board.groups.length}</span>
                  </h2>
                  <ul className="mt-2 space-y-1.5">
                    {groups.map((g) => {
                      const target = { kind: "group", id: g.id } as const;
                      return (
                        <ListRow
                          key={g.id}
                          active={sameTarget(selected, target)}
                          onSelect={() => setPicked(target)}
                          avatar={<Users className="size-4 text-brand-600" />}
                          title={g.name}
                          subtitle={<span className="text-brand-600 dark:text-brand-300">{g.memberIds.length} thành viên</span>}
                          menu={
                            <>
                              <DropdownItem icon={<Pencil className="size-4" />} onSelect={() => setPrompt({ mode: "renameGroup", id: g.id, name: g.name })}>
                                Đổi tên nhóm
                              </DropdownItem>
                              <DropdownItem danger icon={<Trash2 className="size-4" />} onSelect={() => remove(target, g.name)}>
                                Xóa nhóm
                              </DropdownItem>
                            </>
                          }
                        />
                      );
                    })}
                    {groups.length === 0 && <li className="rounded-lg border border-dashed border-line px-3 py-3 text-center text-sm text-ink-faint">{q ? "Không có nhóm khớp" : "Chưa có nhóm"}</li>}
                  </ul>
                </section>

                <section>
                  <h2 className="flex items-center justify-between px-1 text-xs font-semibold tracking-wider text-ink-soft uppercase">
                    Giáo viên <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-ink-soft">{board.teachers.length}</span>
                  </h2>
                  <ul className="mt-2 space-y-1.5">
                    {teachers.map((t) => {
                      const target = { kind: "teacher", id: t.id } as const;
                      return (
                        <ListRow
                          key={t.id}
                          active={sameTarget(selected, target)}
                          onSelect={() => setPicked(target)}
                          avatar={<span className="text-sm font-semibold text-ink">{initial(t.name)}</span>}
                          title={t.name}
                          onEdit={() => setEditing(t)}
                          subtitle={t.phone ?? t.email}
                          menu={
                            <>
                              <DropdownItem icon={<Pencil className="size-4" />} onSelect={() => setEditing(t)}>
                                Sửa thông tin
                              </DropdownItem>
                              <DropdownItem danger icon={<Trash2 className="size-4" />} onSelect={() => remove(target, t.name)}>
                                Xóa giáo viên
                              </DropdownItem>
                            </>
                          }
                        />
                      );
                    })}
                    {teachers.length === 0 && (
                      <li className="rounded-lg border border-dashed border-line px-3 py-3 text-center text-sm text-ink-faint">{q ? "Không có giáo viên khớp" : "Chưa có giáo viên"}</li>
                    )}
                  </ul>
                </section>
              </div>
            </aside>
          )}

          {selected && (
            <PermissionPanel
              key={`${selected.kind}:${selected.id}`}
              board={board}
              target={selected}
              collapseButton={
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => !c)}
                  aria-label={collapsed ? "Hiện danh sách" : "Thu gọn danh sách"}
                  title={collapsed ? "Hiện danh sách" : "Thu gọn danh sách"}
                  className="hidden rounded-md border border-line p-1.5 text-ink-soft hover:bg-muted lg:block"
                >
                  {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
                </button>
              }
              onToast={setToast}
              onRenameGroup={(id, name) => setPrompt({ mode: "renameGroup", id, name })}
              onDeleteGroup={(id, name) => remove({ kind: "group", id }, name)}
            />
          )}
        </div>
      )}

      <AddTeacherDialog open={addOpen} onClose={() => setAddOpen(false)} onDone={setToast} />
      <AddTeacherDialog open={editing !== null} editing={editing} onClose={() => setEditing(null)} onDone={setToast} />
      <PromptDialog
        open={prompt !== null}
        title={prompt?.mode === "createGroup" ? "Thêm nhóm giáo viên" : "Đổi tên nhóm"}
        label="Tên nhóm"
        defaultValue={prompt && prompt.mode !== "createGroup" ? prompt.name : ""}
        placeholder="VD: Tổ Toán"
        submitLabel={prompt?.mode === "createGroup" ? "Thêm" : "Lưu"}
        onClose={() => setPrompt(null)}
        onSubmit={async (value) => {
          if (!prompt) return null;
          if (prompt.mode === "createGroup") {
            const res = await createTeacherGroupAction({ name: value });
            if (!res.ok) return res.message;
            setPicked({ kind: "group", id: res.data.id });
            setToast("Thêm nhóm thành công");
          } else {
            const res = await renameTeacherGroupAction({ groupId: prompt.id, name: value });
            if (!res.ok) return res.message;
            setToast("Đã lưu");
          }
          router.refresh();
          return null;
        }}
      />
    </>
  );
}

const initial = (name: string) => name.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? "?";

function ListRow({
  active,
  onSelect,
  avatar,
  title,
  subtitle,
  onEdit,
  menu,
}: {
  active: boolean;
  onSelect: () => void;
  avatar: React.ReactNode;
  title: string;
  subtitle: React.ReactNode;
  onEdit?: () => void;
  menu: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "group flex items-center gap-1 rounded-lg border pr-1.5 transition-colors",
        active ? "border-brand-500 bg-muted shadow-sm" : "border-line bg-surface hover:border-brand-300 hover:bg-muted/60",
      )}
    >
      <button type="button" onClick={onSelect} aria-current={active} className="flex min-w-0 flex-1 items-center gap-3 px-2.5 py-2.5 text-left">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted ring-1 ring-line">{avatar}</span>
        <span className="min-w-0">
          <span className={cn("block truncate text-sm", active ? "font-medium text-brand-700 dark:text-brand-300" : "text-ink")}>{title}</span>
          <span className="block truncate text-xs text-ink-soft">{subtitle}</span>
        </span>
      </button>
      {onEdit && (
        <button type="button" onClick={onEdit} aria-label={`Sửa ${title}`} title="Sửa thông tin" className="rounded p-1 text-ink-faint hover:text-brand-600">
          <Pencil className="size-3.5" />
        </button>
      )}
      <Dropdown
        label={`Tùy chọn ${title}`}
        align="right"
        trigger={<EllipsisVertical className="size-4" />}
        triggerClassName="rounded p-1 text-ink-faint hover:bg-surface hover:text-ink"
      >
        {menu}
      </Dropdown>
    </li>
  );
}
