import Link from "next/link";
import { Badge, buttonClass, Card, EmptyState } from "@/components/ui";
import { ASSIGNMENT_STATUS_LABEL, assignmentStatus } from "@/common/enums";
import { formatDateTime, formatScore, toScale10 } from "@/lib/utils";

type Item = {
  id: string;
  openAt: Date;
  dueAt: Date | null;
  classroom: { name: string } | null;
  exam: {
    title: string;
    durationMinutes: number;
    onlineConfig: { maxAttempts: number; mode: string; publishedAt: Date | null } | null;
  };
  /** Mọi lượt làm — lượt đã nộp điểm cao nhất đứng đầu. */
  submissions: { id: string; submittedAt: Date | null; score: number | null; maxScore: number }[];
};

/** Danh sách bài được giao cho học sinh, kèm trạng thái làm bài. */
export function StudentAssignmentList({ items, now }: { items: Item[]; now: Date }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Chưa có bài nào được giao"
        description="Vào lớp bằng mã giáo viên gửi để nhận bài."
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((a) => {
        const sub = a.submissions[0];
        const status = assignmentStatus(a, now);
        const done = Boolean(sub?.submittedAt);
        const inProgress = a.submissions.some((s) => !s.submittedAt);
        // Còn lượt làm (đề đã xuất bản cho làm nhiều lượt / luyện tập)?
        const cfg = a.exam.onlineConfig?.publishedAt ? a.exam.onlineConfig : null;
        const max = !cfg ? 1 : cfg.mode === "PRACTICE" ? 0 : cfg.maxAttempts;
        const submitted = a.submissions.filter((s) => s.submittedAt).length;
        const canRetake = status === "OPEN" && (inProgress || max === 0 || submitted < max);

        return (
          <Card key={a.id} className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold text-ink">{a.exam.title}</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                {a.classroom?.name ?? "Giao riêng cho bạn"} · {a.exam.durationMinutes} phút ·{" "}
                {a.dueAt ? `Hạn ${formatDateTime(a.dueAt)}` : "Không giới hạn thời gian"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {done && sub ? (
                <>
                  <Badge variant="success">
                    {formatScore(toScale10(sub.score ?? 0, sub.maxScore))} điểm
                  </Badge>
                  <Link href={`/ket-qua/${sub.id}`} className={buttonClass("secondary", "sm")}>
                    Xem bài
                  </Link>
                  {canRetake && (
                    <Link href={`/lam-bai/${a.id}`} className={buttonClass("primary", "sm")}>
                      {inProgress ? "Làm tiếp" : "Làm lại"}
                    </Link>
                  )}
                </>
              ) : status === "OPEN" ? (
                <Link href={`/lam-bai/${a.id}`} className={buttonClass("primary", "sm")}>
                  {sub ? "Làm tiếp" : "Làm bài"}
                </Link>
              ) : (
                <Badge variant={status === "CLOSED" ? "danger" : "neutral"}>
                  {status === "CLOSED" ? "Không nộp" : ASSIGNMENT_STATUS_LABEL[status]}
                </Badge>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
