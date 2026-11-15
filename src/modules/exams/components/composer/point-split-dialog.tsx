"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { cn, formatScore } from "@/lib/utils";
import { distributePoints, round2 } from "@/modules/exams/exam-points";
import type { ParsedExam } from "@/modules/exams/exam-text";

type Props = {
  open: boolean;
  parsed: ParsedExam;
  /** Điểm hiện tại từng câu — để điền sẵn tổng mỗi phần. */
  points: number[];
  onClose: () => void;
  /** Điểm mới cho từng câu (theo thứ tự câu). */
  onApply: (points: number[]) => void;
};

type Row = { key: string; label: string; hint: string; indexes: number[] };

/** "Chia điểm nhanh": nhập tổng điểm theo loại câu hỏi hoặc theo từng phần/nhóm, chia đều cho các câu trong đó. */
export function PointSplitDialog({ open, parsed, points, onClose, onApply }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"type" | "group">("type");
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const all = parsed.questions.map((_, i) => i);
  const typeRows: Row[] = [{ key: "mcq", label: "Tổng điểm câu trắc nghiệm 1 đáp án", hint: `${all.length} Câu`, indexes: all }];
  const groupRows: Row[] = parsed.groups.map((_, gi) => {
    const indexes = all.filter((i) => parsed.questions[i].groupIndex === gi);
    return { key: `g${gi}`, label: `Phần ${gi + 1}`, hint: `${indexes.length} Câu`, indexes };
  });
  const loose = all.filter((i) => parsed.questions[i].groupIndex === null);
  if (loose.length) groupRows.push({ key: "loose", label: "Câu không thuộc nhóm", hint: `${loose.length} Câu`, indexes: loose });
  const rows = tab === "type" ? typeRows : groupRows;

  const sumOf = (r: Row) => round2(r.indexes.reduce((s, i) => s + (points[i] ?? 0), 0));
  const valueOf = (r: Row) => values[r.key] ?? String(sumOf(r));
  const total = round2(rows.reduce((s, r) => s + (Number(valueOf(r).replace(",", ".")) || 0), 0));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
       
      setValues({});
      setError(null);
       
      el.showModal();
    } else if (!open && el.open) el.close();
  }, [open]);

  function apply() {
    const next = [...points];
    for (const r of rows) {
      if (!r.indexes.length) continue;
      const v = Number(valueOf(r).replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) return setError(`${r.label}: điểm phải lớn hơn 0.`);
      const d = distributePoints(r.indexes.length, [], v);
      if (d.error) return setError(`${r.label}: ${d.error}`);
      r.indexes.forEach((qi, k) => (next[qi] = d.points[k]));
    }
    onApply(next);
    onClose();
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl rounded-lg border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40"
    >
      <h2 className="border-b border-line px-5 py-4 font-medium">Chia điểm nhanh</h2>
      <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
        <div className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm" role="tablist">
          {(
            [
              ["type", "Theo loại câu hỏi"],
              ["group", "Theo phần/nhóm"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => {
                setTab(k);
                setError(null);
              }}
              className={cn("rounded-md py-2.5", tab === k ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-soft")}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3.5 text-sm font-medium">
          Tổng điểm <span className="text-base text-brand-600 dark:text-brand-300">{formatScore(total)}</span>
        </div>

        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-soft">Đề chưa có nhóm câu nào.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-4 rounded-lg border border-line px-4 py-3 text-sm">
                <label htmlFor={`split-${r.key}`}>
                  <span className="block font-medium text-ink">{r.label}</span>
                  <span className="text-xs text-ink-soft">{r.hint}</span>
                </label>
                <input
                  id={`split-${r.key}`}
                  inputMode="decimal"
                  value={valueOf(r)}
                  onChange={(e) => setValues((v) => ({ ...v, [r.key]: e.target.value }))}
                  className="h-10 w-32 rounded-md border border-line bg-surface px-3 text-center text-ink focus:border-brand-500 focus:outline-none"
                />
              </li>
            ))}
          </ul>
        )}
        {error && <Alert variant="danger">{error}</Alert>}
      </div>
      <div className="flex justify-end gap-3 border-t border-line px-5 py-3">
        <Button variant="secondary" onClick={onClose} className="w-24">
          Đóng
        </Button>
        <Button onClick={apply} className="w-24" disabled={rows.length === 0}>
          Chia
        </Button>
      </div>
    </dialog>
  );
}
