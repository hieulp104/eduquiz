import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/auth.service";

/**
 * Khung toàn màn hình cho trình soạn đề (không sidebar) — trang tự vẽ thanh trên của nó.
 * Kiểm tra quyền chi tiết vẫn nằm ở từng page (requirePagePermission).
 */
export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <div className="min-h-screen bg-canvas">{children}</div>;
}
