import { redirect } from "next/navigation";
import { auth } from "@/modules/auth/auth.service";

/** "/" — đã đăng nhập vào Tổng quan, chưa đăng nhập xem trang giới thiệu. */
export default async function RootPage() {
  const session = await auth();
  redirect(session?.user ? "/dashboard" : "/gioi-thieu");
}
