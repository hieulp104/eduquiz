"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Eye, SquarePen, Timer } from "lucide-react";
import { Alert, Button, RichInline } from "@/components/ui";
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
  /** Tên hiện ở thanh trên ("Thí sinh: …"). */
  studentName: string;
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

const pad = (n: number) => String(n).padStart(2, "0");

/** 2377 giây → "00 : 39 : 37". */
function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60].map(pad).join(" : ");
}

/** Chia số câu thành từng khối liền nhau (cùng nhóm, hoặc các câu đứng riêng) cho bảng "Danh sách câu hỏi". */
function questionBlocks(questions: Question[]): number[][] {
  const blocks: number[][] = [];
  questions.forEach((q, i) => {
    const prev = questions[i - 1];
    if (i > 0 && (prev.group?.id ?? null) === (q.group?.id ?? null)) blocks[blocks.length - 1].push(i);
    else blocks.push([i]);
  });
  return blocks;
}

/**
 * Trang làm bài toàn màn hình: thanh trên (thí sinh · đồng hồ · nộp bài), câu hỏi bên trái,
 * bảng "Danh sách câu hỏi" bên phải.
 */
export function ExamTaker({
  submissionId,
  title,
  studentName,
  deadline,
  questions,
  headerNote,
  hideGroupTitles,
  monitorLeave,
  labMode,
}: Props) {
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
  const blocks = questionBlocks(questions);

  function confirmSubmit() {
    const missing = questions.length - answeredCount;
    if (confirm(missing > 0 ? `Còn ${missing} câu chưa làm. Vẫn nộp bài?` : "Nộp bài?")) submit();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      {/* ── Thanh trên ── */}
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 shadow-sm">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (confirm("Rời trang làm bài? Đồng hồ vẫn chạy — bạn có thể quay lại làm tiếp khi còn giờ.")) router.push("/dashboard");
          }}
        >
          <ChevronLeft className="size-4" /> Quay lại
        </Button>
        <p className="mx-auto min-w-0 truncate text-sm text-ink-soft">
          Thí sinh: <b className="text-lg font-semibold text-ink">{studentName}</b>
        </p>
        <p
          className={cn("flex shrink-0 items-center gap-2 text-sm font-semibold tabular-nums", lowTime ? "text-danger-600" : "text-ink")}
          aria-label="Thời gian còn lại"
        >
          <Timer className="size-5" /> {formatRemaining(remaining)}
        </p>
        <Button size="sm" className="shrink-0" disabled={pending} onClick={confirmSubmit}>
          <SquarePen className="size-4" />
          {pending ? "Đang nộp..." : "Nộp bài"}
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid items-start gap-5 p-3 lg:grid-cols-[minmax(0,1fr)_440px]">
          {/* ── Câu hỏi ── */}
          <div className="space-y-5">
            <div className="px-1">
              <h1 className="text-base font-semibold break-words text-ink">{title}</h1>
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
              <div key={q.id} className="space-y-5">
                {startsGroup(questions, qi) && (!hideGroupTitles || q.group!.audioFileId) && (
                  <QuestionGroupHeader content={hideGroupTitles ? "" : q.group!.content} audioId={q.group!.audioFileId} />
                )}
                <section id={`cau-${qi + 1}`} className="scroll-mt-3 rounded-lg bg-surface pt-4 pb-3 shadow-sm">
                  <div className="space-y-2 px-4">
                    <p className="text-sm font-semibold text-ink">
                      Câu {qi + 1} <span className="font-normal text-ink-soft">({formatScore(q.points)} điểm)</span>
                    </p>
                    {q.audioFileId && <AudioClip id={q.audioFileId} />}
                    {q.content && <RichInline text={q.content} className="block text-sm leading-relaxed text-ink" />}
                  </div>
                  <p className="my-3 flex items-center gap-4 text-sm text-ink">
                    <span className="h-px flex-1 bg-line" />
                    Chọn một đáp án đúng
                    <span className="h-px flex-1 bg-line" />
                  </p>
                  <div className="space-y-2 px-3">
                    {q.options.map((o, oi) => {
                      const selected = answers[q.id] === o.id;
                      return (
                        <label key={o.id} className="group flex w-fit max-w-full cursor-pointer items-center gap-3 text-sm">
                          <input
                            type="radio"
                            name={q.id}
                            checked={selected}
                            onChange={() => choose(q.id, o.id)}
                            className="peer sr-only"
                          />
                          <span
                            className={cn(
                              "flex size-10 shrink-0 items-center justify-center rounded-full border font-medium transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500",
                              selected ? "border-brand-600 bg-brand-600 text-white" : "border-line text-ink group-hover:border-brand-500",
                            )}
                          >
                            {LETTERS[oi]}
                          </span>
                          <span
                            className={cn(
                              "min-h-10 rounded-md border px-2.5 py-2 leading-6 transition-colors",
                              selected
                                ? "border-brand-600 font-medium text-brand-700 dark:text-brand-300"
                                : "border-line text-ink group-hover:border-brand-500",
                            )}
                          >
                            <RichInline text={o.content} />
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              </div>
            ))}
          </div>

          {/* ── Danh sách câu hỏi ── */}
          <aside className="rounded-lg bg-surface p-3 shadow-sm lg:sticky lg:top-3 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">Danh sách câu hỏi</h2>
              <p className="text-xs text-ink-soft">
                Đã làm {answeredCount}/{questions.length}
              </p>
            </div>
            {blocks.map((block, bi) => (
              <div key={bi} className="mt-3">
                <p className="text-sm font-medium text-ink">Nhóm {bi + 1}</p>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {block.map((qi) => (
                    <a
                      key={qi}
                      href={`#cau-${qi + 1}`}
                      className={cn(
                        "flex h-9 items-center justify-center rounded-md border text-sm tabular-nums",
                        answers[questions[qi].id]
                          ? "border-brand-600 bg-brand-600 font-medium text-white"
                          : "border-line text-ink-soft hover:border-brand-500",
                      )}
                    >
                      {pad(qi + 1)}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </aside>
        </div>
      </div>
    </div>
  );
}
