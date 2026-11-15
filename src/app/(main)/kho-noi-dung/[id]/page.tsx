import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Download, ExternalLink, Eye, FileText, HardDrive, Link2, User } from "lucide-react";
import { requirePagePermission } from "@/common/guards/page.guard";
import { can, hasPermission } from "@/common/permissions/permissions";
import { RichInline } from "@/components/ui";
import { cn, formatDateTime } from "@/lib/utils";
import { stripTags } from "@/lib/inline-format";
import { formatFileSize } from "@/modules/files/files.constants";
import { getContentDetail, type ContentDetail } from "@/modules/content/content.service";
import { CONTENT_KIND_LABEL, hostOf } from "@/modules/content/content.types";
import { KindIcon, metaLine } from "@/modules/content/components/content-card";
import { ContentActions } from "@/modules/content/components/content-actions";
import { QuestionGroupHeader, startsGroup } from "@/modules/exams/components/question-group-header";

export const metadata: Metadata = { title: "Kho nội dung" };

const CARD = "rounded-xl border border-line bg-surface shadow-sm";
const LETTERS = "ABCDEFGH";

export default async function ContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("content.view");
  const item = await getContentDetail(id);
  if (!item) notFound();

  const isVideo = item.kind === "VIDEO";
  const meta: { icon: typeof User; label: string; value: string }[] = [
    { icon: CalendarDays, label: "Ngày đăng", value: formatDateTime(item.createdAt) },
    { icon: User, label: "Người đóng góp", value: item.owner.fullName },
    isVideo
      ? { icon: Eye, label: "Lượt mở", value: String(item.viewCount) }
      : { icon: Download, label: "Lượt tải", value: String(item.downloadCount) },
    ...(item.file ? [{ icon: HardDrive, label: "Dung lượng", value: formatFileSize(item.file.size) }] : []),
    ...(item.exam ? [{ icon: FileText, label: "Số câu", value: `${item.exam.questions.length} câu · ${item.exam.durationMinutes} phút` }] : []),
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr] lg:items-start">
      {/* ───── Trái: thông tin ───── */}
      <aside className={cn(CARD, "space-y-4 p-4 lg:sticky lg:top-4")}>
        <div className="flex gap-3">
          <KindIcon kind={item.kind} className="size-11" />
          <div className="min-w-0">
            <h1 className="font-semibold break-words text-ink">{item.title}</h1>
            <p className="mt-0.5 text-xs text-brand-600 dark:text-brand-300">{metaLine(item)}</p>
          </div>
        </div>
        <span className="inline-block rounded-md bg-muted px-2 py-1 text-xs font-medium text-ink">{CONTENT_KIND_LABEL[item.kind].section}</span>
        <ContentActions
          id={item.id}
          kind={item.kind}
          canCopy={hasPermission(user, "exam.create")}
          isOwner={can(user, "content.share", { ownerId: item.ownerId })}
        />
        <dl className="space-y-2 border-t border-line pt-4 text-sm">
          {meta.map((m) => (
            <div key={m.label} className="flex items-center gap-2">
              <m.icon className="size-4 shrink-0 text-ink-faint" />
              <dt className="text-ink-soft">{m.label}:</dt>
              <dd className="min-w-0 truncate font-medium text-ink">{m.value}</dd>
            </div>
          ))}
        </dl>
        {item.description && (
          <div className="border-t border-line pt-4">
            <p className="text-xs font-semibold tracking-wider text-ink-soft uppercase">Mô tả</p>
            <p className="mt-1.5 text-sm whitespace-pre-wrap text-ink">{item.description}</p>
          </div>
        )}
      </aside>

      {/* ───── Phải: xem trước ───── */}
      <section className="min-w-0 space-y-4">
        <div className={cn(CARD, "flex items-center gap-3 px-5 py-3.5")}>
          <p className="min-w-0 flex-1 truncate font-medium text-ink">{item.file?.originalName ?? item.title}</p>
        </div>
        {item.exam ? <ExamPreview exam={item.exam} /> : isVideo ? <VideoLink id={item.id} url={item.url!} /> : <FilePreview file={item.file!} />}
      </section>
    </div>
  );
}

/** Đề: câu hỏi + phương án (2 hoặc 4 cột như đề in) + đáp án. */
function ExamPreview({ exam }: { exam: NonNullable<ContentDetail["exam"]> }) {
  const groups = new Map(exam.groups.map((g) => [g.id, g]));
  const questions = exam.questions.map((q) => ({ ...q, group: q.groupId ? (groups.get(q.groupId) ?? null) : null }));
  return (
    <div className={cn(CARD, "divide-y divide-line px-6")}>
      {questions.map((q, qi) => {
        const longest = Math.max(...q.options.map((o) => stripTags(o.content).length));
        const cols = longest <= 24 ? "sm:grid-cols-4" : longest <= 60 ? "sm:grid-cols-2" : "";
        const correct = q.options.findIndex((o) => o.isCorrect);
        return (
          <div key={q.id} className="py-5">
            {startsGroup(questions, qi) && (
              <QuestionGroupHeader content={q.group!.content} audioId={q.group!.audioFileId} className="mb-4" />
            )}
            <p className="font-semibold text-ink">Câu {qi + 1}</p>
            {q.content && <RichInline text={q.content} className="mt-1 block text-ink" />}
            <ul className={cn("mt-3 grid gap-x-6 gap-y-2 text-sm", cols)}>
              {q.options.map((o, oi) => (
                <li key={o.id} className="text-ink">
                  <span className="font-semibold">{LETTERS[oi]}.</span> <RichInline text={o.content} />
                </li>
              ))}
            </ul>
            {correct >= 0 && <p className="mt-3 text-sm font-semibold text-success-600">Đáp án: {LETTERS[correct]}</p>}
          </div>
        );
      })}
    </div>
  );
}

/** Video: CHỈ hiện link — bấm thì mở trang video ở tab mới (không nhúng, không lưu video). */
function VideoLink({ id, url }: { id: string; url: string }) {
  return (
    <a
      href={`/api/kho-noi-dung/${id}/tai-ve`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(CARD, "group flex flex-col items-center gap-3 px-6 py-16 text-center hover:border-brand-500")}
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-muted text-brand-600 group-hover:bg-brand-600 group-hover:text-white">
        <Link2 className="size-7" />
      </span>
      <span className="text-lg font-medium text-ink">Mở video trên {hostOf(url)}</span>
      <span className="max-w-full truncate text-sm text-ink-soft">{url}</span>
      <span className="flex items-center gap-1.5 text-sm text-brand-700 dark:text-brand-300">
        Mở trong tab mới <ExternalLink className="size-4" />
      </span>
    </a>
  );
}

/** File: PDF / ảnh xem ngay; loại khác chỉ tải về. */
function FilePreview({ file }: { file: NonNullable<ContentDetail["file"]> }) {
  const src = `/api/files/${file.id}`;
  if (file.mimeType === "application/pdf") {
    return <iframe src={src} title={file.originalName} className={cn(CARD, "h-[calc(100dvh-14rem)] min-h-[480px] w-full")} />;
  }
  if (/^image\/(png|jpe?g|gif|webp)$/.test(file.mimeType)) {
    // eslint-disable-next-line @next/next/no-img-element -- ảnh qua route kiểm quyền, không dùng next/image
    return <img src={src} alt={file.originalName} className={cn(CARD, "mx-auto max-h-[80dvh] w-auto")} />;
  }
  return (
    <div className={cn(CARD, "flex flex-col items-center gap-2 px-6 py-16 text-center")}>
      <FileText className="size-12 text-brand-300" strokeWidth={1.25} />
      <p className="font-medium text-ink">Không xem trước được loại file này</p>
      <p className="text-sm text-ink-soft">Bấm “Tải về” để mở bằng Word / PowerPoint / Excel.</p>
    </div>
  );
}
