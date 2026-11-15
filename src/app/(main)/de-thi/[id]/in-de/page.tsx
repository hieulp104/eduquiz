import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/common/guards/page.guard";
import { getExamWithAnswers } from "@/modules/exams/exams.service";
import { PrintExamForm } from "@/modules/exams/components/print-exam-form";

export const metadata: Metadata = { title: "In đề + phiếu trả lời" };

/** "IN ĐỀ - Có phiếu trả lời riêng": chọn số đề đảo, mã đề, mẫu phiếu → tải file .docx. Chỉ người soạn / Admin. */
export default async function PrintExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("exam.view");
  const exam = await getExamWithAnswers(user, id);
  if (!exam) notFound();

  return (
    <PrintExamForm
      examId={exam.id}
      title={exam.title}
      questionCount={exam.questions.length}
      optionCount={Math.max(2, ...exam.questions.map((q) => q.options.length))}
    />
  );
}
