import { BrandLogo, ThemeToggle } from "@/components/theme";

/** Khung cho trang mở được khi chưa đăng nhập (link làm bài /thi/<mã>) — chỉ có thanh trên, không sidebar. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <BrandLogo />
        <ThemeToggle />
      </header>
      <main className="px-4 pt-4 pb-10 sm:pt-8">{children}</main>
    </div>
  );
}
