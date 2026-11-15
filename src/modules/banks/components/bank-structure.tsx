"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  EllipsisVertical,
  FolderOpen,
  FolderPlus,
  Layers,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { Alert, Button, buttonClass, Dropdown, DropdownItem, DropdownSeparator, Modal, PromptDialog, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { stripTags } from "@/lib/inline-format";
import { LEVELS, type Level } from "@/modules/exams/exam-text";
import {
  addSectionsAction,
  buildFromBookAction,
  deleteItemsAction,
  deleteSectionAction,
  moveSectionAction,
  renameSectionAction,
  updateItemAction,
} from "@/modules/banks/banks.actions";
import {
  BANKS_PATH,
  buildSectionTree,
  flattenTree,
  subtreeIds,
  UNSORTED,
  type BankItemView,
  type SectionRow,
  type SectionTreeNode,
} from "@/modules/banks/banks.types";
import { ItemCard } from "./item-card";

type Props = { bankId: string; bookTitle: string | null; sections: SectionRow[]; items: BankItemView[]; q: string; initialSection: string | null };
const ALL = "__all";

/** Tab "Cấu trúc": cây chương / bài (trái) + câu hỏi của mục đang chọn (phải). */
export function BankStructure({ bankId, bookTitle, sections, items, q, initialSection }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(initialSection ?? ALL);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<{ parentId: string | null; parentTitle: string | null } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tree = useMemo(() => buildSectionTree(sections), [sections]);
  const flat = useMemo(() => flattenTree(tree), [tree]);
  const unsorted = items.filter((i) => !i.sectionId).length;
  const query = q.trim().toLowerCase();

  const visibleItems = useMemo(() => {
    let list = items;
    if (selected === UNSORTED) list = list.filter((i) => !i.sectionId);
    else if (selected !== ALL) {
      const ids = subtreeIds(sections, selected);
      list = list.filter((i) => i.sectionId && ids.has(i.sectionId));
    }
    if (query) list = list.filter((i) => i.code.toLowerCase() === query.replace(/^#/, "") || stripTags(i.content).toLowerCase().includes(query));
    return list;
  }, [items, sections, selected, query]);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) return setError(res.message ?? "Có lỗi xảy ra.");
      router.refresh();
    });

  const isHidden = (n: SectionTreeNode) => {
    let p = n.parentId;
    while (p) {
      if (collapsed.has(p)) return true;
      p = sections.find((s) => s.id === p)?.parentId ?? null;
    }
    return false;
  };
  const toggle = (id: string) =>
    setCollapsed((c) => {
      const next = new Set(c);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sectionTitle = selected === ALL ? "Tất cả câu hỏi" : selected === UNSORTED ? "Chưa xếp bài" : (sections.find((s) => s.id === selected)?.title ?? "");

  if (sections.length === 0 && items.length === 0) {
    return (
      <div className="flex flex-col items-center px-4 py-16 text-center">
        <FolderOpen className="size-16 text-ink-faint" strokeWidth={1} />
        <p className="mt-4 text-lg font-medium text-ink">Chưa có cấu trúc nào được tạo</p>
        <p className="mt-1 text-sm text-ink-soft">Tạo cấu trúc để tổ chức câu hỏi theo chương, bài học</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            disabled={!bookTitle || pending}
            title={bookTitle ? `Chép mục lục “${bookTitle}”` : "Ngân hàng chưa chọn sách — sửa thông tin ngân hàng để chọn"}
            onClick={() => run(() => buildFromBookAction({ id: bankId }))}
            className={buttonClass("secondary", "md", "border-brand-500 text-brand-700 dark:text-brand-300")}
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <WandSparkles className="size-4" />} Tạo cấu trúc theo sách
          </button>
          <button type="button" onClick={() => setAdding({ parentId: null, parentTitle: null })} className={buttonClass("primary")}>
            <Plus className="size-4" /> Thêm cấu trúc
          </button>
        </div>
        {!bookTitle && <p className="mt-3 text-xs text-ink-faint">“Tạo cấu trúc theo sách” cần chọn sách khi tạo / sửa ngân hàng.</p>}
        {error && <Alert variant="danger" className="mt-4">{error}</Alert>}
        <SectionDialog bankId={bankId} target={adding} onClose={() => setAdding(null)} />
      </div>
    );
  }

  const rowCls = (active: boolean) =>
    cn("flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm", active ? "bg-muted font-medium text-brand-700 dark:text-brand-300" : "text-ink hover:bg-muted/60");

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[320px_1fr]">
      {/* ───── Cây cấu trúc ───── */}
      <aside className="rounded-lg border border-line p-2 lg:max-h-[calc(100dvh-16rem)] lg:overflow-y-auto">
        <div className="mb-1 flex items-center justify-between px-2 py-1">
          <p className="text-xs font-semibold tracking-wider text-ink-soft uppercase">Cấu trúc</p>
          <button
            type="button"
            onClick={() => setAdding({ parentId: null, parentTitle: null })}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-muted dark:text-brand-300"
          >
            <Plus className="size-3.5" /> Thêm chương
          </button>
        </div>
        <button type="button" onClick={() => setSelected(ALL)} className={cn(rowCls(selected === ALL), "w-full")}>
          <Layers className="size-4 shrink-0 text-brand-600" />
          <span className="flex-1 truncate">Tất cả câu hỏi</span>
          <span className="text-xs text-ink-soft">{items.length}</span>
        </button>
        <ul className="mt-0.5 space-y-0.5">
          {flat.map((n) =>
            isHidden(n) ? null : (
              <li key={n.id} className="group flex items-center" style={{ paddingLeft: n.depth * 16 }}>
                <button
                  type="button"
                  onClick={() => toggle(n.id)}
                  aria-label={collapsed.has(n.id) ? "Mở rộng" : "Thu gọn"}
                  className={cn("rounded p-0.5 text-ink-faint hover:text-ink", !n.children.length && "invisible")}
                >
                  <ChevronDown className={cn("size-4 transition-transform", collapsed.has(n.id) && "-rotate-90")} />
                </button>
                <button type="button" onClick={() => setSelected(n.id)} className={rowCls(selected === n.id)} title={n.title}>
                  <span className="flex-1 truncate">{n.title}</span>
                  <span className="text-xs text-ink-soft">{n.total}</span>
                </button>
                <Dropdown
                  label={`Tùy chọn ${n.title}`}
                  align="right"
                  trigger={<EllipsisVertical className="size-4" />}
                  triggerClassName="rounded p-1 text-ink-faint opacity-60 hover:bg-muted hover:text-ink group-hover:opacity-100"
                >
                  <DropdownItem icon={<FolderPlus className="size-4" />} onSelect={() => setAdding({ parentId: n.id, parentTitle: n.title })}>
                    Thêm mục con
                  </DropdownItem>
                  <DropdownItem icon={<Plus className="size-4" />} onSelect={() => router.push(`${BANKS_PATH}/${bankId}/nhap?bai=${n.id}`)}>
                    Nhập câu hỏi vào đây
                  </DropdownItem>
                  <DropdownItem icon={<Pencil className="size-4" />} onSelect={() => setRenaming({ id: n.id, title: n.title })}>
                    Đổi tên
                  </DropdownItem>
                  <DropdownItem icon={<ArrowUp className="size-4" />} onSelect={() => run(() => moveSectionAction({ id: n.id, direction: "up" }))}>
                    Lên trên
                  </DropdownItem>
                  <DropdownItem icon={<ArrowDown className="size-4" />} onSelect={() => run(() => moveSectionAction({ id: n.id, direction: "down" }))}>
                    Xuống dưới
                  </DropdownItem>
                  <DropdownSeparator />
                  <DropdownItem
                    danger
                    icon={<Trash2 className="size-4" />}
                    onSelect={() => {
                      if (!confirm(`Xóa “${n.title}”${n.children.length ? " và các mục con" : ""}? ${n.total} câu hỏi bên trong sẽ chuyển về “Chưa xếp bài”.`)) return;
                      if (selected === n.id) setSelected(ALL);
                      run(() => deleteSectionAction({ id: n.id }));
                    }}
                  >
                    Xóa
                  </DropdownItem>
                </Dropdown>
              </li>
            ),
          )}
        </ul>
        {unsorted > 0 && (
          <button type="button" onClick={() => setSelected(UNSORTED)} className={cn(rowCls(selected === UNSORTED), "mt-1 w-full border-t border-line pt-2")}>
            <FolderOpen className="size-4 shrink-0 text-ink-faint" />
            <span className="flex-1 truncate italic">Chưa xếp bài</span>
            <span className="text-xs text-ink-soft">{unsorted}</span>
          </button>
        )}
      </aside>

      {/* ───── Câu hỏi ───── */}
      <section className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-medium text-ink">
            {sectionTitle} <span className="font-normal text-ink-soft">({visibleItems.length} câu{query ? ` khớp “${q}”` : ""})</span>
          </p>
          {query && (
            <Link href={`${BANKS_PATH}/${bankId}`} className="text-sm text-brand-700 hover:underline dark:text-brand-300">
              Bỏ tìm kiếm
            </Link>
          )}
          <Link
            href={`${BANKS_PATH}/${bankId}/nhap${selected !== ALL && selected !== UNSORTED ? `?bai=${selected}` : ""}`}
            className={buttonClass("secondary", "sm")}
          >
            <Plus className="size-4" /> Nhập câu hỏi
          </Link>
        </div>
        {error && <Alert variant="danger">{error}</Alert>}
        {visibleItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line px-4 py-14 text-center text-sm text-ink-soft">
            {query ? "Không có câu hỏi nào khớp tìm kiếm." : "Chưa có câu hỏi — bấm “Nhập câu hỏi” để thêm."}
          </div>
        ) : (
          <ul className="space-y-3">
            {visibleItems.map((it, i) => (
              <li key={it.id}>
                <ItemCard
                  no={i + 1}
                  code={it.code}
                  level={it.level}
                  content={it.content}
                  options={it.options}
                  correctIndex={it.correctIndex}
                  actions={
                    <>
                      <select
                        aria-label="Mức độ"
                        value={it.level ?? ""}
                        disabled={pending}
                        onChange={(e) => run(() => updateItemAction({ id: it.id, level: (e.target.value || null) as Level | null }))}
                        className="h-7 rounded-md border border-line bg-surface px-1.5 text-xs text-ink"
                      >
                        <option value="">Mức độ —</option>
                        {(Object.keys(LEVELS) as Level[]).map((l) => (
                          <option key={l} value={l}>
                            {LEVELS[l]}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Chuyển sang bài"
                        value={it.sectionId ?? ""}
                        disabled={pending}
                        onChange={(e) => run(() => updateItemAction({ id: it.id, sectionId: e.target.value || null }))}
                        className="h-7 max-w-44 rounded-md border border-line bg-surface px-1.5 text-xs text-ink"
                      >
                        <option value="">Chưa xếp bài</option>
                        {flat.map((n) => (
                          <option key={n.id} value={n.id}>
                            {"— ".repeat(n.depth)}
                            {n.title}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={pending}
                        aria-label="Xóa câu hỏi"
                        title="Xóa câu hỏi"
                        onClick={() => confirm("Xóa câu hỏi này khỏi ngân hàng?") && run(() => deleteItemsAction({ bankId, ids: [it.id] }))}
                        className="rounded-md border border-line p-1 text-danger-600 hover:bg-danger-50"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <SectionDialog bankId={bankId} target={adding} onClose={() => setAdding(null)} />
      <PromptDialog
        open={renaming !== null}
        title="Đổi tên"
        label="Tên chương / bài"
        defaultValue={renaming?.title ?? ""}
        maxLength={200}
        onClose={() => setRenaming(null)}
        onSubmit={async (title) => {
          if (!renaming) return null;
          const res = await renameSectionAction({ id: renaming.id, title });
          if (!res.ok) return res.message;
          router.refresh();
          return null;
        }}
      />
    </div>
  );
}

/** "Thêm cấu trúc": mỗi dòng 1 chương / bài (cùng cấp). */
function SectionDialog({ bankId, target, onClose }: { bankId: string; target: { parentId: string | null; parentTitle: string | null } | null; onClose: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const close = () => {
    setText("");
    setError(null);
    onClose();
  };
  return (
    <Modal
      open={target !== null}
      onClose={close}
      title={target?.parentTitle ? `Thêm mục con vào “${target.parentTitle}”` : "Thêm cấu trúc"}
      description="Mỗi dòng 1 mục — VD “Chương 1. Các số từ 0 đến 10”. Thêm mục con sau bằng nút ⋮ ở từng mục."
      footer={
        <>
          <Button variant="secondary" onClick={close} className="w-24">
            Hủy
          </Button>
          <Button
            disabled={pending || !text.trim()}
            className="w-28"
            onClick={() =>
              startTransition(async () => {
                const res = await addSectionsAction({ bankId, parentId: target?.parentId ?? null, titles: text });
                if (!res.ok) return setError(res.message);
                close();
                router.refresh();
              })
            }
          >
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            Thêm
          </Button>
        </>
      }
    >
      <Textarea autoFocus rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Chương 1. …\nChương 2. …"} aria-label="Tên các mục, mỗi dòng 1 mục" />
      {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
    </Modal>
  );
}
