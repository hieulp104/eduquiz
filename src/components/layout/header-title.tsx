"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { HOME } from "@/config/navigation";

/**
 * Góc trái header: trang chủ → không có gì (tiêu đề nằm giữa);
 * trang con → nút "Quay lại".
 */
export function HeaderBack() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === HOME.href) return <span />;

  return (
    <button
      type="button"
      onClick={() => {
        // Mở thẳng link (không có lịch sử trong tab) thì về trang chủ.
        if (window.history.length > 1) router.back();
        else router.push(HOME.href);
      }}
      className="flex items-center gap-1.5 justify-self-start rounded-md px-1 py-1 text-[15px] font-medium text-ink hover:text-brand-700"
    >
      <ChevronLeft className="size-4" /> Quay lại
    </button>
  );
}

/** Giữa header: chỉ trang chủ có tiêu đề ("Màn hình chính"). */
export function HeaderTitle({ className }: { className?: string }) {
  const pathname = usePathname();
  return pathname === HOME.href ? <p className={className}>{HOME.label}</p> : <span />;
}
