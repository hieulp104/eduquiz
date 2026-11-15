import { BrandLogo, ThemeToggle } from "@/components/theme";

/** Khung cho trang đăng nhập — thanh trên cùng (logo · chế độ tối), không có sidebar. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <BrandLogo />
        <ThemeToggle />
      </header>
      <main className="flex justify-center px-4 pt-6 pb-10 sm:pt-12">
        <div className="w-full max-w-[500px] rounded-lg bg-surface p-5 shadow-sm sm:p-6">{children}</div>
      </main>
    </div>
  );
}
