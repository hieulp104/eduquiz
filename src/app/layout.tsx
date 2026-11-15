import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { APP_NAME, THEME_STORAGE_KEY } from "@/components/theme/constants";
import { ThemeBootstrapScript } from "@/components/theme/bootstrap-script";
import "./globals.css";

// Font hỗ trợ đầy đủ dấu tiếng Việt.
const appFont = Roboto({
  variable: "--font-app",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Giao bài tập và thi trắc nghiệm trực tuyến",
};

/** Áp chế độ sáng/tối đã lưu TRƯỚC khi vẽ trang — tránh nháy trắng khi đang ở chế độ tối. */
const themeBootstrap = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme do script gắn trước hydrate → bỏ qua cảnh báo lệch thuộc tính.
    // translate="no" + meta notranslate: app toàn tiếng Việt — chặn Chrome tự bật bảng "Dịch trang"
    // (dịch tự động còn sửa DOM sau lưng React, dễ gây lỗi hydrate).
    <html lang="vi" translate="no" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
        <ThemeBootstrapScript html={themeBootstrap} />
      </head>
      <body className={`${appFont.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
