import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ChartPie, FolderOpen, Info, ListChecks, PartyPopper, Presentation, Printer, Settings2 } from "lucide-react";
import { requirePagePermission } from "@/common/guards/page.guard";
import { soonHref } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { getExamWithAnswers } from "@/modules/exams/exams.service";

export const metadata: Metadata = { title: "Tạo đề thành công" };

type Action = { label: string; href: string; icon: LucideIcon; tone?: "lime" };
type Section = { title: string; description: string; actions: Action[]; hint: string };

/** Sau khi lưu đề mới: chọn cách dùng đề (làm online / in đề / trình chiếu). */
export default async function ExamCreatedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("exam.view");
  const exam = await getExamWithAnswers(user, id);
  if (!exam) notFound();

  const sections: Section[] = [
    {
      title: "Online",
      description:
        "Copy link gửi cho học sinh. Học sinh mở link để làm bài và nộp bài online, hệ thống tự chấm điểm trắc nghiệm.",
      actions: [
        { label: "Cài đặt làm bài online", href: `/de-thi/${exam.id}/lam-bai-online`, icon: Settings2 },
        { label: "Phân tích cấu trúc đề thi", href: `/de-thi/${exam.id}/phan-tich`, icon: ChartPie, tone: "lime" },
      ],
      hint: "Thiết lập thời gian làm bài, giám sát, đảo câu hỏi, cho phép xem điểm… rồi xuất bản đề để có link gửi học sinh.",
    },
    {
      title: "Offline",
      description: "In đề cho học sinh làm trên giấy kèm phiếu trả lời riêng.",
      actions: [{ label: "IN ĐỀ - Có phiếu trả lời riêng", href: `/de-thi/${exam.id}/in-de`, icon: Printer }],
      hint: "Xuất file đề đã đảo thứ tự câu hỏi và đáp án, kèm mẫu phiếu trả lời trắc nghiệm.",
    },
    {
      title: "Chèn vào PowerPoint",
      description: "Đưa câu hỏi lên slide trình chiếu để cả lớp cùng trả lời và xem thống kê ngay trên màn hình.",
      actions: [{ label: "Chèn vào Powerpoint", href: soonHref("Chèn đề vào PowerPoint"), icon: Presentation }],
      hint: "Chọn mẫu slide để nhúng câu hỏi vào bài giảng.",
    },
  ];

  return (
    <div className="space-y-4">

      <div className="mx-auto w-full max-w-[1000px] space-y-5">
        <header className="rounded-xl border border-line bg-surface px-5 py-4 shadow-sm">
          <h1 className="flex items-center gap-2 text-[15px] font-medium text-ink">
            Tạo đề thành công <PartyPopper className="size-5 text-warning-700 dark:text-amber-300" />
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {exam.title} · {exam.questions.length} câu — vui lòng chọn các hình thức bên dưới
          </p>
        </header>

        {sections.map((s) => (
          <section key={s.title} className="rounded-xl border border-line bg-surface px-5 py-5 shadow-sm">
            <h2 className="text-[15px] font-medium text-ink uppercase">{s.title}</h2>
            <p className="mt-1.5 flex gap-2 text-sm text-ink">
              <Info className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden />
              {s.description}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {s.actions.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors hover:bg-muted",
                    a.tone === "lime"
                      ? "border-cta-500 text-cta-600"
                      : "border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300",
                  )}
                >
                  <a.icon className="size-4" /> {a.label}
                </Link>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-faint">{s.hint}</p>
          </section>
        ))}

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
