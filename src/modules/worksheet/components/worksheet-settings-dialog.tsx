"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import type { WorksheetSettings } from "@/modules/worksheet/worksheet.types";

type Props = {
  open: boolean;
  value: WorksheetSettings;
  onClose: () => void;
  onSave: (v: WorksheetSettings) => void;
};

/** Hộp thoại Cài đặt phiếu — dùng <dialog> gốc (có sẵn Esc, khóa nền, focus). */
export function WorksheetSettingsDialog({ open, value, onClose, onSave }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setDraft(value); // nạp giá trị hiện tại mỗi lần mở
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open, value]);

  const toggle = (key: "includeAnswerKey" | "includeStudentInfo") => setDraft((d) => ({ ...d, [key]: !d[key] }));

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="font-semibold">Cài đặt phiếu bài tập</h2>
        <button type="button" onClick={onClose} aria-label="Đóng" className="rounded p-1 text-ink-soft hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-4 px-5 py-4 text-sm">
        <p className="text-xs font-semibold uppercase text-ink-soft">Khi xuất docx</p>
        <label className="flex cursor-pointer items-center justify-between gap-3">
          Dòng “Họ và tên / Lớp” đầu phiếu
          <input type="checkbox" checked={draft.includeStudentInfo} onChange={() => toggle("includeStudentInfo")} className="size-4 accent-brand-700" />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-3">
          Kèm trang đáp án ở cuối
          <input type="checkbox" checked={draft.includeAnswerKey} onChange={() => toggle("includeAnswerKey")} className="size-4 accent-brand-700" />
        </label>

        <p className="pt-2 text-xs font-semibold uppercase text-ink-soft">Khi tạo đề thi online</p>
        <label className="flex items-center justify-between gap-3">
          Thời gian làm bài (phút)
          <Input
            type="number"
            min={1}
            max={300}
            value={draft.examMinutes}
            onChange={(e) => setDraft((d) => ({ ...d, examMinutes: Math.min(300, Math.max(1, Number(e.target.value) || 1)) }))}
            className="h-9 w-24"
          />
        </label>
      </div>

      <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
        <Button variant="secondary" onClick={onClose}>
          Hủy
        </Button>
        <Button onClick={() => onSave(draft)}>Lưu cài đặt</Button>
      </div>
    </dialog>
  );
}
