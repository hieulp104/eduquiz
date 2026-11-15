import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePagePermission } from "@/common/guards/page.guard";
import { can } from "@/common/permissions/permissions";
import { PageHeader } from "@/components/patterns/page-header";
import { Badge, Card } from "@/components/ui";
import { formatDateTime, formatScore, toScale10 } from "@/lib/utils";
import {
  getAssignmentResults,
  getVisibleAssignment,
} from "@/modules/assignments/assignments.service";
import { classSharedWith } from "@/modules/teachers/class-sharing.service";


export const metadata: Metadata = { title: "Kết quả bài làm" };

export default async function AssignmentResultsPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const { id, assignmentId } = await params;
  const user = await requirePagePermission("assignment.result.view");
  const assignment = await getVisibleAssignment(user, assignmentId);
  const classroom = assignment?.classroom;
  if (!assignment || !classroom || classroom.id !== id) notFound();
  const sharedWith = (await classSharedWith([classroom.id])).get(classroom.id);
  if (!can(user, "assignment.result.view", { ownerId: classroom.teacherId, sharedWith })) {
    redirect("/khong-co-quyen");
  }

  const rows = await getAssignmentResults(assignment.id, classroom.id);
  const scores = rows
    .filter((r) => r.submission?.submittedAt)
    .map((r) => toScale10(r.submission!.score ?? 0, r.submission!.maxScore));
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  return (
    <>
      <PageHeader
        title={assignment.exam.title}
        description={
          <>
            <Link href={`/lop-hoc/${id}`} className="text-brand-700 hover:underline">
              {classroom.name}
            </Link>{" "}
            · Hạn nộp {assignment.dueAt ? formatDateTime(assignment.dueAt) : "không giới hạn"}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-ink-soft">Đã nộp</p>
          <p className="mt-1 text-2xl font-bold text-ink">
            {scores.length}/{rows.length}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-ink-soft">Điểm trung bình</p>
          <p className="mt-1 text-2xl font-bold text-ink">{formatScore(avg)}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-soft">Cao nhất</p>
          <p className="mt-1 text-2xl font-bold text-ink">
            {formatScore(scores.length ? Math.max(...scores) : null)}
          </p>
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-muted text-left text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Học sinh</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Nộp lúc</th>
              <th className="px-4 py-3 text-right font-medium">Điểm (thang 10)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ student, submission }) => (
              <tr key={student.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{student.fullName}</p>
                  <p className="text-xs text-ink-soft">{student.email}</p>
                </td>
                <td className="px-4 py-3">
                  {submission?.submittedAt ? (
                    <Badge variant="success">Đã nộp</Badge>
                  ) : submission ? (
                    <Badge variant="warning">Đang làm</Badge>
                  ) : (
                    <Badge>Chưa làm</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-soft">{formatDateTime(submission?.submittedAt)}</td>
                <td className="px-4 py-3 text-right">
                  {submission?.submittedAt ? (
                    <Link href={`/ket-qua/${submission.id}`} className="font-semibold text-brand-700 hover:underline">
                      {formatScore(toScale10(submission.score ?? 0, submission.maxScore))}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
