import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { LibraryExam } from "@/modules/exams/exam-library.types";

/** "Được đề xuất": thẻ đề gần đây — tên, ngày tạo, thời gian làm, lượt làm. */
export function RecommendedExams({ exams }: { exams: LibraryExam[] }) {
  if (exams.length === 0) return null;
  return (
    <section>
      <h2 className="mb-4 text-lg font-medium text-ink">Được đề xuất</h2>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {exams.map((e) => (
          <Link
            key={e.id}
            href={`/de-thi/${e.id}`}
            className="group flex items-center gap-4 rounded-lg bg-surface px-3 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <FileCheck2 className="size-9 shrink-0 text-orange-500" strokeWidth={1.5} />
            <div className="min-w-0 space-y-1">
              <p className="truncate text-[15px] font-medium text-ink group-hover:text-brand-700">{e.title}</p>
              <p className="text-xs text-ink-soft">Ngày tạo: {formatDateTime(e.createdAt)}</p>
              <p className="text-xs text-ink-soft">Thời gian làm bài: {e.durationMinutes} phút</p>
              <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                Lượt làm:
                <span className="inline-flex h-[22px] min-w-[30px] items-center justify-center rounded-full bg-cta-500 px-2 text-xs font-bold text-white">
                  {e.submittedCount}
                </span>
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
