import { redirect } from "next/navigation";

/** Trang giao đề cũ — nay gộp vào "Cài đặt làm bài online" (giữ đường dẫn cho link đã lưu). */
export default async function AssignExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/de-thi/${id}/lam-bai-online`);
}
