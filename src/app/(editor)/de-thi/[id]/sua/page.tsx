import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePagePermission } from "@/common/guards/page.guard";
import { can } from "@/common/permissions/permissions";
import { getExamWithAnswers } from "@/modules/exams/exams.service";
import { LEVEL_FROM_DB, serializeExam } from "@/modules/exams/exam-text";
import { ExamComposer } from "@/modules/exams/components/composer/exam-composer";

export const metadata: Metadata = { title: "Sửa đề" };

/** Sửa đề trong trình soạn 2 cột — chỉ khi đề CHƯA giao cho lớp nào. */
export default async function EditExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("exam.update");
  const exam = await getExamWithAnswers(user, id);
  if (!exam) notFound();
  if (!can(user, "exam.update", { ownerId: exam.teacherId })) redirect("/khong-co-quyen");
  if (exam._count.assignments > 0) redirect(`/de-thi/${exam.id}`);

  const groupIndex = new Map(exam.groups.map((g, i) => [g.id, i]));
  const text = serializeExam({
    groups: exam.groups.map((g) => ({ content: g.content, fixedOrder: g.fixedOrder, audioId: g.audioFileId })),
    questions: exam.questions.map((q) => ({
      content: q.content,
      groupIndex: q.groupId ? (groupIndex.get(q.groupId) ?? null) : null,
      level: q.level ? LEVEL_FROM_DB[q.level] : null,
      fixedOptions: q.fixedOptions,
      audioId: q.audioFileId,
      options: q.options,
    })),
  });

  return (
    <ExamComposer
      mode="edit"
      examId={exam.id}
      folderId={exam.folderId}
      fromFile={false}
      initialText={text}
      initialPoints={exam.questions.map((q) => q.points)}
      settings={{
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
      backHref={`/de-thi/${exam.id}`}
    />
  );
}
