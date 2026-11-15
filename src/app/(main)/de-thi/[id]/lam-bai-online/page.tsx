import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePagePermission } from "@/common/guards/page.guard";
import { can } from "@/common/permissions/permissions";
import { toVnDateTimeLocal } from "@/lib/utils";
import { getExamOverview } from "@/modules/exams/exams.service";
import { OnlineSettingsForm } from "@/modules/publish/components/online-settings-form";
import { listClassesWithStudents } from "@/modules/publish/publish.service";
import type { OnlineSettingsValue } from "@/modules/publish/publish.types";

export const metadata: Metadata = { title: "Cài đặt làm bài online" };

/** "Cài đặt làm bài online": cấu hình Kiểm tra / Luyện tập rồi Lưu nháp hoặc Xuất bản. */
export default async function OnlineSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("exam.update");
  const [data, classes] = await Promise.all([getExamOverview(user, id), listClassesWithStudents(user)]);
  if (!data) notFound();
  const { exam } = data;
  if (!can(user, "exam.update", { ownerId: exam.teacherId })) redirect("/khong-co-quyen");

  const c = exam.onlineConfig;
  // Đề giao kiểu cũ (từ trang lớp, chưa có cấu hình): điền sẵn theo các bài giao đang có.
  const legacy = exam.assignments.filter((a) => a.classId);
  const known = new Set(classes.map((k) => k.id));

  const initial: OnlineSettingsValue = {
    title: exam.title,
    grade: exam.grade,
    subject: exam.subject,
    purpose: exam.purpose,
    durationMinutes: exam.durationMinutes,
    mode: c?.mode ?? "EXAM",
    openAt: c?.openAt ? toVnDateTimeLocal(c.openAt) : "",
    dueAt: c?.dueAt ? toVnDateTimeLocal(c.dueAt) : "",
    audience: c?.audience ?? (legacy.length ? "CLASSES" : "ALL"),
    classIds: (c?.classIds ?? legacy.map((a) => a.classId!)).filter((x) => known.has(x)),
    studentIds: c?.studentIds ?? [],
    labMode: c?.labMode ?? false,
    maxAttempts: c?.maxAttempts ?? 1,
    password: c?.password ?? "",
    monitorLeave: c?.monitorLeave ?? false,
    shuffle: c?.shuffle ?? false,
    shuffleGroups: c?.shuffleGroups ?? false,
    hideGroupTitles: c?.hideGroupTitles ?? false,
    showScore: c?.showScore ?? "AFTER_SUBMIT",
    showAnswers: c?.showAnswers ?? "AFTER_SUBMIT",
    minScoreForAnswers: c?.minScoreForAnswers ?? null,
    hideWrongAnswers: c?.hideWrongAnswers ?? false,
    retryWrong: c?.retryWrong ?? false,
    headerNote: c?.headerNote ?? "",
    preNotice: c?.preNotice ?? "",
    priceMode: exam.priceMode,
    price: exam.price,
    priceNote: exam.priceNote,
  };

  return (
    <div className="space-y-4">
      <OnlineSettingsForm
        examId={exam.id}
        code={c?.code ?? null}
        published={Boolean(c?.publishedAt)}
        initial={initial}
        classes={classes.map((k) => ({
          id: k.id,
          name: k.name,
          students: k.members.map((m) => ({ id: m.student.id, name: m.student.fullName })),
        }))}
      />
    </div>
  );
}
