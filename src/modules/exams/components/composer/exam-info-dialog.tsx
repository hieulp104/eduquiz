"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { formatScore } from "@/lib/utils";
import type { ParsedExam } from "@/modules/exams/exam-text";

type Props = {
  open: boolean;
  parsed: ParsedExam;
  totalPoints: number;
  /** Lỗi chặn không cho đi tiếp (thiếu đáp án, điểm sai…). */
  problems: string[];
  continueLabel: string;
  onClose: () => void;
  onContinue: () => void;
  /** Bấm "Câu n" → đóng hộp thoại và tới câu đó. */
  onGoto?: (index: number) => void;
};

/** Hộp "Thông tin đề": tổng số câu theo loại, câu nào thuộc nhóm nào — xác nhận trước khi sang bước cấu hình. */
export function ExamInfoDialog({ open, parsed, totalPoints, problems, continueLabel, onClose, onContinue, onGoto }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const { questions, warnings } = parsed;

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
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-4xl rounded-lg border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-line px-6 py-3.5">
        <h2 className="font-medium">Thông tin đề</h2>
        <button type="button" onClick={onClose} aria-label="Đóng" className="rounded p-1 text-ink-soft hover:bg-muted">
          <X className="size-5" />
        </button>
      </div>

      <div className="max-h-[calc(90vh-8.5rem)] space-y-3 overflow-y-auto px-6 pt-4 pb-2">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]">
          <b className="font-semibold">Tổng số câu trong đề thi: {questions.length} câu</b>
          {questions.length > 0 && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-ink-soft">
              <b className="font-semibold text-brand-600 dark:text-brand-300">{questions.length}</b> câu Trắc nghiệm 1 đáp án
            </span>
          )}
          <span className="text-sm text-ink-soft">Tổng điểm: {formatScore(totalPoints)}</span>
        </p>
        <p className="text-sm text-ink-soft">*Số trong () để đánh dấu câu hỏi đó thuộc nhóm hoặc phần của đề thi</p>

        {problems.length > 0 && (
          <Alert variant="danger">
            <p className="font-medium">Cần sửa trước khi tiếp tục:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {problems.slice(0, 8).map((p) => (
                <li key={p}>{p}</li>
              ))}
              {problems.length > 8 && <li>… và {problems.length - 8} lỗi khác</li>}
            </ul>
          </Alert>
        )}
        {warnings.length > 0 && (
          <Alert>
            <p className="font-medium">Lưu ý khi đọc đề:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {warnings.slice(0, 6).map((w) => (
                <li key={w}>{w}</li>
              ))}
              {warnings.length > 6 && <li>… và {warnings.length - 6} lưu ý khác</li>}
            </ul>
          </Alert>
        )}

        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="w-[38%] px-5 py-3.5 font-medium">Thông tin</th>
                <th className="w-28 border-l border-line px-5 py-3.5 font-medium">Số lượng</th>
                <th className="border-l border-line px-5 py-3.5 font-medium">Danh sách các câu</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-5 py-3 align-middle">Tổng số câu trắc nghiệm 1 đáp án</td>
                <td className="border-l border-line px-5 py-3 text-center align-middle">{questions.length}</td>
                <td className="border-l border-line px-5 py-2.5">
                  <div className="flex flex-wrap gap-x-3 gap-y-3">
                    {questions.map((q, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onGoto?.(i)}
                        title="Tới câu này"
                        className="rounded-md border border-line bg-muted px-3 py-2 text-sm whitespace-nowrap text-ink-soft hover:border-brand-500 hover:text-brand-600"
                      >
                        Câu {i + 1}
                        {q.groupIndex !== null && <span className="ml-2">({q.groupIndex + 1})</span>}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-3.5">
        <p className="text-sm text-brand-700 dark:text-brand-300">Bạn có muốn tiếp tục tạo đề thi với thông tin như trên?</p>
        <Button onClick={onContinue} disabled={problems.length > 0}>
          {continueLabel}
        </Button>
      </div>
    </dialog>
  );
}
