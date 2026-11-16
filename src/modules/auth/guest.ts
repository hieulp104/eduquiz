import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/shared/prisma/prisma.service";

/**
 * Tài khoản ẩn danh: khách mở link /thi/<mã> mà chưa đăng nhập, nhập họ tên rồi làm bài.
 * Là 1 dòng `User` (vai trò học sinh, `isGuest = true`) nên bài làm / kết quả dùng chung luồng với học sinh thật.
 * Không có mật khẩu — chỉ vào được bằng vé 1 lần do server ký ngay sau khi tạo.
 */

const TICKET_TTL_MS = 60 * 1000;

function sign(payload: string): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Thiếu AUTH_SECRET");
  return createHmac("sha256", secret).update(`guest:${payload}`).digest();
}

/** Vé đăng nhập cho tài khoản ẩn danh vừa tạo — hết hạn sau 1 phút. */
export function signGuestTicket(userId: string, now = Date.now()): string {
  const payload = `${userId}.${now + TICKET_TTL_MS}`;
  return `${payload}.${sign(payload).toString("hex")}`;
}

/** Trả id tài khoản nếu vé hợp lệ và còn hạn. */
export function verifyGuestTicket(ticket: string, now = Date.now()): string | null {
  const [userId, exp, sig] = ticket.split(".");
  if (!userId || !exp || !sig || !/^[0-9a-f]{64}$/.test(sig)) return null;
  if (!timingSafeEqual(Buffer.from(sig, "hex"), sign(`${userId}.${exp}`))) return null;
  return Number(exp) > now ? userId : null;
}

export async function createGuestUser(fullName: string) {
  const key = randomBytes(12).toString("hex");
  return prisma.user.create({
    data: {
      email: `khach-${key}@an-danh.eduquiz.local`,
      fullName,
      // Không phải mã băm bcrypt hợp lệ → không đăng nhập bằng mật khẩu được.
      passwordHash: "!",
      role: "STUDENT",
      isGuest: true,
    },
    select: { id: true },
  });
}

/** Tài khoản ẩn danh còn dùng được không (dùng khi đổi vé lấy phiên). */
export async function findActiveGuest(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, isGuest: true, isActive: true, deletedAt: null },
    select: { id: true, email: true, fullName: true },
  });
}

/** Thông tin người làm bài: tài khoản ẩn danh thì hỏi lại họ tên / lớp / STT mỗi lần bắt đầu. */
export async function getTakerProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, isGuest: true } });
  return { fullName: user?.fullName ?? "", isGuest: Boolean(user?.isGuest) };
}

/** Khách nhập lại họ tên → tài khoản ẩn danh mang tên đó (điểm các lượt làm đi theo tài khoản). */
export async function renameGuest(userId: string, fullName: string) {
  await prisma.user.updateMany({ where: { id: userId, isGuest: true }, data: { fullName } });
}
