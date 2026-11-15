import Link from "next/link";
import { Suspense } from "react";
import { BookOpenCheck } from "lucide-react";
import {
  HOME,
  SIDEBAR_BOTTOM,
  SIDEBAR_ITEMS,
  type Feature,
} from "@/config/navigation";
import { APP_NAME } from "@/components/theme";
import { HeaderBack, HeaderTitle } from "./header-title";
import { MobileNav, SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

type Props = {
  allowedPermissions: string[];
  fullName: string;
  roleLabel: string;
  children: React.ReactNode;
};

/**
 * Khung chung sau đăng nhập: sidebar xanh đậm chỉ có icon bên trái,
 * khung nội dung bo góc bên phải (header: tiêu đề trang ở giữa, tài khoản bên phải).
 */
export function AppShell({ allowedPermissions, fullName, roleLabel, children }: Props) {
  const allowed = (f: Feature) => !f.permission || allowedPermissions.includes(f.permission);
  // Cùng href (VD "Quản lý lớp" / "Lớp của tôi") thì chỉ giữ mục đầu tiên user được thấy.
  const items = SIDEBAR_ITEMS.filter(allowed).filter(
    (f, i, arr) => arr.findIndex((x) => x.href === f.href) === i,
  );

  return (
    <div className="min-h-screen bg-sidebar">
      <aside className="fixed inset-y-0 left-0 hidden w-[92px] flex-col pb-4 md:flex">
        <Link
          href={HOME.href}
          aria-label={APP_NAME}
          className="flex h-[84px] shrink-0 items-center justify-center text-white"
        >
          <BookOpenCheck className="size-10" strokeWidth={2.25} />
        </Link>
        <Suspense>
          <SidebarNav items={items} bottom={SIDEBAR_BOTTOM} />
        </Suspense>
      </aside>

      <div className="flex min-h-screen flex-col bg-canvas pb-16 md:ml-[92px] md:my-2 md:mr-2 md:min-h-[calc(100vh-1rem)] md:rounded-3xl md:pb-0">
        <header className="mx-4 grid h-[76px] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-line md:mx-6">
          <HeaderBack />
          <HeaderTitle className="text-sm font-semibold text-ink" />
          <div className="flex justify-end">
            <UserMenu fullName={fullName} roleLabel={roleLabel} />
          </div>
        </header>
        {/* Lề trái/phải thẳng với header. Trang nào cần gói hẹp (Tổng quan 1412px, form 1000px) tự đặt max-width. */}
        <main className="w-full flex-1 px-4 py-5 md:px-6">{children}</main>
      </div>

      <Suspense>
        <MobileNav items={items} />
      </Suspense>
    </div>
  );
}
