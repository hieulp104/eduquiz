import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FolderOpen, ListChecks, PartyPopper } from "lucide-react";
import { requirePagePermission } from "@/common/guards/page.guard";
import { getExamOverview } from "@/modules/exams/exams.service";
import { CopyLinkBox, EmbedCodeBox } from "@/modules/publish/components/copy-box";
import { AUDIENCE_LABEL } from "@/modules/publish/publish.types";

export const metadata: Metadata = { title: "Xuất bản thành công" };

/** Sau khi xuất bản: link làm bài + mã nhúng website. */
export default async function PublishedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("exam.view");
  const data = await getExamOverview(user, id);
  if (!data) notFound();
  const { exam } = data;
  const config = exam.onlineConfig;
  if (!config?.publishedAt) redirect(`/de-thi/${exam.id}/lam-bai-online`);

  const path = `/thi/${config.code}`;
  const classNames = exam.assignments.flatMap((a) => (a.classroom ? [a.classroom.name] : []));
  const audience =
    config.audience === "CLASSES"
      ? `Giao cho lớp: ${classNames.join(", ") || "—"}`
      : config.audience === "STUDENTS"
        ? `Giao cho ${config.studentIds.length} học sinh được chọn`
        : AUDIENCE_LABEL.ALL;

  return (
    <div className="space-y-4">

      <div className="mx-auto w-full max-w-[600px] space-y-5">
        <section className="rounded-xl border border-line bg-surface p-5 text-center shadow-sm">
          <h1 className="flex items-center justify-center gap-2 text-lg font-medium text-ink">
            Xuất bản thành công <PartyPopper className="size-5 text-warning-700 dark:text-amber-300" />
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Copy link bên dưới và gửi cho học sinh. Học sinh đăng nhập rồi mở link để làm bài và nộp bài.
          </p>
          <div className="mt-5 text-left">
            <p className="mb-3 text-sm font-medium break-words text-ink">{exam.title}</p>
            <CopyLinkBox path={path} />
            <p className="mt-3 text-xs text-ink-soft">
              {config.mode === "PRACTICE" ? "Luyện tập" : "Kiểm tra"} · {audience} · Mã đề: {config.code}
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <p className="text-center text-sm text-ink">
            Thầy/Cô đã có website?
            <br />
            Dùng nội dung bên dưới để nhúng đề vào website
          </p>
          <div className="mt-4">
            <EmbedCodeBox path={path} title={exam.title} />
          </div>
          <p className="mt-2 text-xs text-ink-faint">Học sinh vẫn cần đăng nhập để làm bài trong khung nhúng.</p>
        </section>

        <nav className="flex flex-wrap justify-center gap-x-10 gap-y-3 rounded-xl border border-line bg-surface px-5 py-4 text-sm font-medium shadow-sm">
          <Link href={`/de-thi/${exam.id}`} className="flex items-center gap-1.5 text-brand-700 hover:underline dark:text-brand-300">
            <ListChecks className="size-4" /> Quản lý danh sách đã thi
          </Link>
          <Link
            href={exam.folderId ? `/de-thi?thu-muc=${exam.folderId}` : "/de-thi"}
            className="flex items-center gap-1.5 text-brand-700 hover:underline dark:text-brand-300"
          >
            <FolderOpen className="size-4" /> Về trang quản lý file
          </Link>
        </nav>
      </div>
    </div>
  );
}
