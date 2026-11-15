"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { Alert } from "./alert";
import { Button } from "../actions/button";
import { Input } from "../forms/input";

type Props = {
  open: boolean;
  title: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  submitLabel?: string;
  maxLength?: number;
  onClose: () => void;
  /** Trả về thông báo lỗi để hiện trong hộp thoại, hoặc null nếu thành công (hộp thoại tự đóng). */
  onSubmit: (value: string) => Promise<string | null>;
};

/** Hộp thoại nhập 1 dòng chữ (tạo / đổi tên thư mục…) — dùng <dialog> gốc: Esc, khóa nền, focus. */
export function PromptDialog({
  open,
  title,
  label,
  defaultValue = "",
  placeholder,
  submitLabel = "Lưu",
  maxLength = 100,
  onClose,
  onSubmit,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setValue(defaultValue);
      setError(null);
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open, defaultValue]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const err = await onSubmit(value);
    setPending(false);
    if (err) setError(err);
    else onClose();
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40"
    >
      <form onSubmit={submit}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded p-1 text-ink-soft hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-2 px-5 py-4">
          <label className="block text-sm font-medium" htmlFor="prompt-input">
            {label}
          </label>
          <Input
            id="prompt-input"
            autoFocus
            value={value}
            maxLength={maxLength}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
          />
          {error && <Alert variant="danger">{error}</Alert>}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" disabled={pending || !value.trim()}>
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
