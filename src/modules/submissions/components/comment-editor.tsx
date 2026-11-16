"use client";

import { useState, useTransition } from "react";
import { PencilLine } from "lucide-react";
import { Button } from "@/components/ui";
import { saveSubmissionCommentAction } from "@/modules/submissions/submissions.actions";

/** Dòng "Nhận xét" trên thẻ bài làm (danh sách đã thi): bấm bút để giáo viên ghi / sửa nhận xét. */
export function CommentEditor({ submissionId, comment }: { submissionId: string; comment: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveSubmissionCommentAction({ submissionId, comment: value });
      if (!res.ok) setError(res.message);
      else setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-ink-soft">
          Nhận xét: {comment && <span className="break-words text-ink">{comment}</span>}
        </p>
        <button
          type="button"
          onClick={() => {
            setValue(comment ?? "");
            setEditing(true);
          }}
          aria-label="Sửa nhận xét"
          title="Sửa nhận xét"
          className="shrink-0 rounded p-0.5 text-brand-700 hover:bg-muted dark:text-brand-300"
        >
          <PencilLine className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="sr-only">Nhận xét</span>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={500}
          rows={2}
          autoFocus
          placeholder="Nhận xét cho bài làm này…"
          className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none"
        />
      </label>
      {error && <p className="text-xs text-danger-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={pending}>
          Hủy
        </Button>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Đang lưu..." : "Lưu"}
        </Button>
      </div>
    </div>
  );
}
