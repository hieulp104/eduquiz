import NextAuth from "next-auth";
import { authConfig } from "@/modules/auth/auth.config";

/**
 * Từ Next.js 16, "middleware" đổi tên thành "proxy" (chức năng giữ nguyên).
 *
 * Ở đây chỉ kiểm tra "đã đăng nhập hay chưa". Kiểm tra quyền chi tiết (can()) nằm
 * ở từng page/server action, vì proxy chạy ở edge runtime nên không truy vấn được DB.
 */
export default NextAuth(authConfig).auth;

export const config = {
  // api/files tự kiểm tra đăng nhập — để ngoài proxy vì proxy chỉ đệm 10MB body (file tới 20MB).
  matcher: ["/((?!api/auth|api/health|api/files|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
