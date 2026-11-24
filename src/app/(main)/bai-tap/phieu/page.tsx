import type { Metadata } from "next";
import { requirePagePermission } from "@/common/guards/page.guard";
import { FEEDBACK_HREF } from "@/config/navigation";
import { getBookTree, listBooks } from "@/modules/worksheet/worksheet.service";
import { getTeachingProfile } from "@/modules/worksheet/shared-bank.service";
import { WorksheetWorkspace } from "@/modules/worksheet/components/worksheet-workspace";

export const metadata: Metadata = { title: "Tạo phiếu bài tập" };

export default async function WorksheetPage({
  searchParams,
}: {
  searchParams: Promise<{ sach?: string }>;
}) {
  const user = await requirePagePermission("exam.create");
  const { sach } = await searchParams;
  const [books, profile] = await Promise.all([
    listBooks(),
    getTeachingProfile(user.id),
  ]);

  // Mở sách theo thứ tự: ?sach=<id> (đi từ Ngân hàng chung) → sách khớp môn + khối đang dạy →
  // sách khớp môn đang dạy → sách đầu tiên.
  const first =
    books.find((b) => b.id === sach) ??
    books.find(
      (b) =>
        profile.subjects.includes(b.subject) &&
        profile.grades.includes(b.grade),
    ) ??
    books.find((b) => profile.subjects.includes(b.subject)) ??
    books[0] ??
    null;
  const tree = first ? await getBookTree(first.id) : [];

  return (
    <WorksheetWorkspace
      // key theo sách: đổi sách từ trang ngoài thì dựng lại trạng thái cho đúng
      key={first?.id ?? "none"}
      books={books}
      initialBookId={first?.id ?? null}
      initialSubject={first?.subject ?? profile.subjects[0] ?? "Toán"}
      initialTree={tree}
      feedbackHref={FEEDBACK_HREF}
    />
  );
}
