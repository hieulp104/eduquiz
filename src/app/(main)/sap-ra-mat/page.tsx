import type { Metadata } from "next";
import Link from "next/link";
import { Construction } from "lucide-react";
import { buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Đang xây dựng" };

/** Trang tạm cho chức năng chưa xây — xem `soon()` trong config/navigation.ts. */
export default async function ComingSoonPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const name = t?.slice(0, 80) || "Chức năng này";

  return (
    <div className="flex flex-col items-center px-4 py-20 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-muted dark:text-brand-300">
        <Construction className="size-8" strokeWidth={1.75} />
      </span>
      <h1 className="mt-5 text-xl font-bold text-ink">{name}</h1>
      <p className="mt-2 max-w-md text-sm text-ink-soft">
        Tính năng đang được xây dựng và sẽ sớm ra mắt.
      </p>
      <Link href="/dashboard" className={buttonClass("secondary", "md", "mt-6")}>
        Về màn hình chính
      </Link>
    </div>
  );
}
