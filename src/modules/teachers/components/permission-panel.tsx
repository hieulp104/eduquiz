"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BookMarked, EllipsisVertical, Inbox, Layers, LoaderCircle, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import { Alert, Button, Dropdown, DropdownItem } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatSchoolYear } from "@/modules/classes/class-board";
import { saveClassPermissionsAction, setGroupMembersAction } from "@/modules/teachers/teachers.actions";
import type { PermissionTarget, TeacherBoard } from "@/modules/teachers/teachers.types";

type Props = {
  board: TeacherBoard;
  target: PermissionTarget;
  collapseButton: ReactNode;
  onToast: (message: string) => void;
  onRenameGroup: (id: string, name: string) => void;
  onDeleteGroup: (id: string, name: string) => void;
};

const CARD = "rounded-xl border border-line bg-surface shadow-sm";
const initialOf = (name: string) => name.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? "?";

/**
 * Cột giữa (chọn lớp để phân quyền) + cột phải (đã phân quyền) cho 1 nhóm / 1 giáo viên.
 * Danh sách lớp tích chọn là bản nháp — bấm "Lưu" mới ghi. Thành viên nhóm thì lưu ngay.
 * Component được gắn `key` theo mục đang chọn → đổi mục là nháp tự làm mới.
 */
export function PermissionPanel({ board, target, collapseButton, onToast, onRenameGroup, onDeleteGroup }: Props) {
  const router = useRouter();
  const group = target.kind === "group" ? board.groups.find((g) => g.id === target.id) : undefined;
  const teacher = target.kind === "teacher" ? board.teachers.find((t) => t.id === target.id) : undefined;

  const saved = useMemo(
    () =>
      board.permissions
        .filter((p) => (target.kind === "group" ? p.groupId === target.id : p.memberId === target.id))
        .map((p) => p.classId),
    [board.permissions, target],
  );
  const [draft, setDraft] = useState<Set<string>>(() => new Set(saved));
  const [tab, setTab] = useState<"class" | "course">("class");
  const [query, setQuery] = useState("");
  const [showMembers, setShowMembers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Giáo viên: lớp đã được cấp qua nhóm (chỉ hiện để biết, sửa ở nhóm).
  const viaGroup = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!teacher) return map;
    const groupsOfTeacher = board.groups.filter((g) => g.memberIds.includes(teacher.id));
    for (const p of board.permissions) {
      const g = groupsOfTeacher.find((x) => x.id === p.groupId);
      if (g) map.set(p.classId, [...(map.get(p.classId) ?? []), g.name]);
    }
    return map;
  }, [board, teacher]);

  const q = query.trim().toLowerCase();
  const classes = board.classes.filter((c) => !q || c.name.toLowerCase().includes(q));
  const allChecked = classes.length > 0 && classes.every((c) => draft.has(c.id));
  const dirty = draft.size !== saved.length || saved.some((id) => !draft.has(id));
  const granted = board.classes.filter((c) => draft.has(c.id));

  const toggle = (id: string) =>
    setDraft((d) => {
      const next = new Set(d);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setDraft((d) => {
      const next = new Set(d);
      for (const c of classes) {
        if (allChecked) next.delete(c.id);
        else next.add(c.id);
      }
      return next;
    });

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveClassPermissionsAction({ ...target, classIds: [...draft] });
      if (!res.ok) return setError(res.message);
      onToast("Lưu phân quyền thành công");
      router.refresh();
    });
  }

  function setMembers(memberIds: string[]) {
    if (!group) return;
    setError(null);
    startTransition(async () => {
      const res = await setGroupMembersAction({ groupId: group.id, memberIds });
      if (!res.ok) return setError(res.message);
      router.refresh();
    });
  }

  if (!group && !teacher) return null;
  const members = group ? board.teachers.filter((t) => group.memberIds.includes(t.id)) : [];
  const outsiders = group ? board.teachers.filter((t) => !group.memberIds.includes(t.id)) : [];
  const teacherGroups = teacher ? board.groups.filter((g) => g.memberIds.includes(teacher.id)) : [];

  return (
    <>
      {/* ───── Giữa: chọn lớp ───── */}
      <section className={cn(CARD, "flex min-w-0 flex-1 flex-col overflow-hidden")}>
        {/* Đầu thẻ: nhóm / giáo viên đang chọn */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          {collapseButton}
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted ring-1 ring-line">
            {group ? <Users className="size-5 text-brand-600" /> : <span className="font-semibold text-ink">{initialOf(teacher!.name)}</span>}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">{group?.name ?? teacher!.name}</p>
            <p className="truncate text-xs text-ink-soft">
              {group
                ? `Nhóm giáo viên · ${group.memberIds.length} thành viên`
                : [teacher!.phone, teacher!.email].filter(Boolean).join(" · ") +
                  (teacher!.accountName ? ` · Có tài khoản: ${teacher!.accountName}` : "")}
            </p>
          </div>
          {group && (
            <button
              type="button"
              onClick={() => setShowMembers((s) => !s)}
              className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-ink-soft hover:bg-muted hover:text-ink"
            >
              <Users className="size-3.5" /> {showMembers ? "Ẩn thành viên" : "Xem thành viên"}
            </button>
          )}
        </div>

        <div role="tablist" className="flex border-b border-line px-5 text-sm">
          {(
            [
              ["class", "Phân quyền lớp", Layers],
              ["course", "Phân quyền khóa học", BookMarked],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-4 py-3",
                tab === key ? "border-brand-600 font-medium text-brand-700 dark:text-brand-300" : "border-transparent text-ink-soft hover:text-ink",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-5 pt-4">
          {group && showMembers && (
            <div className="rounded-lg border border-line bg-muted/50 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm text-ink">
                  <Users className="size-4 text-brand-600" /> Thành viên nhóm <span className="font-medium">{group.name}</span>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-ink-soft ring-1 ring-line">{members.length}</span>
                </p>
                <Dropdown
                  label="Tùy chọn nhóm"
                  align="right"
                  trigger={<EllipsisVertical className="size-4" />}
                  triggerClassName="rounded p-1 text-ink-soft hover:bg-surface hover:text-ink"
                >
                  <DropdownItem icon={<Pencil className="size-4" />} onSelect={() => onRenameGroup(group.id, group.name)}>
                    Đổi tên nhóm
                  </DropdownItem>
                  <DropdownItem danger icon={<Trash2 className="size-4" />} onSelect={() => onDeleteGroup(group.id, group.name)}>
                    Xóa nhóm
                  </DropdownItem>
                </Dropdown>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {members.length === 0 && <span className="text-sm text-ink-faint">Nhóm chưa có ai —</span>}
                {members.map((m) => (
                  <span
                    key={m.id}
                    className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-1.5 pl-1 text-sm text-ink shadow-sm"
                  >
                    <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">{initialOf(m.name)}</span>
                    {m.name}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setMembers(group.memberIds.filter((id) => id !== m.id))}
                      aria-label={`Bỏ ${m.name} khỏi nhóm`}
                      className="rounded-full p-0.5 text-ink-faint hover:bg-muted hover:text-danger-600"
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
                <Dropdown
                  label="Thêm thành viên"
                  trigger={
                    <>
                      <Plus className="size-4" /> Thêm
                    </>
                  }
                  triggerClassName="flex items-center gap-1 rounded-full border border-dashed border-brand-500 bg-surface px-3 py-1 text-sm text-brand-700 hover:bg-muted dark:text-brand-300"
                >
                  {outsiders.length === 0 ? (
                    <p className="px-4 py-2 text-sm text-ink-faint">
                      {board.teachers.length === 0 ? "Chưa có giáo viên — thêm giáo viên trước." : "Mọi giáo viên đã ở trong nhóm."}
                    </p>
                  ) : (
                    outsiders.map((t) => (
                      <DropdownItem key={t.id} onSelect={() => setMembers([...group.memberIds, t.id])}>
                        <span>
                          {t.name} <span className="text-xs text-ink-faint">{t.phone ?? t.email}</span>
                        </span>
                      </DropdownItem>
                    ))
                  )}
                </Dropdown>
              </div>
            </div>
          )}

          {teacher && (
            <div className="flex items-center gap-2 rounded-lg border border-line bg-muted/50 px-3.5 py-3 text-sm text-ink-soft">
              <Users className="size-4 shrink-0 text-brand-600" />
              {teacherGroups.length ? (
                <span>
                  Thuộc nhóm: <span className="font-medium text-ink">{teacherGroups.map((g) => g.name).join(", ")}</span> — lớp cấp qua nhóm được đánh
                  dấu bên dưới.
                </span>
              ) : (
                "Chưa thuộc nhóm nào."
              )}
            </div>
          )}

          {tab === "course" ? (
            <EmptyBox icon={<BookMarked className="size-8" />} title="Chưa có khóa học nào" hint="Khi có khóa học, bạn phân quyền khóa học tại đây." />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 py-4">
                <p className="text-sm font-medium text-ink">
                  Lớp học của bạn <span className="font-normal text-ink-soft">({board.classes.length})</span>
                </p>
                <div className="flex items-center gap-3">
                  <label className="relative w-56">
                    <span className="sr-only">Tìm lớp</span>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Tìm lớp"
                      className="h-9 w-full rounded-md border border-line bg-surface pr-8 pl-3 text-sm text-ink shadow-sm placeholder:text-ink-faint focus:border-brand-500 focus:outline-none"
                    />
                    <Search className="pointer-events-none absolute top-2.5 right-2.5 size-4 text-ink-soft" />
                  </label>
                  <label className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-line px-3 text-sm text-ink shadow-sm hover:bg-muted">
                    <input type="checkbox" className="size-4 accent-brand-600" checked={allChecked} disabled={classes.length === 0} onChange={toggleAll} />
                    Chọn tất cả
                  </label>
                </div>
              </div>

              <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-4">
                {board.classes.length === 0 ? (
                  <EmptyBox
                    icon={<Layers className="size-8" />}
                    title="Chưa có lớp học"
                    hint={
                      <>
                        <Link href="/lop-hoc" className="text-brand-700 hover:underline dark:text-brand-300">
                          Tạo lớp học
                        </Link>{" "}
                        trước khi phân quyền.
                      </>
                    }
                  />
                ) : classes.length === 0 ? (
                  <EmptyBox icon={<Search className="size-8" />} title="Không có lớp nào khớp tìm kiếm" />
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {classes.map((c) => {
                      const via = viaGroup.get(c.id);
                      const on = draft.has(c.id);
                      return (
                        <li key={c.id}>
                          <label
                            className={cn(
                              "flex h-full cursor-pointer items-center gap-3 rounded-lg border bg-surface p-3 shadow-sm transition-colors",
                              on ? "border-brand-500 ring-1 ring-brand-500" : "border-line hover:border-brand-300",
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-10 shrink-0 items-center justify-center rounded-lg",
                                on ? "bg-brand-600 text-white" : "bg-muted text-brand-600",
                              )}
                            >
                              <Layers className="size-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-ink">{c.name}</span>
                              <span className="block text-xs text-ink-soft">
                                {c.memberCount} học sinh · {formatSchoolYear(c.schoolYear)}
                              </span>
                              {via && <span className="mt-0.5 block text-xs text-brand-600 dark:text-brand-300">Đã cấp qua nhóm {via.join(", ")}</span>}
                            </span>
                            <input type="checkbox" className="size-4 shrink-0 accent-brand-600" checked={on} onChange={() => toggle(c.id)} />
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        {error && (
          <Alert variant="danger" className="mx-5 mb-3">
            {error}
          </Alert>
        )}
        <div className="flex items-center justify-end gap-3 border-t border-line bg-muted/40 px-5 py-3">
          {dirty && <span className="mr-auto text-xs text-warning-700">Có thay đổi chưa lưu</span>}
          <Button variant="secondary" disabled={!dirty || pending} onClick={() => setDraft(new Set(saved))} className="w-24">
            Hủy
          </Button>
          <Button disabled={!dirty || pending} onClick={save} className="w-32">
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            Lưu
          </Button>
        </div>
      </section>

      {/* ───── Phải: đã phân quyền ───── */}
      <aside className={cn(CARD, "flex shrink-0 flex-col p-4 lg:w-72")}>
        <div className="border-b border-line pb-3">
          <p className="font-medium text-ink">Đã phân quyền</p>
          <div className="mt-2 flex gap-2 text-xs">
            <span className="rounded-full bg-muted px-2.5 py-1 text-ink">
              <span className="font-semibold text-brand-700 dark:text-brand-300">{granted.length}</span> lớp
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-ink">
              <span className="font-semibold">0</span> khóa học
            </span>
          </div>
        </div>
        {granted.length === 0 ? (
          <EmptyBox icon={<Inbox className="size-8" />} title="Chưa có quyền nào được cấp" hint="Tích vào lớp học hoặc khóa học bên cạnh để phân quyền" />
        ) : (
          <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
            {granted.map((c) => (
              <li key={c.id} className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2 shadow-sm">
                <span className="flex size-7 items-center justify-center rounded-md bg-muted text-brand-600">
                  <Layers className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{c.name}</span>
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  aria-label={`Bỏ phân quyền lớp ${c.name}`}
                  className="rounded p-1 text-ink-faint hover:bg-muted hover:text-danger-600"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-ink-soft">
          Phân quyền để bạn quản lý ai phụ trách lớp nào. Nếu giáo viên có tài khoản riêng trùng SĐT/email, họ sẽ thấy lớp, giao đề và xem kết quả
          (không sửa lớp hay xóa học sinh).
        </p>
      </aside>
    </>
  );
}

function EmptyBox({ icon, title, hint }: { icon: ReactNode; title: string; hint?: ReactNode }) {
  return (
    <div className="my-4 flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-line px-4 py-10 text-center">
      <span className="text-brand-300">{icon}</span>
      <p className="mt-3 text-sm font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}
