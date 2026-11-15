"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/modules/auth/auth.service";
import { loginSchema } from "@/modules/auth/auth.schema";

export type LoginState = {
  error: string | null;
  /** Giữ lại tên đăng nhập đã nhập để không bắt gõ lại khi sai mật khẩu. */
  login?: string;
};

/**
 * Chuẩn hóa callbackUrl do proxy.ts gắn vào thành đường dẫn nội bộ —
 * chặn open redirect (/login?callbackUrl=https://site-gia-mao...).
 */
function safeCallbackPath(raw: string | null | undefined): string {
  const fallback = "/dashboard";
  if (!raw) return fallback;
  let path: string;
  try {
    path = raw.startsWith("/") ? raw : new URL(raw).pathname + new URL(raw).search;
  } catch {
    return fallback;
  }
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  if (path.startsWith("/login")) return fallback;
  return path;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const login = String(formData.get("login") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeCallbackPath(formData.get("callbackUrl") as string | null);

  const parsed = loginSchema.safeParse({ login, password });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ", login };
  }

  try {
    // Gửi chuỗi gốc — authorize() tự validate lại bằng cùng schema.
    await signIn("credentials", { login, password, redirectTo });
  } catch (error) {
    // signIn ném redirect khi thành công — chỉ bắt AuthError, còn lại để đi tiếp.
    if (error instanceof AuthError) {
      return { error: "Tên đăng nhập hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa.", login };
    }
    throw error;
  }
  return { error: null };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
