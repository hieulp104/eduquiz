import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Gộp class Tailwind, class sau ghi đè class trước khi trùng nhóm. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const VN_TZ = "Asia/Ho_Chi_Minh";

/** Định dạng ngày theo giờ Việt Nam: "20/07/2026" */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: VN_TZ,
  }).format(d);
}

/** Định dạng ngày giờ theo giờ Việt Nam: "20/07/2026 14:30" */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: VN_TZ,
  }).format(d);
}

/** Điểm hiển thị: tối đa 2 chữ số thập phân, bỏ số 0 thừa. 7.5 → "7,5" */
export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
}

/** Quy điểm về thang 10. */
export function toScale10(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.round((score / maxScore) * 10 * 100) / 100;
}

/** Mã vào lớp 6 ký tự, bỏ các ký tự dễ nhầm (0/O, 1/I/L). */
export function generateJoinCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

/**
 * Chuyển giá trị ô <input type="datetime-local"> (giờ VN, không kèm múi giờ)
 * sang Date UTC. Không dùng new Date(value) — nó hiểu theo múi giờ của máy chủ.
 */
export function parseVnDateTimeLocal(value: string): Date {
  return new Date(`${value}:00+07:00`);
}

/** Ngược lại: Date → chuỗi cho <input type="datetime-local"> theo giờ VN. */
export function toVnDateTimeLocal(d: Date): string {
  const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return vn.toISOString().slice(0, 16);
}

/** "16 giây trước", "3 phút trước", "2 ngày trước"; quá 30 ngày → ngày giờ. */
export function timeAgo(value: Date | string, now = new Date()): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const s = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (s < 60) return `${s} giây trước`;
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  if (s < 30 * 86400) return `${Math.floor(s / 86400)} ngày trước`;
  return formatDateTime(d);
}
