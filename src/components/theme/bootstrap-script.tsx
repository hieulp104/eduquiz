"use client";

/**
 * Script áp chế độ sáng/tối TRƯỚC khi vẽ trang. Chạy đồng bộ trong HTML từ server;
 * khi hydrate, React thấy type="text/plain" nên không cảnh báo "script tag" và không chạy lại.
 */
export function ThemeBootstrapScript({ html }: { html: string }) {
  return (
    <script
      id="eduquiz-theme-bootstrap"
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
