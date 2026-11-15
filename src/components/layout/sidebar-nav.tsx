"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { isSoon, SOON_PATH, type Feature } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { FeatureIcon } from "./feature-icon";

/**
 * Mục đang mở? Trang "Đang xây dựng" so theo tham số ?t=.
 * Nhiều mục cùng khớp (VD /de-thi và /de-thi/ngan-hang-chung) → chỉ mục có href DÀI NHẤT sáng.
 */
function useIsActive(items: Feature[]) {
  const pathname = usePathname();
  const params = useSearchParams();
  const matches = (item: Feature) => {
    if (isSoon(item.href)) {
      if (pathname !== SOON_PATH) return false;
      return new URL(item.href, "http://x").searchParams.get("t") === params.get("t");
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };
  const best = items.filter(matches).sort((a, b) => b.href.length - a.href.length)[0];
  return (item: Feature) => best !== undefined && item.href === best.href;
}

/** Sidebar dọc (máy tính): chỉ icon, mục đang mở là "tab" nối liền vào khung nội dung. */
export function SidebarNav({ items, bottom }: { items: Feature[]; bottom: Feature }) {
  const isActive = useIsActive([...items, bottom]);

  const renderItem = (item: Feature) => {
    const active = isActive(item);
    return (
      <li key={item.href} className="relative">
        <Link
          href={item.href}
          aria-label={item.label}
          aria-current={active ? "page" : undefined}
          className={cn(
            // Icon 22px căn giữa sidebar 92px: lề trái 29px (mục đang mở lùi 8px nên còn 21px).
            "group relative flex h-[54px] items-center pl-[29px] transition-colors",
            active ? "sidebar-tab ml-2 rounded-l-full bg-canvas pl-[21px] text-brand-700" : "text-white/90 hover:text-white",
          )}
        >
          <FeatureIcon name={item.icon} className="size-[22px]" />
          {/* Nhãn hiện khi rê chuột */}
          <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-canvas opacity-0 shadow transition-opacity group-hover:opacity-100">
            {item.label}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <>
      <ul className="flex flex-col gap-0.5">{items.map(renderItem)}</ul>
      <ul className="mt-auto border-t border-white/15 pt-3">{renderItem(bottom)}</ul>
    </>
  );
}

/** Thanh điều hướng dưới đáy (điện thoại). */
export function MobileNav({ items }: { items: Feature[] }) {
  const isActive = useIsActive(items);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto bg-sidebar md:hidden">
      {items.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex w-[76px] shrink-0 flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium",
              active ? "text-white" : "text-white/65",
            )}
          >
            <FeatureIcon name={item.icon} className="size-5" />
            <span className="w-full truncate text-center">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
