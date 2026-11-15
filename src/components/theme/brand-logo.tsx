import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "./constants";

/** Logo + tên sản phẩm. */

export function BrandLogo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("inline-flex items-center gap-2 text-xl font-bold text-brand-700 dark:text-brand-300", className)}
    >
      <BookOpenCheck className="size-7" strokeWidth={2.25} />
      {APP_NAME}
    </Link>
  );
}
