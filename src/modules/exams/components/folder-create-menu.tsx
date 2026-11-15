"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FolderPlus, ListTree, LoaderCircle, Sheet, X } from "lucide-react";
import { Alert, Button, PromptDialog } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  createFolderAction,
  createFoldersFromBookAction,
  importFoldersFromExcelAction,
} from "@/modules/exams/exam-library.actions";

type Book = { id: string; title: string; topicCount: number; lessonCount: number };
type Props = { folderId: string | null; books: Book[] };
type Mode = "single" | "excel" | "book" | null;

/** Khung hộp thoại chung (dùng <dialog> gốc: Esc, khóa nền, giữ focus). */
function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Đóng" className="rounded p-1 text-ink-soft hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>
      {open && children}
    </dialog>
  );
}

/** Nút "Tạo thư mục" có menu: Tạo thư mục · Tạo thư mục bằng excel · Tạo thư mục theo sách. */
export function FolderCreateMenu({ folderId, books }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Excel
  const [file, setFile] = useState<File | null>(null);
  // Theo sách
  const [bookId, setBookId] = useState(books[0]?.id ?? "");
  const [depth, setDepth] = useState<"topic" | "lesson">("topic");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; warnings: string[] } | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function openMode(m: Mode) {
    setMenuOpen(false);
    setError(null);
    setResult(null);
    setFile(null);
    setMode(m);
  }

  async function submitExcel() {
    if (!file) return;
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    if (folderId) fd.append("parentId", folderId);
    const res = await importFoldersFromExcelAction(fd);
    setPending(false);
    if (!res.ok) return setError(res.message);
    setResult({
      text: `Đã tạo ${res.data.created} thư mục mới từ ${res.data.total} dòng${res.data.created < res.data.total ? " (thư mục trùng tên đã có thì dùng lại)" : ""}.`,
      warnings: res.data.warnings,
    });
    router.refresh();
  }

  async function submitBook() {
    setPending(true);
    setError(null);
    const res = await createFoldersFromBookAction({ bookId, depth, parentId: folderId });
    setPending(false);
    if (!res.ok) return setError(res.message);
    setMode(null);
    router.refresh();
  }

  const book = books.find((b) => b.id === bookId);
  const items = [
    { mode: "single" as const, icon: FolderPlus, label: "Tạo thư mục" },
    { mode: "excel" as const, icon: Sheet, label: "Tạo thư mục bằng excel" },
    { mode: "book" as const, icon: ListTree, label: "Tạo thư mục theo sách" },
  ];

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        className="inline-flex h-[38px] items-center gap-2 rounded-md bg-brand-800 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-900"
      >
        <FolderPlus className="size-4" /> Tạo thư mục
        <ChevronDown className={cn("size-3.5 transition-transform", menuOpen && "rotate-180")} />
      </button>

      {menuOpen && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-64 rounded-lg border border-line bg-surface py-1.5 shadow-lg">
          {items.map((it) => (
            <button
              key={it.mode}
              type="button"
              role="menuitem"
              onClick={() => openMode(it.mode)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] text-ink hover:bg-muted"
            >
              <it.icon className="size-4 text-ink-soft" /> {it.label}
            </button>
          ))}
        </div>
      )}

      <PromptDialog
        open={mode === "single"}
        title="Tạo thư mục"
        label="Tên thư mục"
        placeholder="VD: Lớp 6A1 24-25"
        submitLabel="Tạo thư mục"
        onClose={() => setMode(null)}
        onSubmit={async (name) => {
          const res = await createFolderAction({ name, parentId: folderId });
          if (!res.ok) return res.message;
          router.refresh();
          return null;
        }}
      />

      <Modal open={mode === "excel"} title="Tạo thư mục bằng excel" onClose={() => setMode(null)}>
        <div className="space-y-3 px-5 py-4 text-sm">
          <p className="text-ink-soft">
            Mỗi dòng (từ dòng 2, cột A) là 1 thư mục. Thư mục con ghi dạng đường dẫn:{" "}
            <code className="rounded bg-muted px-1">Lớp 6A1/Chương 1</code>. Thư mục trùng tên đã có sẽ được dùng lại.
          </p>
          <a href="/api/exams/template?loai=thu-muc" className="inline-block font-medium text-brand-700 hover:underline dark:text-brand-300">
            Tải file mẫu
          </a>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line px-4 py-3 hover:bg-muted">
            <Sheet className="size-5 text-lime-600" />
            <span className="min-w-0 flex-1 truncate">{file ? file.name : "Chọn file .xlsx"}</span>
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setResult(null);
                setError(null);
              }}
            />
          </label>
          {error && <Alert variant="danger">{error}</Alert>}
          {result && (
            <Alert variant="success">
              {result.text}
              {result.warnings.length > 0 && (
                <ul className="mt-1 list-disc pl-5">
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
            </Alert>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="secondary" onClick={() => setMode(null)}>
            {result ? "Đóng" : "Hủy"}
          </Button>
          {!result && (
            <Button onClick={submitExcel} disabled={!file || pending}>
              {pending && <LoaderCircle className="size-4 animate-spin" />} Tạo thư mục
            </Button>
          )}
        </div>
      </Modal>

      <Modal open={mode === "book"} title="Tạo thư mục theo sách" onClose={() => setMode(null)}>
        <div className="space-y-4 px-5 py-4 text-sm">
          {books.length === 0 ? (
            <Alert>Ngân hàng câu hỏi chưa có sách nào.</Alert>
          ) : (
            <>
              <label className="block space-y-1.5 font-medium">
                Sách
                <select
                  value={bookId}
                  onChange={(e) => setBookId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-line bg-surface px-3 font-normal"
                >
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="space-y-2">
                <legend className="mb-1.5 font-medium">Tạo đến cấp</legend>
                {[
                  { v: "topic" as const, label: `Chủ đề (${book?.topicCount ?? 0} thư mục)` },
                  { v: "lesson" as const, label: `Chủ đề → Bài (${(book?.topicCount ?? 0) + (book?.lessonCount ?? 0)} thư mục)` },
                ].map((o) => (
                  <label key={o.v} className="flex cursor-pointer items-center gap-2">
                    <input type="radio" name="depth" checked={depth === o.v} onChange={() => setDepth(o.v)} className="size-4 accent-brand-700" />
                    {o.label}
                  </label>
                ))}
              </fieldset>
              <p className="text-ink-soft">
                Tạo 1 thư mục “{book?.title}” chứa các thư mục con theo mục lục sách. Chạy lại không tạo trùng.
              </p>
            </>
          )}
          {error && <Alert variant="danger">{error}</Alert>}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="secondary" onClick={() => setMode(null)}>
            Hủy
          </Button>
          <Button onClick={submitBook} disabled={!bookId || pending}>
            {pending && <LoaderCircle className="size-4 animate-spin" />} Tạo thư mục
          </Button>
        </div>
      </Modal>
    </div>
  );
}
