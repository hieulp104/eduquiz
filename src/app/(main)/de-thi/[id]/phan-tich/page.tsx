import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/common/guards/page.guard";
import { can } from "@/common/permissions/permissions";
import { gradeLabel } from "@/common/enums";
import { getExamWithAnswers } from "@/modules/exams/exams.service";
import { StructureAnalysis } from "@/modules/exams/components/structure-analysis";

export const metadata: Metadata = { title: "Phân tích cấu trúc đề thi" };

/** Phân tích cấu trúc đề: điểm + mức độ từng câu, bảng tổng hợp theo mức độ / nhóm câu. Chỉ người soạn / Admin. */
export default async function ExamAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("exam.view");
  const exam = await getExamWithAnswers(user, id);
  if (!exam) notFound();

  const groupById = new Map(exam.groups.map((g) => [g.id, g]));
  return (
    <StructureAnalysis
      examId={exam.id}
      title={exam.title}
      subtitle={[exam.grade !== null ? gradeLabel(exam.grade) : null, exam.subject].filter(Boolean).join(" - ")}
      canEdit={can(user, "exam.update", { ownerId: exam.teacherId })}
      questions={exam.questions.map((q) => {
        const g = q.groupId ? groupById.get(q.groupId) : null;
        return {
          id: q.id,
          content: q.content,
          points: q.points,
          level: q.level,
          groupId: q.groupId,
          group: g ? { id: g.id, content: g.content, audioFileId: g.audioFileId } : null,
          options: q.options.map((o) => ({ id: o.id, content: o.content, isCorrect: o.isCorrect })),
        };
      })}
    />
  );
}
