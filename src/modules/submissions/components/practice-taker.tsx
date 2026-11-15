"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Clock, Flag, X } from "lucide-react";
import { Alert, Button, Card, RichInline } from "@/components/ui";
import { AudioClip, QuestionGroupHeader } from "@/modules/exams/components/question-group-header";
import { cn } from "@/lib/utils";
import { answerPracticeAction, submitAnswersAction } from "@/modules/submissions/submissions.actions";

export type PracticeQuestion = {
  id: string;
  content: string;
  audioFileId: string | null;
  group: { id: string; content: string; audioFileId: string | null } | null;
  options: { id: string; content: string }[];
};

/** Câu đã trả lời: phương án đã chọn + đáp án đúng (server chỉ trả sau khi trả lời). */
export type PracticeAnswer = { optionId: string | null; isCorrect: boolean; correctOptionId: string | null };

type Props = {
  submissionId: string;
  title: string;
  /** ISO — hạn làm bài do server tính. */
  deadline: string;
  questions: PracticeQuestion[];
  /** Các câu đã trả lời ở lần mở trước (tải lại trang không mất). */
  initial: Record<string, PracticeAnswer>;
  hideGroupTitles?: boolean;
};

const LETTERS = "ABCDEFGH";

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Chế độ Luyện tập: hiện từng câu, chọn xong biết đúng/sai và đáp án đúng ngay. */
export function PracticeTaker({ submissionId, title, deadline, questions, initial, hideGroupTitles }: Props) {
  const router = useRouter();
  const [done, setDone] = useState(initial);
  const [index, setIndex] = useState(() => {
    const first = questions.findIndex((q) => !initial[q.id]);
    return first === -1 ? questions.length - 1 : first;
  });
  const [remaining, setRemaining] = useState(() => new Date(deadline).getTime() - Date.now());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const finished = useRef(false);

  const q = questions[index];
  const answer = done[q.id];
  const answeredCount = questions.filter((x) => done[x.id]).length;
  const correctCount = questions.filter((x) => done[x.id]?.isCorrect).length;
  const isLast = index === questions.length - 1;

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    startTransition(async () => {
      // Câu đã trả lời được server ghi từng câu — chỉ cần chốt lượt làm.
      const res = await submitAnswersAction({ submissionId, answers: {} });
      if (!res.ok) {
        finished.current = false;
        setError(res.message);
        return;
      }
      router.replace(`/ket-qua/${res.data.submissionId}`);
    });
  }, [router, submissionId]);

  useEffect(() => {
    const timer = setInterval(() => {
      const left = new Date(deadline).getTime() - Date.now();
      setRemaining(left);
      if (left <= 0) {
        clearInterval(timer);
        finish();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline, finish]);

  function choose(optionId: string) {
    if (answer || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await answerPracticeAction({ submissionId, questionId: q.id, optionId });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setDone((d) => ({ ...d, [q.id]: { optionId, ...res.data } }));
    });
  }

  const showGroup = q.group && (!hideGroupTitles || q.group.audioFileId);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-ink">{title}</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            Luyện tập · Câu {index + 1}/{questions.length} · Đúng {correctCount}/{answeredCount}
          </p>
        </div>
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-lg font-bold tabular-nums",
            remaining < 60_000 ? "bg-danger-50 text-danger-600" : "bg-muted text-brand-700 dark:text-brand-300",
          )}
        >
          <Clock className="size-4" /> {formatRemaining(remaining)}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full bg-brand-600 transition-all" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
        </div>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}

      {showGroup && <QuestionGroupHeader content={hideGroupTitles ? "" : q.group!.content} audioId={q.group!.audioFileId} />}

      <Card className="space-y-3">
        <p className="font-semibold text-ink">Câu {index + 1}</p>
        {q.audioFileId && <AudioClip id={q.audioFileId} />}
        {q.content && <RichInline text={q.content} className="block text-ink" />}
        <div className="space-y-2">
          {q.options.map((o, oi) => {
            const chosen = answer?.optionId === o.id;
            const correct = answer?.correctOptionId === o.id;
            return (
              <button
                key={o.id}
                type="button"
                disabled={Boolean(answer) || pending}
                onClick={() => choose(o.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  correct
                    ? "border-success-200 bg-success-50 text-success-700"
                    : chosen
                      ? "border-danger-200 bg-danger-50 text-danger-700"
                      : "border-line text-ink enabled:hover:bg-muted",
                )}
              >
                <span className="font-semibold">{LETTERS[oi]}.</span>
                <RichInline text={o.content} className="flex-1" />
                {correct && <Check className="mt-0.5 size-4 shrink-0" />}
                {chosen && !correct && <X className="mt-0.5 size-4 shrink-0" />}
              </button>
            );
          })}
        </div>
        {answer && (
          <p className={cn("text-sm font-medium", answer.isCorrect ? "text-success-700" : "text-danger-600")} role="status">
            {answer.isCorrect ? "Chính xác!" : "Chưa đúng — đáp án đúng được tô xanh."}
          </p>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            const left = questions.length - answeredCount;
            if (confirm(left > 0 ? `Còn ${left} câu chưa trả lời. Kết thúc luyện tập?` : "Kết thúc luyện tập?")) finish();
          }}
        >
          <Flag className="size-4" /> Kết thúc
        </Button>
        {isLast ? (
          <Button disabled={!answer || pending} onClick={finish}>
            {pending ? "Đang lưu..." : "Hoàn thành"}
          </Button>
        ) : (
          <Button disabled={!answer} onClick={() => setIndex((i) => i + 1)}>
            Câu tiếp theo <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
