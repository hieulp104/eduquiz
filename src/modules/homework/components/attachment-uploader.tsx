"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { FileText, LoaderCircle, Plus, X } from "lucide-react";
import {
  FILE_INPUT_ACCEPT,
  formatFileSize,
  isAllowedMime,
  MAX_FILE_SIZE,
  MAX_FILES_PER_HOMEWORK,
  type UploadedFile,
} from "@/modules/files/files.constants";

type Uploading = { key: string; name: string };

type Props = {
  files: UploadedFile[];
  /** setState của form — cập nhật dạng hàm để nhiều file tải xong cùng lúc không ghi đè nhau. */
  setFiles: Dispatch<SetStateAction<UploadedFile[]>>;
  /** Báo cho form biết còn file đang tải — chặn bấm Lưu giữa chừng. */
  onBusyChange?: (busy: boolean) => void;
};

/** Nút "Thêm file bài tập" + danh sách file đã tải. Mỗi file tải riêng lên /api/files. */
export function AttachmentUploader({ files, setFiles, onBusyChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handlePick(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const picked = Array.from(list);
    const room = MAX_FILES_PER_HOMEWORK - files.length - uploading.length;
    if (picked.length > room) {
      setError(`Tối đa ${MAX_FILES_PER_HOMEWORK} file cho mỗi bài tập.`);
      picked.splice(Math.max(room, 0));
    }

    const queue = picked.filter((f) => {
      if (f.size > MAX_FILE_SIZE) return setError(`"${f.name}" vượt quá 20MB.`), false;
      if (!isAllowedMime(f.type)) return setError(`"${f.name}" không đúng định dạng cho phép.`), false;
      return true;
    });
    if (queue.length === 0) return;

    const pending = queue.map((f) => ({ key: crypto.randomUUID(), name: f.name, file: f }));
    setUploading((u) => [...u, ...pending]);
    onBusyChange?.(true);

    await Promise.all(
      pending.map(async (p) => {
        const body = new FormData();
        body.append("file", p.file);
        try {
          const res = await fetch("/api/files", { method: "POST", body });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json.message ?? "Tải file thất bại.");
          setFiles((prev) => [...prev, json as UploadedFile]);
        } catch (e) {
          setError(`"${p.name}": ${(e as Error).message}`);
        } finally {
          setUploading((u) => {
            const next = u.filter((x) => x.key !== p.key);
            if (next.length === 0) onBusyChange?.(false);
            return next;
          });
        }
      }),
    );
  }

  function remove(file: UploadedFile) {
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    // Xóa khỏi kho luôn — file chưa gắn vào bài tập nào nên không ai khác dùng.
    void fetch(`/api/files/${file.id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex h-[30px] items-center gap-2 rounded-md bg-brand-100 px-3 text-sm font-medium text-brand-800 hover:bg-brand-200 dark:bg-brand-900/40 dark:text-brand-200"
      >
        <Plus className="size-4" /> Thêm file bài tập
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={FILE_INPUT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          void handlePick(e.target.files);
          e.target.value = ""; // cho phép chọn lại đúng file vừa bỏ
        }}
      />
      <p className="text-xs text-ink-soft">Chụp ảnh bài tập hoặc chọn file ảnh, pdf, word, excel, audio và video</p>
      {error && <p className="text-xs text-danger-600">{error}</p>}

      {(files.length > 0 || uploading.length > 0) && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2">
              <FileText className="size-4 shrink-0 text-brand-700 dark:text-brand-300" />
              <a
                href={`/api/files/${f.id}`}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-sm text-ink hover:text-brand-700 hover:underline"
              >
                {f.name}
              </a>
              <span className="shrink-0 text-xs text-ink-faint">{formatFileSize(f.size)}</span>
              <button
                type="button"
                onClick={() => remove(f)}
                aria-label={`Bỏ file ${f.name}`}
                className="rounded p-0.5 text-ink-faint hover:bg-danger-50 hover:text-danger-600"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
          {uploading.map((u) => (
            <li key={u.key} className="flex items-center gap-2.5 rounded-lg border border-dashed border-line px-3 py-2">
              <LoaderCircle className="size-4 shrink-0 animate-spin text-brand-600" />
              <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{u.name}</span>
              <span className="text-xs text-ink-faint">Đang tải…</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
