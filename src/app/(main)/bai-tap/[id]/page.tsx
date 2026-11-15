import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, Download, Eye, FileText, LogIn } from "lucide-react";
import { requirePagePermission } from "@/common/guards/page.guard";
import { HOMEWORK_PURPOSE_LABEL } from "@/common/enums";
import { Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { formatFileSize } from "@/modules/files/files.constants";
import { getHomework } from "@/modules/homework/homework.service";

export const metadata: Metadata = { title: "Chi tiết bài tập" };

export default async function HomeworkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("homework.view");
  const hw = await getHomework(user, id);
  if (!hw) notFound();

  const timeText =
    hw.startAt || hw.dueAt
      ? `${hw.startAt ? formatDateTime(hw.startAt) : "Bất kỳ lúc nào"} → ${hw.dueAt ? formatDateTime(hw.dueAt) : "Không giới hạn"}`
      : "Không giới hạn thời gian";

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-4">
      <div className="rounded-lg bg-surface p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase text-ink-soft">
          Khối {hw.grade} · {hw.subject} · {HOMEWORK_PURPOSE_LABEL[hw.purpose]}
        </p>
        <h1 className="mt-1 text-xl font-bold text-ink">{hw.title}</h1>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
          <span className="flex items-center gap-1.5">
            <CalendarClock className="size-4" /> {timeText}
          </span>
          <span className="flex items-center gap-1.5">
            <Eye className="size-4" /> {hw.showResult ? "Cho xem kết quả" : "Không cho xem kết quả"}
          </span>
          <span className="flex items-center gap-1.5">
            <LogIn className="size-4" /> {hw.requireLogin ? "Phải đăng nhập để nộp" : "Không cần đăng nhập để nộp"}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-ink-soft">Giao cho:</span>
          {hw.classes.map(({ classroom }) => (
            <Badge key={classroom.id} variant="brand">
              {classroom.name}
            </Badge>
          ))}
        </div>
      </div>

      {hw.files.length > 0 && (
        <div className="rounded-lg bg-surface p-5 shadow-sm">
          <h2 className="mb-3 font-medium text-ink">File bài tập ({hw.files.length})</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {hw.files.map((f) => (
              <li key={f.id} className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2">
                <FileText className="size-4 shrink-0 text-brand-700 dark:text-brand-300" />
                <a
                  href={`/api/files/${f.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-sm text-ink hover:text-brand-700 hover:underline"
                >
                  {f.originalName}
                </a>
                <span className="shrink-0 text-xs text-ink-faint">{formatFileSize(f.size)}</span>
                <a
                  href={`/api/files/${f.id}?download`}
                  aria-label={`Tải ${f.originalName}`}
                  className="rounded p-1 text-ink-soft hover:bg-muted hover:text-brand-700"
                >
                  <Download className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hw.contentHtml && (
        <div className="rounded-lg bg-surface p-5 shadow-sm">
          <h2 className="mb-2 font-medium text-ink">Nội dung</h2>
          {/* contentHtml đã lọc bằng sanitize-html lúc lưu (homework.sanitize.ts). */}
          <div className="rich-content text-ink" dangerouslySetInnerHTML={{ __html: hw.contentHtml }} />
        </div>
      )}
    </div>
  );
}
