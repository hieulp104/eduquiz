import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePagePermission } from "@/common/guards/page.guard";
import { ASSIGNMENT_STATUS_LABEL, assignmentStatus } from "@/common/enums";
import { Alert, Card } from "@/components/ui";
import { formatDateTime, formatScore, toScale10 } from "@/lib/utils";
import { getVisibleAssignment } from "@/modules/assignments/assignments.service";
import { PriceNotice } from "@/modules/publish/components/price-notice";
import { attemptsLeft, canSeeScore, takeSettings } from "@/modules/publish/publish.types";
import {
  canTakeAssignment,
  finalizeIfExpired,
  findLatestSubmission,
  getPracticeProgress,
  getQuestionsForTaking,
  listSubmittedAttempts,
  submissionDeadline,
} from "@/modules/submissions/submissions.service";
import { ExamTaker } from "@/modules/submissions/components/exam-taker";
import { PracticeTaker } from "@/modules/submissions/components/practice-taker";
import { StartButton } from "@/modules/submissions/components/start-button";
import { orderForTaking } from "@/modules/submissions/exam-order";

export const metadata: Metadata = { title: "Làm bài" };

export default async function TakeExamPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const user = await requirePagePermission("submission.take");
  const assignment = await getVisibleAssignment(user, assignmentId);
  if (!assignment) notFound();
  if (!(await canTakeAssignment(user.id, assignment))) redirect("/khong-co-quyen");

  const { exam } = assignment;
  const settings = takeSettings(assignment, exam.onlineConfig);
  const latest = await findLatestSubmission(assignment.id, user.id);

  // Đang làm dở
  if (latest && !latest.submittedAt) {
    const deadline = submissionDeadline(latest.startedAt, exam.durationMinutes, assignment.dueAt);
    if (await finalizeIfExpired(latest.id, deadline)) redirect(`/ket-qua/${latest.id}`);
    // Đảo câu / đáp án (nếu bật) — cố định theo lượt làm nên tải lại trang không đổi.
    const questions = orderForTaking(await getQuestionsForTaking(exam.id), latest.id, assignment);
    if (settings.mode === "PRACTICE") {
      return (
        <PracticeTaker
          submissionId={latest.id}
          title={exam.title}
          deadline={deadline.toISOString()}
          questions={questions}
          initial={await getPracticeProgress(latest.id)}
          hideGroupTitles={settings.hideGroupTitles}
        />
      );
    }
    return (
      <ExamTaker
        submissionId={latest.id}
        title={exam.title}
        deadline={deadline.toISOString()}
        questions={questions}
        headerNote={settings.headerNote}
        hideGroupTitles={settings.hideGroupTitles}
        monitorLeave={settings.monitorLeave}
        labMode={settings.labMode}
      />
    );
  }

  // Chưa bắt đầu / đã nộp các lượt trước
  const attempts = await listSubmittedAttempts(assignment.id, user.id);
  const left = attemptsLeft(settings.maxAttempts, attempts.length);
  if (latest && left === 0) redirect(`/ket-qua/${latest.id}`);

  const status = assignmentStatus(assignment);
  const practice = settings.mode === "PRACTICE";
  const scoreVisible = (a: (typeof attempts)[number]) =>
    canSeeScore(settings, { dueAt: assignment.dueAt, score10: toScale10(a.score ?? 0, a.maxScore) });

  return (
    <Card className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-ink">{exam.title}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {[assignment.classroom?.name, practice ? "Luyện tập" : "Kiểm tra"].filter(Boolean).join(" · ")}
        </p>
      </div>
      {exam.description && <p className="text-sm whitespace-pre-wrap text-ink">{exam.description}</p>}
      <ul className="space-y-1 text-sm text-ink">
        <li>Số câu: {exam._count.questions}</li>
        <li>Thời gian: {exam.durationMinutes} phút</li>
        <li>Hạn nộp: {assignment.dueAt ? formatDateTime(assignment.dueAt) : "Không giới hạn"}</li>
        <li>
          Số lượt làm:{" "}
          {settings.maxAttempts === 0 ? "không giới hạn" : `${attempts.length}/${settings.maxAttempts} lượt đã dùng`}
        </li>
      </ul>

      <PriceNotice mode={exam.priceMode} price={exam.price} note={exam.priceNote} />

      {settings.preNotice && (
        <Alert>
          <p className="font-medium">Thông báo từ giáo viên</p>
          <p className="mt-1 whitespace-pre-wrap">{settings.preNotice}</p>
        </Alert>
      )}

      {attempts.length > 0 && (
        <div className="rounded-lg border border-line px-4 py-3 text-sm">
          <p className="font-medium text-ink">Các lượt đã làm</p>
          <ul className="mt-2 space-y-1">
            {attempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 text-ink-soft">
                <span>
                  Lượt {a.attempt} · {formatDateTime(a.submittedAt)}
                </span>
                <Link href={`/ket-qua/${a.id}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                  {scoreVisible(a) ? `${formatScore(toScale10(a.score ?? 0, a.maxScore))} điểm` : "Xem bài"}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {status === "OPEN" ? (
        <>
          <Alert>
            {practice
              ? "Luyện tập: câu hỏi hiện từng câu một, trả lời xong sẽ biết ngay đáp án đúng."
              : "Đồng hồ bắt đầu chạy khi bấm nút. Hết giờ bài sẽ tự nộp."}
            {settings.monitorLeave && " Bài thi có giám sát: không rời khỏi trang trong lúc làm bài."}
            {settings.labMode && " Nộp bài xong hệ thống sẽ tự đăng xuất."}
          </Alert>
          <StartButton
            assignmentId={assignment.id}
            needPassword={Boolean(settings.password)}
            label={attempts.length > 0 ? "Làm lại" : practice ? "Bắt đầu luyện tập" : "Bắt đầu làm bài"}
          />
        </>
      ) : (
        <Alert variant="danger">
          {ASSIGNMENT_STATUS_LABEL[status]}
          {status === "UPCOMING" && ` — mở lúc ${formatDateTime(assignment.openAt)}`}
        </Alert>
      )}
    </Card>
  );
}
