import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, FileText, Paperclip, Plus, Search } from "lucide-react";
import { requirePagePermission } from "@/common/guards/page.guard";
import { hasPermission } from "@/common/permissions/permissions";
import { HOMEWORK_PURPOSE_LABEL } from "@/common/enums";
import { WORKSHEET_HREF } from "@/config/navigation";
import { Badge, buttonClass, EmptyState } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { listHomeworks } from "@/modules/homework/homework.service";

export const metadata: Metadata = { title: "Bài tập" };

export default async function HomeworkListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requirePagePermission("homework.view");
  const { q = "" } = await searchParams;
  const homeworks = await listHomeworks(user, q);
  const canCreate = hasPermission(user, "homework.create");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Form GET — tìm kiếm chạy ở server, link có thể chia sẻ. */}
        <form className="relative w-full sm:w-[232px]" role="search">
          <input
            name="q"
            defaultValue={q}
            placeholder="Tìm kiếm theo tên lớp"
            aria-label="Tìm kiếm theo tên lớp"
            className="h-[38px] w-full rounded-md border border-line bg-surface pr-9 pl-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Tìm"
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-ink-soft"
          >
            <Search className="size-4" />
          </button>
        </form>

        {canCreate && (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/bai-tap/tao-moi"
              className="inline-flex h-[38px] min-w-48 items-center justify-center gap-2 rounded-md bg-cta-500 px-5 text-sm font-semibold text-white shadow-sm hover:bg-cta-600"
            >
              <Plus className="size-4" /> Tạo bài tập
            </Link>
            <Link
              href={WORKSHEET_HREF}
              className="inline-flex h-[38px] items-center justify-center gap-2 rounded-md bg-brand-100 px-4 text-sm font-medium text-brand-800 shadow-sm hover:bg-brand-200 dark:bg-brand-900/40 dark:text-brand-200"
            >
              <Plus className="size-4" /> Soạn phiếu từ ngân hàng câu hỏi
            </Link>
          </div>
        )}
      </div>

      <h1 className="text-lg font-medium text-ink">Tất cả</h1>

      {homeworks.length === 0 ? (
        q ? (
          <EmptyState
            title="Không tìm thấy bài tập"
            description={`Không có bài tập nào khớp “${q}”.`}
          />
        ) : (
          <EmptyState
            title="Chưa có bài tập nào"
            description="Tạo bài tập, đính kèm file và giao cho lớp."
            action={
              canCreate && (
                <Link href="/bai-tap/tao-moi" className={buttonClass()}>
                  <Plus className="size-4" /> Tạo bài tập
                </Link>
              )
            }
          />
        )
      ) : (
        <ul className="space-y-3">
          {homeworks.map((hw) => (
            <li key={hw.id}>
              <Link
                href={`/bai-tap/${hw.id}`}
                className="group flex flex-wrap items-center gap-4 rounded-lg bg-surface px-5 py-4 shadow-sm transition hover:shadow-md"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-muted dark:text-brand-300">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink group-hover:text-brand-700">
                    {hw.title}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    Khối {hw.grade} · {hw.subject} ·{" "}
                    {HOMEWORK_PURPOSE_LABEL[hw.purpose]}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {hw.classes.map(({ classroom }) => (
                      <Badge key={classroom.id} variant="brand">
                        {classroom.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs text-ink-soft">
                  <span className="flex items-center gap-1.5">
                    <CalendarClock className="size-3.5" />
                    {hw.dueAt
                      ? `Hạn ${formatDateTime(hw.dueAt)}`
                      : "Không giới hạn thời gian"}
                  </span>
                  {hw._count.files > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Paperclip className="size-3.5" /> {hw._count.files} file
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
