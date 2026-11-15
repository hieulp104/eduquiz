import { prisma } from "@/shared/prisma/prisma.service";

/** Health check cho dịch vụ giám sát — không cần đăng nhập (proxy.ts bỏ qua route này). */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
