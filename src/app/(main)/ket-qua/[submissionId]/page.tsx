import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarCheck, Check, ChevronRight, CircleCheck, Clock, IdCard, Repeat, UserRound, X } from "lucide-react";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { assignmentStatus } from "@/common/enums";
import { Alert, buttonClass, Card, RichInline } from "@/components/ui";
import { QuestionGroupHeader, startsGroup } from "@/modules/exams/components/question-group-header";
import { cn, formatDateTime, formatScore, toScale10 } from "@/lib/utils";
import { formatDuration } from "@/modules/exams/exam-stats";
import { PriceNotice } from "@/modules/publish/components/price-notice";
import {
  OPEN_AUDIENCE_NAME,
  attemptsLeft,
  canSeeAnswers,
  canSeeScore,
  revealHint,
  takeSettings,
} from "@/modules/publish/publish.types";
import { RetryWrong } from "@/modules/submissions/components/retry-wrong";
import { getSubmissionResult, listSubmittedAttempts } from "@/modules/submissions/submissions.service";
import { classSharedWith } from "@/modules/teachers/class-sharing.service";

export const metadata: Metadata = { title: "Kết quả" };

const LETTERS = "ABCDEFGH";

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ submissionId: string }>;
  searchParams: Promise<{ "dap-an"?: string }>;
}) {
  const [{ submissionId }, sp] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const result = await getSubmissionResult(submissionId);
  if (!result || !result.submission.submittedAt) notFound();
  const { submission, questions } = result;
  const { assignment } = submission;
  const { classroom, exam } = assignment;

  // Bài gắn lớp: giáo viên của lớp (hoặc được phân quyền lớp). Bài "link chung": người soạn đề.
  const isTeacherView = can(user, "assignment.result.view", {
    ownerId: classroom?.teacherId ?? exam.teacherId,
    sharedWith: classroom ? (await classSharedWith([classroom.id])).get(classroom.id) : undefined,
  });
  const isOwnSubmission = can(user, "submission.take", { ownerId: submission.studentId });
  if (!isTeacherView && !isOwnSubmission) redirect("/khong-co-quyen");

  const settings = takeSettings(assignment, exam.onlineConfig);
  const score10 = toScale10(submission.score ?? 0, submission.maxScore);
  const reveal = { dueAt: assignment.dueAt, score10 };
  const showScore = isTeacherView || canSeeScore(settings, reveal);
  const showDetail = isTeacherView || canSeeAnswers(settings, reveal);
  // Học sinh: trang kết quả chỉ có thẻ tổng kết, bấm "Xem đáp án" mới mở chi tiết.
  const detailOpen = isTeacherView || sp["dap-an"] === "1";
  const takerNote = [submission.takerClass && `Lớp ${submission.takerClass}`, submission.takerNumber && `STT ${submission.takerNumber}`]
    .filter(Boolean)
    .join(" · ");
  const duration = formatDuration((submission.submittedAt!.getTime() - submission.startedAt.getTime()) / 1000);
  // Câu làm sai không lộ đáp án đúng (chỉ áp dụng cho học sinh).
  const hideCorrectOfWrong = !isTeacherView && settings.hideWrongAnswers;

  const answerByQuestion = new Map(submission.answers.map((a) => [a.questionId, a]));
  const correctCount = submission.answers.filter((a) => a.isCorrect).length;
  // Học sinh làm qua link chung không cần thấy nhãn "Link chung".
  const className = classroom?.name ?? (isTeacherView ? OPEN_AUDIENCE_NAME : null);

  // Học sinh còn lượt + đề còn mở → cho làm lại.
  const canRetake =
    isOwnSubmission &&
    !isTeacherView &&
    assignmentStatus({ openAt: new Date(0), dueAt: assignment.dueAt }) === "OPEN" &&
    attemptsLeft(settings.maxAttempts, (await listSubmittedAttempts(assignment.id, submission.studentId)).length) > 0;

  const wrong =
    settings.mode === "PRACTICE" && settings.retryWrong && isOwnSubmission && !isTeacherView
      ? questions.flatMap((q, qi) => {
          const correct = q.options.find((o) => o.isCorrect);
          if (answerByQuestion.get(q.id)?.isCorrect || !correct) return [];
          return [
            {
              id: q.id,
              number: qi + 1,
              group: settings.hideGroupTitles ? null : (q.group?.content ?? null),
              content: q.content,
              options: q.options.map((o) => ({ id: o.id, content: o.content })),
              correctOptionId: correct.id,
            },
          ];
        })
      : [];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {isTeacherView ? (
        <Card className="text-center">
          <p className="text-sm text-ink-soft">
            {exam.title}
            {className && " · "}
            {isTeacherView && classroom ? (
              <Link href={`/lop-hoc/${classroom.id}/bai/${assignment.id}`} className="text-brand-700 hover:underline">
                {className}
              </Link>
            ) : (
              className
            )}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {submission.student.fullName}
            {(settings.maxAttempts !== 1 || submission.attempt > 1) && ` · Lượt ${submission.attempt}`}
          </p>
          {showScore ? (
            <>
              <p className="mt-4 text-5xl font-bold text-brand-700 tabular-nums dark:text-brand-300">{formatScore(score10)}</p>
              <p className="mt-1 text-sm text-ink-soft">
                Đúng {correctCount}/{questions.length} câu · {formatScore(submission.score)}/{formatScore(submission.maxScore)} điểm
                · Nộp lúc {formatDateTime(submission.submittedAt)}
              </p>
            </>
          ) : (
            <>
              <p className="mt-4 text-lg font-semibold text-ink">Đã nộp bài</p>
              <p className="mt-1 text-sm text-ink-soft">
                Nộp lúc {formatDateTime(submission.submittedAt)} · {revealHint(settings.showScore, "điểm", null)}
              </p>
            </>
          )}
          {takerNote && <p className="mt-1 text-sm text-ink-soft">{takerNote}</p>}
          {submission.comment && <p className="mt-2 text-sm text-ink">Nhận xét: {submission.comment}</p>}
          {isTeacherView && submission.leaveCount > 0 && (
            <p className="mt-2 text-sm font-medium text-danger-600">Rời khỏi trang làm bài {submission.leaveCount} lần</p>
          )}
          {canRetake && (
            <Link href={`/lam-bai/${assignment.id}`} className={cn(buttonClass("secondary", "sm"), "mt-4")}>
              Làm lại
            </Link>
          )}
        </Card>
      ) : (
        <section className="mx-auto w-full max-w-[576px] rounded-lg bg-surface shadow-sm">
          <div className="border-b border-line px-4 py-5 text-center">
            <h1 className="text-lg font-semibold text-ink">Bài làm của bạn đã được gửi đi</h1>
            {showScore ? (
              <p className="mt-2 text-sm text-ink">
                Điểm của bạn: <b className="ml-1 text-2xl font-semibold tabular-nums">{formatScore(score10)}/10</b>
              </p>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">{revealHint(settings.showScore, "điểm", null)}</p>
            )}
          </div>
          <div className="px-4 py-4">
            <p className="text-center text-sm font-medium break-words text-ink">
              {exam.title}
              {className && ` · ${className}`}
            </p>
            <dl className="mt-3 space-y-3 text-sm">
              {[
                { icon: UserRound, label: "Thí sinh", value: submission.student.fullName },
                takerNote ? { icon: IdCard, label: "Lớp / STT", value: takerNote } : null,
                settings.maxAttempts !== 1 || submission.attempt > 1
                  ? { icon: Repeat, label: "Lượt làm", value: `Lượt ${submission.attempt}` }
                  : null,
                { icon: Clock, label: "Thời gian làm bài", value: duration },
                { icon: CalendarCheck, label: "Thời gian nộp bài", value: formatDateTime(submission.submittedAt) },
                showScore
                  ? { icon: CircleCheck, label: "Số câu trắc nghiệm đúng", value: `${correctCount}/${questions.length}` }
                  : null,
              ]
                .filter((r) => r !== null)
                .map((r) => (
                  <div key={r.label} className="flex items-start justify-between gap-4">
                    <dt className="flex items-center gap-2 text-ink-soft">
                      <r.icon className="size-4 shrink-0" /> {r.label}
                    </dt>
                    <dd className="text-right font-medium text-ink">{r.value}</dd>
                  </div>
                ))}
            </dl>
            {submission.comment && (
              <p className="mt-4 rounded-md bg-muted px-3 py-2 text-sm text-ink">
                <span className="font-medium">Nhận xét của giáo viên:</span> {submission.comment}
              </p>
            )}
            <div className="mt-5 space-y-2">
              {showDetail ? (
                !detailOpen && (
                  <Link href={`/ket-qua/${submission.id}?dap-an=1#dap-an`} className={cn(buttonClass("secondary"), "w-full border-brand-600 text-brand-700 dark:text-brand-300")}>
                    Xem đáp án <ChevronRight className="size-4" />
                  </Link>
                )
              ) : (
                <p className="text-center text-sm text-ink-soft">{revealHint(settings.showAnswers, "đề và đáp án", settings.minScoreForAnswers)}</p>
              )}
              {canRetake && (
                <Link href={`/lam-bai/${assignment.id}`} className={cn(buttonClass("primary"), "w-full")}>
                  Làm lại
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {!isTeacherView && exam.priceMode === "PAID_EXPLANATION" && (
        <PriceNotice mode={exam.priceMode} price={exam.price} note={exam.priceNote} />
      )}

      <RetryWrong questions={wrong} />

      <span id="dap-an" className="block scroll-mt-4" />
      {!showDetail ? (
        isTeacherView && <Alert>{revealHint(settings.showAnswers, "đề và đáp án", settings.minScoreForAnswers)}</Alert>
      ) : !detailOpen ? null : (
        questions.map((q, qi) => {
          const answer = answerByQuestion.get(q.id);
          const hideCorrect = hideCorrectOfWrong && !answer?.isCorrect;
          return (
            <div key={q.id} className="space-y-4">
              {startsGroup(questions, qi) && <QuestionGroupHeader content={q.group!.content} audioId={q.group!.audioFileId} />}
              <Card>
                <p className="flex items-center gap-2 font-semibold text-ink">
                  Câu {qi + 1}
                  {answer?.isCorrect ? (
                    <Check className="size-4 text-success-600" />
                  ) : (
                    <X className="size-4 text-danger-600" />
                  )}
                  {!answer?.optionId && <span className="text-sm font-normal text-ink-soft">(bỏ trống)</span>}
                </p>
                {q.content && <RichInline text={q.content} className="mt-1 block text-ink" />}
                <ul className="mt-3 space-y-1.5">
                  {q.options.map((o, oi) => {
                    const chosen = answer?.optionId === o.id;
                    return (
                      <li
                        key={o.id}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm",
                          o.isCorrect && !hideCorrect
                            ? "border-success-200 bg-success-50 text-success-700"
                            : chosen
                              ? "border-danger-200 bg-danger-50 text-danger-700"
                              : "border-transparent text-ink",
                        )}
                      >
                        <span className="font-semibold">{LETTERS[oi]}.</span> <RichInline text={o.content} />
                        {chosen && <span className="ml-auto text-xs font-medium">Đã chọn</span>}
                      </li>
                    );
                  })}
                </ul>
                {hideCorrect && <p className="mt-2 text-xs text-ink-faint">Giáo viên ẩn đáp án đúng của câu làm sai.</p>}
              </Card>
            </div>
          );
        })
      )}
    </div>
  );
}
