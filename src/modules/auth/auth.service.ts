import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/modules/auth/auth.config";
import { loginSchema } from "@/modules/auth/auth.schema";
import { prisma } from "@/shared/prisma/prisma.service";
import type { SessionUser } from "@/common/permissions/permissions";

/** Nạp user trong phiên từ DB. Trả null nếu tài khoản bị khóa / xóa mềm. */
export async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null, isActive: true },
    select: { id: true, email: true, fullName: true, role: true },
  });
  return user;
}

/** Bao lâu nạp lại thông tin user từ DB một lần (khóa tài khoản / đổi vai trò có hiệu lực). */
const SESSION_REVALIDATE_MS = 5 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        login: { label: "Số điện thoại, email hoặc username", type: "text" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { login, password } = parsed.data;
        const user = await prisma.user.findUnique({
          where:
            login.kind === "email"
              ? { email: login.value }
              : login.kind === "phone"
                ? { phone: login.value }
                : { username: login.value },
          select: {
            id: true,
            email: true,
            fullName: true,
            passwordHash: true,
            isActive: true,
            deletedAt: true,
          },
        });

        if (!user || !user.isActive || user.deletedAt) return null;
        if (!(await bcrypt.compare(password, user.passwordHash))) return null;

        return { id: user.id, email: user.email, name: user.fullName };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    async jwt({ token, user }) {
      const isStale =
        typeof token.refreshedAt !== "number" ||
        Date.now() - token.refreshedAt > SESSION_REVALIDATE_MS;

      if (user?.id || isStale) {
        const id = user?.id ?? token.sub;
        if (id) {
          token.sessionUser = (await loadSessionUser(id)) ?? undefined;
          token.sub = id;
          token.refreshedAt = Date.now();
        }
      }
      return token;
    },

    async session({ session, token }) {
      const sessionUser = token.sessionUser;
      // Token còn hạn nhưng tài khoản đã bị khóa → coi như chưa đăng nhập.
      session.user = {
        ...session.user,
        ...(sessionUser ?? { id: "" }),
      } as typeof session.user;
      return session;
    },
  },
});

/**
 * Lấy user hiện tại. Dùng ở Server Component và Server Action.
 * Trả về null nếu chưa đăng nhập.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  return user?.id ? user : null;
}

/** Bắt buộc phải đăng nhập — ném lỗi nếu không, dùng trong server action. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
