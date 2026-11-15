import type { Metadata } from "next";
import { requirePagePermission } from "@/common/guards/page.guard";
import { FEEDBACK_HREF } from "@/config/navigation";
import { getBookTree, listBooks } from "@/modules/worksheet/worksheet.service";
import { WorksheetWorkspace } from "@/modules/worksheet/components/worksheet-workspace";

export const metadata: Metadata = { title: "Tạo phiếu bài tập Toán" };

export default async function MathWorksheetPage({ searchParams }: { searchParams: Promise<{ sach?: string }> }) {
  await requirePagePermission("exam.create");
  const { sach } = await searchParams;
  const books = await listBooks();
  // ?sach=<id> (đi từ Ngân hàng chung) → mở đúng sách; không có thì mở sách đầu tiên.
  const first = books.find((b) => b.id === sach) ?? books[0] ?? null;
  const tree = first ? await getBookTree(first.id) : [];

  return (
    <WorksheetWorkspace
      // key theo sách: đổi sách từ trang ngoài thì dựng lại trạng thái cho đúng
      key={first?.id ?? "none"}
      books={books}
      initialBookId={first?.id ?? null}
      initialTree={tree}
      feedbackHref={FEEDBACK_HREF}
    />
  );
}
