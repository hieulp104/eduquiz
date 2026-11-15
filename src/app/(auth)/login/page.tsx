import type { Metadata } from "next";
import { LoginForm } from "@/modules/auth/components/login-form";

export const metadata: Metadata = { title: "Đăng nhập" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  return <LoginForm callbackUrl={callbackUrl} />;
}
