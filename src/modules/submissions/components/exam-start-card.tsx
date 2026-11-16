import type { ReactNode } from "react";
import { CalendarClock, CircleHelp, ClipboardList, Clock, FileText, Users, type LucideIcon } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type Props = {
  title: string;
  /** Mã trong link /thi/<mã> — đề chưa xuất bản thì không có. */
  code?: string | null;
  /** Dòng nhỏ dưới tiêu đề (tên lớp…). */
  subtitle?: string | null;
  durationMinutes: number;
  openAt: Date;
  dueAt: Date | null;
  questionCount: number;
  practice: boolean;
  /** Tổng số lượt đã nộp của đề. */
  totalAttempts: number;
  /** Số lượt người đang xem đã nộp. */
  used: number;
  /** 0 = không giới hạn. */
  maxAttempts: number;
  /** Nút bắt đầu, thông báo… */
  children: ReactNode;
};

/** Thẻ "bắt đầu thi": thông tin đề + nút bắt đầu — dùng cho cả học sinh đã đăng nhập và khách mở link. */
export function ExamStartCard({
  title,
  code,
  subtitle,
  durationMinutes,
  openAt,
  dueAt,
  questionCount,
  practice,
  totalAttempts,
  used,
  maxAttempts,
  children,
}: Props) {
  const rows: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: Clock, label: "Thời gian làm bài", value: `${durationMinutes} phút` },
    {
      icon: CalendarClock,
      label: "Thời gian vào thi",
      value: dueAt ? `${formatDateTime(openAt)} – ${formatDateTime(dueAt)}` : "Không thời hạn",
    },
    { icon: CircleHelp, label: "Số lượng câu hỏi", value: String(questionCount) },
    { icon: ClipboardList, label: "Loại đề", value: practice ? "Trắc nghiệm · Luyện tập" : "Trắc nghiệm" },
    { icon: Users, label: "Tổng lượt đã làm của đề", value: `${totalAttempts} lượt` },
    {
      icon: FileText,
      label: "Số lượt làm đề của bạn",
      value: maxAttempts === 0 ? `${used} lượt (không giới hạn)` : `${used}/${maxAttempts} lượt`,
    },
  ];

  return (
    <section className="mx-auto w-full max-w-[560px] rounded-lg bg-surface px-5 py-6 shadow-sm">
      <h1 className="text-center text-lg font-medium break-words text-ink">{title}</h1>
      {(code || subtitle) && (
        <p className="mt-2 text-center text-sm text-ink-soft">
          {[code ? `Mã đề thi: ${code}` : null, subtitle].filter(Boolean).join(" · ")}
        </p>
      )}
      <dl className="mt-5 space-y-3 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-4">
            <dt className="flex items-center gap-2 text-ink-soft">
              <r.icon className="size-4 shrink-0" /> {r.label}
            </dt>
            <dd className="text-right font-medium text-ink">{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 space-y-3">{children}</div>
    </section>
  );
}
