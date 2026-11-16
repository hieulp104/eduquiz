import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { can, hasPermission } from "@/common/permissions/permissions";
import { ASSIGNMENT_STATUS_LABEL, assignmentStatus } from "@/common/enums";
import { Alert, buttonClass, Card } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { PriceNotice } from "@/modules/publish/components/price-notice";
import { findOpenAssignmentByCode, findPublishedByCode, resolveAssignmentForStudent } from "@/modules/publish/publish.service";
import { takeSettings } from "@/modules/publish/publish.types";
import { ExamStartCard } from "@/modules/submissions/components/exam-start-card";
import { StartButton } from "@/modules/submissions/components/start-button";
import { countExamSubmissions } from "@/modules/submissions/submissions.service";

export const metadata: Metadata = { title: "Làm bài" };

/**
 * Link chung của đề đã xuất bản: /thi/<mã> — mở được cả khi CHƯA đăng nhập.
 * - Học sinh đã đăng nhập → chuyển tới bài giao mình được làm (lớp đang học, hoặc "link chung").
 * - Người soạn đề → về trang quản lý đề.
 * - Khách: đề giao cho "Tất cả mọi người" thì hiện trang bắt đầu thi, nhập họ tên là làm được
 *   (tạo tài khoản ẩn danh); đề giao theo lớp / học sinh thì phải đăng nhập.
 */
export default async function ExamLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const config = await findPublishedByCode(code);
  if (!config) notFound();

  const user = await getCurrentUser();
  const loginHref = `/login?callbackUrl=${encodeURIComponent(`/thi/${code}`)}`;

  if (!user) {
    const assignment = await findOpenAssignmentByCode(code);
    if (!assignment) redirect(loginHref);

    const { exam } = assignment;
    const settings = takeSettings(assignment, exam.onlineConfig);
    const status = assignmentStatus(assignment);
    return (
      <div className="space-y-4">
        <ExamStartCard
          title={exam.title}
          code={code.toLowerCase()}
          durationMinutes={exam.durationMinutes}
          openAt={assignment.openAt}
          dueAt={assignment.dueAt}
          questionCount={exam._count.questions}
          practice={settings.mode === "PRACTICE"}
          totalAttempts={await countExamSubmissions(exam.id)}
          used={0}
          maxAttempts={settings.maxAttempts}
        >
          <PriceNotice mode={exam.priceMode} price={exam.price} note={exam.priceNote} />
          {settings.preNotice && (
            <Alert>
              <p className="font-medium">Thông báo từ giáo viên</p>
              <p className="mt-1 whitespace-pre-wrap">{settings.preNotice}</p>
            </Alert>
          )}
          {status === "OPEN" ? (
            <StartButton guestCode={code} needPassword={Boolean(settings.password)} askInfo />
          ) : (
            <Alert variant="danger">
              {ASSIGNMENT_STATUS_LABEL[status]}
              {status === "UPCOMING" && ` — mở lúc ${formatDateTime(assignment.openAt)}`}
            </Alert>
          )}
        </ExamStartCard>
        <p className="text-center text-sm text-ink-soft">
          Đã có tài khoản?{" "}
          <Link href={loginHref} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
            Đăng nhập để làm bài
          </Link>
        </p>
      </div>
    );
  }

  if (hasPermission(user, "submission.take")) {
    const assignmentId = await resolveAssignmentForStudent(config, user.id);
    if (assignmentId) redirect(`/lam-bai/${assignmentId}`);
  } else if (can(user, "exam.view", { ownerId: config.exam.teacherId })) {
    redirect(`/de-thi/${config.examId}`);
  }

  return (
    <Card className="mx-auto max-w-xl space-y-3 text-center">
      <h1 className="text-lg font-semibold text-ink">Bạn không thuộc đối tượng được làm đề này</h1>
      <p className="text-sm text-ink-soft">
        Đề chỉ giao cho một số lớp / học sinh, hoặc tài khoản của bạn không phải tài khoản học sinh. Hãy liên hệ giáo viên
        để được thêm vào lớp.
      </p>
      <Link href="/dashboard" className={buttonClass("secondary")}>
        Về trang chính
      </Link>
    </Card>
  );
}
