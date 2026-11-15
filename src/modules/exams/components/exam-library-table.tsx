"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronsUpDown, ChevronUp, FileText, Folder, FolderInput, Landmark, Pencil, Trash2, X } from "lucide-react";
import { Badge, PromptDialog } from "@/components/ui";
import { cn, formatDateTime } from "@/lib/utils";
import {
  EXAM_STATUS_LABEL,
  type ExamStatus,
  type LibraryExam,
  type LibraryFolder,
  type LibrarySort,
  type SortDir,
} from "@/modules/exams/exam-library.types";
import { deleteItemsAction, moveItemsAction, renameFolderAction } from "@/modules/exams/exam-library.actions";

type Props = {
  folders: LibraryFolder[];
  exams: LibraryExam[];
  sort?: LibrarySort;
  dir: SortDir;
  allFolders: { id: string; name: string }[];
  /** Dòng ghim "Ngân hàng câu hỏi chung" — chỉ hiện ở thư mục gốc. */
  bankHref?: string;
  canEdit: boolean;
};

const STATUS_VARIANT: Record<ExamStatus, "success" | "neutral" | "warning"> = {
  OPEN: "success",
  CLOSED: "neutral",
  DRAFT: "warning",
};

// Tên ~1/3 bề ngang, 5 cột còn lại chia đều — giống bố cục mẫu.
const COLS = "grid grid-cols-[48px_minmax(240px,2.6fr)_repeat(5,minmax(130px,1fr))] items-center gap-x-3";

/** Tiêu đề cột sắp xếp được; `active` = chiều đang sắp theo cột này, null nếu không. */
function SortHeader({ href, active, children }: { href: string; active: SortDir | null; children: React.ReactNode }) {
  return (
    <Link href={href} scroll={false} className="inline-flex items-center gap-1.5 hover:text-ink">
      {children}
      {active === "asc" ? (
        <ChevronUp className="size-4 text-brand-700" />
      ) : active === "desc" ? (
        <ChevronDown className="size-4 text-brand-700" />
      ) : (
        <ChevronsUpDown className="size-4" />
      )}
    </Link>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      className="size-4 cursor-pointer accent-brand-700"
    />
  );
}

export function ExamLibraryTable({ folders, exams, sort, dir, allFolders, bankHref, canEdit }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [selExams, setSelExams] = useState<Set<string>>(new Set());
  const [selFolders, setSelFolders] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<LibraryFolder | null>(null);
  const [moveTarget, setMoveTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  const total = folders.length + exams.length;
  const selected = selExams.size + selFolders.size;
  const allChecked = total > 0 && selected === total;

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };
  const clearSelection = () => {
    setSelExams(new Set());
    setSelFolders(new Set());
  };

  /** Bấm tiêu đề cột: tăng dần → giảm dần → bỏ sắp xếp. */
  const sortHref = (key: LibrarySort) => {
    const next = new URLSearchParams(params);
    if (sort !== key) {
      next.set("sap-xep", key);
      next.set("chieu", "asc");
    } else if (dir === "asc") {
      next.set("chieu", "desc");
    } else {
      next.delete("sap-xep");
      next.delete("chieu");
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const header = (k: LibrarySort, label: string) => (
    <SortHeader href={sortHref(k)} active={sort === k ? dir : null}>
      {label}
    </SortHeader>
  );

  // Không cho chọn chính thư mục đang chọn làm đích (server cũng chặn cả thư mục con).
  const moveOptions = useMemo(() => allFolders.filter((f) => !selFolders.has(f.id)), [allFolders, selFolders]);

  function runBulk(action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) return setError(res.message ?? "Thao tác thất bại.");
      clearSelection();
      setMoveTarget("");
      router.refresh();
    });
  }

  const items = { examIds: [...selExams], folderIds: [...selFolders] };

  return (
    <div className="space-y-3">
      {selected > 0 && canEdit && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm dark:border-brand-900 dark:bg-brand-900/30">
          <span className="font-medium text-brand-800 dark:text-brand-200">Đã chọn {selected}</span>
          <div className="flex items-center gap-2">
            <FolderInput className="size-4 text-ink-soft" />
            <select
              aria-label="Chuyển vào thư mục"
              value={moveTarget}
              onChange={(e) => setMoveTarget(e.target.value)}
              className="h-8 rounded-md border border-line bg-surface px-2 text-sm text-ink"
            >
              <option value="">Chuyển vào…</option>
              <option value="__root">Thư mục gốc</option>
              {moveOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!moveTarget || pending}
              onClick={() => runBulk(() => moveItemsAction({ ...items, targetId: moveTarget === "__root" ? null : moveTarget }))}
              className="h-8 rounded-md bg-brand-700 px-3 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
            >
              Chuyển
            </button>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const msg =
                selFolders.size > 0
                  ? `Xóa ${selected} mục đã chọn? Thư mục con bên trong cũng bị xóa; các đề nằm trong đó được chuyển ra ngoài, không bị mất.`
                  : `Xóa ${selected} đề đã chọn? Kết quả các lớp đã làm vẫn được giữ.`;
              if (confirm(msg)) runBulk(() => deleteItemsAction(items));
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-danger-600 hover:bg-danger-50"
          >
            <Trash2 className="size-4" /> Xóa
          </button>
          <button type="button" onClick={clearSelection} className="ml-auto inline-flex items-center gap-1 text-ink-soft hover:text-ink">
            <X className="size-4" /> Bỏ chọn
          </button>
          {error && <p className="w-full text-danger-600">{error}</p>}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg bg-surface shadow-sm">
        <div className="min-w-[1020px]">
          <div className={cn(COLS, "h-16 border-b border-line px-2 text-[15px] text-ink-soft")}>
            <span className="flex justify-center">
              {canEdit && (
                <Check
                  label="Chọn tất cả"
                  checked={allChecked}
                  onChange={() => {
                    if (allChecked) clearSelection();
                    else {
                      setSelExams(new Set(exams.map((e) => e.id)));
                      setSelFolders(new Set(folders.map((f) => f.id)));
                    }
                  }}
                />
              )}
            </span>
            {header("name", "Tên")}
            {header("submitted", "Số bài đã nộp")}
            {header("status", "Trạng thái")}
            <span>Đã giao cho</span>
            {header("assignedAt", "Thời gian giao đề")}
            <span>Thời gian tạo</span>
          </div>

          {bankHref && (
            <Link href={bankHref} className={cn(COLS, "group h-[53px] border-b border-line px-2 hover:bg-muted")}>
              <span />
              <span className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-md bg-ink/80 text-surface">
                  <Landmark className="size-4" />
                </span>
                <span className="text-[15px] text-ink group-hover:text-brand-700">Ngân hàng câu hỏi chung</span>
                <span className="rounded-full bg-bank-500 px-2.5 py-0.5 text-xs font-semibold text-white">EduQuiz</span>
              </span>
            </Link>
          )}

          {folders.map((f) => (
            <div
              key={f.id}
              role="link"
              tabIndex={0}
              onClick={() => router.push(`/de-thi?thu-muc=${f.id}`)}
              onKeyDown={(e) => e.key === "Enter" && router.push(`/de-thi?thu-muc=${f.id}`)}
              className={cn(COLS, "group h-[53px] cursor-pointer border-b border-line px-2 hover:bg-muted", selFolders.has(f.id) && "bg-brand-50/60 dark:bg-brand-900/20")}
            >
              <span className="flex justify-center">
                {canEdit && <Check label={`Chọn ${f.name}`} checked={selFolders.has(f.id)} onChange={() => toggle(selFolders, setSelFolders, f.id)} />}
              </span>
              <span className="flex min-w-0 items-center gap-3">
                <Folder className="size-7 shrink-0 fill-ink/75 text-ink/75" strokeWidth={1.5} />
                <span className="truncate text-[15px] text-ink group-hover:text-brand-700">{f.name}</span>
                <span className="shrink-0 text-xs text-ink-faint">{f.itemCount} mục</span>
                {canEdit && (
                  <button
                    type="button"
                    title="Đổi tên"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenaming(f);
                    }}
                    className="shrink-0 rounded p-1 text-ink-faint opacity-0 hover:bg-line hover:text-ink group-hover:opacity-100"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
              </span>
              <span />
              <span />
              <span />
              <span />
              <span className="text-sm text-ink-soft">{formatDateTime(f.createdAt)}</span>
            </div>
          ))}

          {exams.map((e) => (
            <div
              key={e.id}
              role="link"
              tabIndex={0}
              onClick={() => router.push(`/de-thi/${e.id}`)}
              onKeyDown={(ev) => ev.key === "Enter" && router.push(`/de-thi/${e.id}`)}
              className={cn(COLS, "group min-h-[53px] cursor-pointer border-b border-line px-2 py-2 last:border-b-0 hover:bg-muted", selExams.has(e.id) && "bg-brand-50/60 dark:bg-brand-900/20")}
            >
              <span className="flex justify-center">
                {canEdit && <Check label={`Chọn ${e.title}`} checked={selExams.has(e.id)} onChange={() => toggle(selExams, setSelExams, e.id)} />}
              </span>
              <span className="flex min-w-0 items-center gap-3">
                <FileText className="size-6 shrink-0 text-orange-500" strokeWidth={1.75} />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] text-ink group-hover:text-brand-700">{e.title}</span>
                  <span className="block text-xs text-ink-faint">
                    {e.questionCount} câu · {e.durationMinutes} phút
                  </span>
                </span>
              </span>
              <span className="text-[15px] text-ink">{e.submittedCount}</span>
              <span>
                <Badge variant={STATUS_VARIANT[e.status]}>{EXAM_STATUS_LABEL[e.status]}</Badge>
              </span>
              <span className="flex flex-wrap gap-1">
                {e.classNames.slice(0, 2).map((n) => (
                  <Badge key={n} variant="brand">
                    {n}
                  </Badge>
                ))}
                {e.classNames.length > 2 && <Badge>+{e.classNames.length - 2}</Badge>}
                {e.classNames.length === 0 && <span className="text-sm text-ink-faint">—</span>}
              </span>
              <span className="text-sm text-ink-soft">{formatDateTime(e.assignedAt)}</span>
              <span className="text-sm text-ink-soft">{formatDateTime(e.createdAt)}</span>
            </div>
          ))}

          {total === 0 && !bankHref && (
            <p className="px-6 py-12 text-center text-sm text-ink-soft">Không có đề hoặc thư mục nào.</p>
          )}
          {total === 0 && bankHref && (
            <p className="px-6 py-10 text-center text-sm text-ink-soft">
              Chưa có đề nào. Bấm “Tạo đề thi” để soạn đề, hoặc “Tạo thư mục” để sắp xếp đề theo lớp.
            </p>
          )}
        </div>
      </div>

      <PromptDialog
        open={renaming !== null}
        title="Đổi tên thư mục"
        label="Tên thư mục"
        defaultValue={renaming?.name ?? ""}
        onClose={() => setRenaming(null)}
        onSubmit={async (name) => {
          if (!renaming) return null;
          const res = await renameFolderAction({ id: renaming.id, name });
          if (!res.ok) return res.message;
          router.refresh();
          return null;
        }}
      />
    </div>
  );
}
