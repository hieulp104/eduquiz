import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePagePermission } from "@/common/guards/page.guard";
import { can } from "@/common/permissions/permissions";
import { getExamWithAnswers } from "@/modules/exams/exams.service";
import { ExamSettingsEditor } from "@/modules/exams/components/exam-settings-editor";

export const metadata: Metadata = { title: "Cài đặt đề" };

/** Sửa thông tin chung của đề — được cả khi đề đã giao (không đụng tới câu hỏi). */
export default async function ExamSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("exam.update");
  const exam = await getExamWithAnswers(user, id);
  if (!exam) notFound();
  if (!can(user, "exam.update", { ownerId: exam.teacherId })) redirect("/khong-co-quyen");

  return (
    <ExamSettingsEditor
      examId={exam.id}
      initial={{
        title: exam.title,
        grade: exam.grade,
        subject: exam.subject,
        purpose: exam.purpose,
        priceMode: exam.priceMode,
        price: exam.price,
        priceNote: exam.priceNote,
        durationMinutes: exam.durationMinutes,
        description: exam.description ?? "",
      }}
    />
  );
}
