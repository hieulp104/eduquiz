import type { NextAuthConfig } from "next-auth";

/**
 * Cấu hình dùng chung cho CẢ proxy (edge runtime) và server.
 * ⚠ KHÔNG import Prisma / bcrypt vào file này — proxy chạy ở edge runtime,
 * không dùng được native module. Phần đó nằm ở auth.service.ts.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 ngày
  },
  trustHost: true,
  providers: [], // nạp ở auth.service.ts
  callbacks: {
    /** Chặn ở tầng proxy: chỉ kiểm tra đã đăng nhập chưa. Quyền chi tiết nằm ở page/action. */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname === "/login" ||
        // Trang giới thiệu công khai; "/" tự chuyển: chưa đăng nhập → giới thiệu, đã đăng nhập → tổng quan.
        pathname === "/" ||
        pathname === "/gioi-thieu" ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/_next") ||
        pathname === "/favicon.ico";

      if (isPublic) return true;
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
