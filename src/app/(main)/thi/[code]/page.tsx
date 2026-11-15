import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { can, hasPermission } from "@/common/permissions/permissions";
import { buttonClass, Card } from "@/components/ui";
import { findPublishedByCode, resolveAssignmentForStudent } from "@/modules/publish/publish.service";

export const metadata: Metadata = { title: "Làm bài" };

/**
 * Link chung của đề đã xuất bản: /thi/<mã>. Học sinh → chuyển tới bài giao mình được làm
 * (lớp đang học, hoặc "link chung"); người soạn đề → về trang quản lý đề.
 */
export default async function ExamLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(`/thi/${code}`)}`);

  const config = await findPublishedByCode(code);
  if (!config) notFound();

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
