"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, LoaderCircle, Search, X } from "lucide-react";
import { Alert, Button, RichInline } from "@/components/ui";
import { gradeLabel } from "@/common/enums";
import { cn } from "@/lib/utils";
import { stripTags } from "@/lib/inline-format";
import { LETTERS, type ParsedQuestion } from "@/modules/exams/exam-text";
import { findReplacementsAction } from "@/modules/exams/exam-replace.actions";
import type { ReplaceCandidate } from "@/modules/exams/exam-replace.types";

type Props = {
  /** Câu đang muốn đổi (null = đóng hộp thoại). */
  question: ParsedQuestion | null;
  /** Nhóm của câu — lấy thêm từ khóa khi câu không có nội dung riêng. */
  groupContent: string | null;
  grade: number | null;
  subject: string | null;
  examId: string | null;
  onClose: () => void;
  onPick: (c: ReplaceCandidate) => void;
};

/** "Đổi câu khác": gợi ý câu tương tự (đề của mình + ngân hàng chung), bấm "Chọn" để thay. */
export function ReplaceQuestionDialog({ question, groupContent, grade, subject, examId, onClose, onPick }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<ReplaceCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const search = (text: string) => {
    if (!question) return;
    setError(null);
    startTransition(async () => {
      const res = await findReplacementsAction({
        text,
        exclude: question.content,
        grade,
        subject,
        excludeExamId: examId,
      });
      if (res.ok) setItems(res.data);
      else setError(res.message);
    });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (question && !el.open) {
      const base = [question.content, ...question.options.map((o) => o.content), question.content ? "" : (groupContent ?? "")]
        .map(stripTags)
        .join(" ");
       
      setKeyword("");
      setItems(null);
       
      search(base);
      el.showModal();
    } else if (!question && el.open) el.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi đổi câu
  }, [question]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl rounded-lg border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="font-medium">Đổi câu khác</h2>
        <button type="button" onClick={onClose} aria-label="Đóng" className="rounded p-1 text-ink-soft hover:bg-muted">
          <X className="size-5" />
        </button>
      </div>

      <form
        className="flex gap-2 border-b border-line px-5 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          search(keyword);
        }}
      >
        <label className="relative flex-1">
          <span className="sr-only">Tìm câu hỏi</span>
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-ink-faint" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm theo từ khóa khác…"
            className="h-9 w-full rounded-md border border-line bg-surface pr-3 pl-8 text-sm text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none"
          />
        </label>
        <Button type="submit" size="sm" variant="secondary" className="h-9" disabled={pending || !keyword.trim()}>
          Tìm
        </Button>
      </form>

      <div className="max-h-[62vh] space-y-4 overflow-y-auto px-5 py-4">
        {error && <Alert variant="danger">{error}</Alert>}
        {pending || items === null ? (
          <p className="flex items-center justify-center gap-2 py-16 text-sm text-ink-soft">
            <LoaderCircle className="size-4 animate-spin" /> Đang tìm câu tương tự…
          </p>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-soft">
            Không tìm thấy câu tương tự trong các đề của bạn và ngân hàng chung. Thử từ khóa khác.
          </p>
        ) : (
          items.map((c, idx) => (
            <article key={c.id} className="rounded-md border border-line px-6 py-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded border border-line px-2 py-1 font-medium text-brand-700 dark:text-brand-300">{idx + 1}.</span>
                <span className="text-ink-faint">Trắc nghiệm</span>
                <Button size="sm" className="h-9 px-5" onClick={() => onPick(c)}>
                  Chọn
                </Button>
                <span className="ml-auto text-xs text-ink-soft">
                  {[c.grade !== null ? gradeLabel(c.grade) : null, c.subject].filter(Boolean).join(" — ") || c.source}
                </span>
              </div>
              <p className="mt-1 text-right text-xs text-ink-faint">{c.source}</p>
              {c.content && (
                <div className="mt-2 rounded border border-line px-2 py-1.5 text-sm">
                  <RichInline text={c.content} />
                </div>
              )}
              <ul className="mt-2 space-y-1.5">
                {c.options.map((o, oi) => (
                  <li key={oi} className="relative flex items-stretch gap-1 text-sm">
                    <span className="absolute top-2 -left-5 text-brand-600 dark:text-brand-300">
                      {oi === c.correctIndex && <Check className="size-4" strokeWidth={3} />}
                    </span>
                    <span
                      className={cn(
                        "flex w-7 shrink-0 items-center justify-center rounded border font-medium",
                        oi === c.correctIndex ? "border-brand-600 text-brand-600" : "border-line",
                      )}
                    >
                      {LETTERS[oi]}
                    </span>
                    <span
                      className={cn(
                        "min-h-8 rounded border px-1.5 py-1 leading-6",
                        oi === c.correctIndex ? "border-brand-600 text-brand-600" : "border-line",
                      )}
                    >
                      <RichInline text={o} />
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))
        )}
      </div>
    </dialog>
  );
}
