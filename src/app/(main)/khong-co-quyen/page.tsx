import Link from "next/link";
import { buttonClass, EmptyState } from "@/components/ui";

export default function ForbiddenPage() {
  return (
    <EmptyState
      title="Bạn không có quyền truy cập trang này"
      description="Liên hệ quản trị viên nếu bạn nghĩ đây là nhầm lẫn."
      action={
        <Link href="/dashboard" className={buttonClass("secondary")}>
          Về trang tổng quan
        </Link>
      }
    />
  );
}
