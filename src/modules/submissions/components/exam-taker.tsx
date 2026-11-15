"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Eye, Send } from "lucide-react";
import { Alert, Button, Card, RichInline } from "@/components/ui";
import { AudioClip, QuestionGroupHeader, startsGroup } from "@/modules/exams/components/question-group-header";
import { cn, formatScore } from "@/lib/utils";
import { logoutAction } from "@/modules/auth/auth.actions";
import { reportLeaveAction, submitAnswersAction } from "@/modules/submissions/submissions.actions";

type Question = {
  id: string;
  content: string;
  points: number;
  audioFileId: string | null;
  group: { id: string; content: string; audioFileId: string | null } | null;
  options: { id: string; content: string }[];
};

type Props = {
  submissionId: string;
  title: string;
  /** ISO — hạn làm bài thực tế do server tính. */
  deadline: string;
  questions: Question[];
  /** Dòng giáo viên thêm dưới tiêu đề đề. */
  headerNote?: string;
  hideGroupTitles?: boolean;
  /** Đếm và báo giáo viên số lần rời khỏi trang làm bài. */
  monitorLeave?: boolean;
  /** Thi tại phòng máy: nộp xong tự đăng xuất. */
  labMode?: boolean;
};

const LETTERS = "ABCDEFGH";

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ExamTaker({ submissionId, title, deadline, questions, headerNote, hideGroupTitles, monitorLeave, labMode }: Props) {
  const router = useRouter();
  const storageKey = `eduquiz:answers:${submissionId}`;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(() => new Date(deadline).getTime() - Date.now());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submitted = useRef(false);
  const [leaves, setLeaves] = useState(0);

  // Giám sát: mỗi lần tab bị ẩn (chuyển tab / thu nhỏ / mở app khác) tính 1 lần rời trang.
  useEffect(() => {
    if (!monitorLeave) return;
    const onHide = () => {
      if (document.visibilityState !== "hidden" || submitted.current) return;
      setLeaves((n) => n + 1);
      void reportLeaveAction(submissionId);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [monitorLeave, submissionId]);

  // Khôi phục đáp án đã chọn nếu học sinh lỡ tải lại trang.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- chỉ đọc 1 lần khi mở trang
      if (saved) setAnswers(JSON.parse(saved));
    } catch {
      /* trình duyệt chặn localStorage — bỏ qua */
    }
  }, [storageKey]);

  const choose = (questionId: string, optionId: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: optionId };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* bỏ qua */
      }
      return next;
    });
  };

  const submit = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    setError(null);
    startTransition(async () => {
      const res = await submitAnswersAction({ submissionId, answers });
      if (!res.ok) {
        submitted.current = false;
        setError(res.message);
        return;
      }
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* bỏ qua */
      }
      if (labMode) await logoutAction();
      else router.replace(`/ket-qua/${res.data.submissionId}`);
    });
  }, [answers, labMode, router, storageKey, submissionId]);

  // Đồng hồ đếm ngược — hết giờ thì tự nộp.
  useEffect(() => {
    const timer = setInterval(() => {
      const left = new Date(deadline).getTime() - Date.now();
      setRemaining(left);
      if (left <= 0) {
        clearInterval(timer);
        submit();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline, submit]);

  const answeredCount = questions.filter((q) => answers[q.id]).length;
  const lowTime = remaining < 60 * 1000;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-ink">{title}</h1>
          {headerNote && <p className="mt-1 text-sm whitespace-pre-wrap text-ink-soft">{headerNote}</p>}
        </div>
        {error && <Alert variant="danger">{error}</Alert>}
        {monitorLeave && (
          <Alert variant={leaves > 0 ? "danger" : "info"} className="flex items-center gap-2">
            <Eye className="size-4 shrink-0" />
            {leaves > 0
              ? `Bạn đã rời khỏi trang làm bài ${leaves} lần — giáo viên sẽ thấy số lần này.`
              : "Bài thi đang được giám sát: không chuyển tab hoặc rời khỏi trang trong lúc làm bài."}
          </Alert>
        )}

        {questions.map((q, qi) => (
          <div key={q.id} className="space-y-4">
            {startsGroup(questions, qi) && (!hideGroupTitles || q.group!.audioFileId) && (
              <QuestionGroupHeader content={hideGroupTitles ? "" : q.group!.content} audioId={q.group!.audioFileId} />
            )}
            <Card id={`cau-${qi + 1}`} className="scroll-mt-24 space-y-3">
              <p className="font-semibold text-ink">
                Câu {qi + 1}{" "}
                <span className="text-sm font-normal text-ink-soft">({formatScore(q.points)} điểm)</span>
              </p>
              {q.audioFileId && <AudioClip id={q.audioFileId} />}
              {q.content && <RichInline text={q.content} className="block text-ink" />}
              <div className="space-y-2">
                {q.options.map((o, oi) => {
                  const selected = answers[q.id] === o.id;
                  return (
                    <label
                      key={o.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                        selected ? "border-brand-500 bg-brand-50" : "border-line hover:bg-muted",
                      )}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={selected}
                        onChange={() => choose(q.id, o.id)}
                        className="mt-0.5 size-4 accent-brand-600"
                      />
                      <span className="font-semibold text-ink-soft">{LETTERS[oi]}.</span>
                      <RichInline text={o.content} className="text-ink" />
                    </label>
                  );
                })}
              </div>
            </Card>
          </div>
        ))}
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Card className="space-y-4">
          <div
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg py-3 text-2xl font-bold tabular-nums",
              lowTime ? "bg-danger-50 text-danger-600" : "bg-brand-50 text-brand-700",
            )}
          >
            <Clock className="size-5" />
            {formatRemaining(remaining)}
          </div>
          <p className="text-center text-sm text-ink-soft">
            Đã làm {answeredCount}/{questions.length} câu
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {questions.map((q, qi) => (
              <a
                key={q.id}
                href={`#cau-${qi + 1}`}
                className={cn(
                  "flex h-8 items-center justify-center rounded-md text-xs font-medium",
                  answers[q.id] ? "bg-brand-600 text-white" : "bg-muted text-ink-soft",
                )}
              >
                {qi + 1}
              </a>
            ))}
          </div>
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => {
              const missing = questions.length - answeredCount;
              const msg = missing > 0 ? `Còn ${missing} câu chưa làm. Vẫn nộp bài?` : "Nộp bài?";
              if (confirm(msg)) submit();
            }}
          >
            <Send className="size-4" />
            {pending ? "Đang nộp..." : "Nộp bài"}
          </Button>
        </Card>
      </aside>
    </div>
  );
}
