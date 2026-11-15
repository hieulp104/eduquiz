import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, X } from "lucide-react";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { assignmentStatus } from "@/common/enums";
import { Alert, buttonClass, Card, RichInline } from "@/components/ui";
import { QuestionGroupHeader, startsGroup } from "@/modules/exams/components/question-group-header";
import { cn, formatDateTime, formatScore, toScale10 } from "@/lib/utils";
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

export default async function ResultPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
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
        {isTeacherView && submission.leaveCount > 0 && (
          <p className="mt-2 text-sm font-medium text-danger-600">Rời khỏi trang làm bài {submission.leaveCount} lần</p>
        )}
        {canRetake && (
          <Link href={`/lam-bai/${assignment.id}`} className={cn(buttonClass("secondary", "sm"), "mt-4")}>
            Làm lại
          </Link>
        )}
      </Card>

      {!isTeacherView && exam.priceMode === "PAID_EXPLANATION" && (
        <PriceNotice mode={exam.priceMode} price={exam.price} note={exam.priceNote} />
      )}

      <RetryWrong questions={wrong} />

      {!showDetail ? (
        <Alert>{revealHint(settings.showAnswers, "đề và đáp án", settings.minScoreForAnswers)}</Alert>
      ) : (
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
