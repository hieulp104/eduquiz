import { redirect } from "next/navigation";

/** Đường dẫn cũ (khi trang chỉ có Toán) — chuyển sang /bai-tap/phieu, giữ ?sach=. */
export default async function OldWorksheetPage({
  searchParams,
}: {
  searchParams: Promise<{ sach?: string }>;
}) {
  const { sach } = await searchParams;
  redirect(
    sach ? `/bai-tap/phieu?sach=${encodeURIComponent(sach)}` : "/bai-tap/phieu",
  );
}
