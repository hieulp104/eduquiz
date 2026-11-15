import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/common/guards/page.guard";
import { can } from "@/common/permissions/permissions";
import { ASSIGNMENT_STATUS_LABEL, assignmentStatus } from "@/common/enums";
import { PageHeader } from "@/components/patterns/page-header";
import { Badge, Card, CardTitle, EmptyState } from "@/components/ui";
import { formatDateTime, toVnDateTimeLocal } from "@/lib/utils";
import { getClassDetail } from "@/modules/classes/classes.service";
import { listExamOptions } from "@/modules/exams/exams.service";
import { RemoveStudentButton } from "@/modules/classes/components/remove-student-button";
import { classSharedWith } from "@/modules/teachers/class-sharing.service";
import { AssignExamForm } from "@/modules/assignments/components/assign-exam-form";

export const metadata: Metadata = { title: "Chi tiết lớp" };

const STATUS_VARIANT = { UPCOMING: "neutral", OPEN: "success", CLOSED: "danger" } as const;

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("class.view");
  const classroom = await getClassDetail(user, id);
  if (!classroom) notFound();

  const owner = { ownerId: classroom.teacherId };
  // Giáo viên được phân quyền lớp: giao đề + xem kết quả, không quản lý học sinh.
  const shared = { ...owner, sharedWith: (await classSharedWith([classroom.id])).get(classroom.id) };
  const canManage = can(user, "class.update", owner);
  const canAssign = can(user, "assignment.create", shared);
  const canSeeResults = can(user, "assignment.result.view", shared);
  const exams = canAssign ? await listExamOptions(user) : [];

  const now = new Date();
  const studentCount = classroom.members.length;

  return (
    <>
      <PageHeader
        title={classroom.name}
        description={
          <>
            {classroom.subject && <>{classroom.subject} · </>}
            GV: {classroom.teacher.fullName}
            {canManage && (
              <>
                {" "}
                · Mã vào lớp: <span className="font-semibold text-brand-700">{classroom.joinCode}</span>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          {canAssign && (
            <AssignExamForm
              classId={classroom.id}
              exams={exams}
              defaultOpenAt={toVnDateTimeLocal(now)}
              defaultDueAt={toVnDateTimeLocal(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000))}
            />
          )}

          <h2 className="text-lg font-semibold text-ink">Bài đã giao</h2>
          {classroom.assignments.length === 0 ? (
            <EmptyState title="Lớp chưa có bài nào" />
          ) : (
            classroom.assignments.map((a) => {
              const status = assignmentStatus(a, now);
              const href = canSeeResults ? `/lop-hoc/${classroom.id}/bai/${a.id}` : `/lam-bai/${a.id}`;
              return (
                <Link key={a.id} href={href} className="group block">
                  <Card className="flex flex-wrap items-center justify-between gap-3 transition-shadow group-hover:shadow-md">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink group-hover:text-brand-700">{a.exam.title}</p>
                      <p className="mt-0.5 text-sm text-ink-soft">
                        {formatDateTime(a.openAt)} → {a.dueAt ? formatDateTime(a.dueAt) : "không giới hạn"} · {a.exam.durationMinutes} phút
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {canSeeResults && (
                        <Badge>
                          {new Set(a.submissions.map((s) => s.studentId)).size}/{studentCount} đã nộp
                        </Badge>
                      )}
                      <Badge variant={STATUS_VARIANT[status]}>{ASSIGNMENT_STATUS_LABEL[status]}</Badge>
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </section>

        {canManage && (
          <Card className="self-start">
            <CardTitle className="mb-3">Học sinh ({studentCount})</CardTitle>
            {studentCount === 0 ? (
              <p className="text-sm text-ink-soft">
                Gửi mã <span className="font-semibold text-brand-700">{classroom.joinCode}</span> cho học
                sinh để vào lớp.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {classroom.members.map(({ student }) => (
                  <li key={student.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{student.fullName}</p>
                      <p className="truncate text-xs text-ink-soft">{student.email}</p>
                    </div>
                    <RemoveStudentButton
                      classId={classroom.id}
                      studentId={student.id}
                      studentName={student.fullName}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
