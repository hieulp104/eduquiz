"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE = { sm: "max-w-xl", md: "max-w-2xl", lg: "max-w-4xl", full: "max-w-[calc(100vw-2rem)] h-[calc(100dvh-2rem)]" };

/**
 * Hộp thoại dùng <dialog> gốc (Esc, khóa nền, giữ focus). Phần thân tự cuộn, tiêu đề + chân luôn hiện.
 * Mở/đóng theo `open`; Esc / nút X / bấm nền gọi `onClose`.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "sm",
  closeButton = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof SIZE;
  closeButton?: boolean;
}) {
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
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      className={cn(
        "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col rounded-lg border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40 open:flex",
        SIZE[size],
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="font-medium">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-ink-soft">{description}</p>}
        </div>
        {closeButton && (
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded p-1 text-ink-soft hover:bg-muted">
            <X className="size-5" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer && <div className="flex shrink-0 justify-end gap-3 border-t border-line px-5 py-3">{footer}</div>}
    </dialog>
  );
}
