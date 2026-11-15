import type { Metadata } from "next";
import { requirePagePermission } from "@/common/guards/page.guard";
import { PageHeader } from "@/components/patterns/page-header";
import { findFolder } from "@/modules/exams/exam-library.service";
import { getBookTree, listBooks } from "@/modules/worksheet/worksheet.service";
import { ExamMatrixForm } from "@/modules/worksheet/components/exam-matrix-form";

export const metadata: Metadata = { title: "Tạo đề từ ma trận" };

export default async function ExamMatrixPage({ searchParams }: { searchParams: Promise<{ "thu-muc"?: string }> }) {
  const user = await requirePagePermission("exam.create");
  const sp = await searchParams;
  const folder = sp["thu-muc"] ? await findFolder(user, sp["thu-muc"]) : null;
  const books = await listBooks();
  const first = books[0] ?? null;
  const tree = first ? await getBookTree(first.id) : [];

  return (
    <>
      <PageHeader
        title="Tạo đề từ Ma trận đề"
        description="Nhập số câu cho từng chủ đề — hệ thống bốc ngẫu nhiên câu hỏi trong ngân hàng thành một đề mới."
      />
      <ExamMatrixForm books={books} initialBookId={first?.id ?? null} initialTree={tree} folderId={folder?.id ?? null} />
    </>
  );
}
