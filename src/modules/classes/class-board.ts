/** Danh sách lớp (trang /lop-hoc của giáo viên): kiểu dữ liệu + năm học. Client-safe — không import gì phía server. */

export type BoardClass = {
  id: string;
  name: string;
  joinCode: string;
  schoolYear: string | null;
  groupId: string | null;
  /** Tên chủ lớp nếu lớp được người khác phân quyền cho mình (null = lớp của mình). */
  sharedBy: string | null;
  memberCount: number;
  assignmentCount: number;
  createdAt: string;
};

export type BoardGroup = { id: string; name: string };

const VN_TZ = "Asia/Ho_Chi_Minh";

/** Năm học chứa ngày `d`: từ tháng 8 tính sang năm học mới. 11/2026 → "2026-2027", 3/2027 → "2026-2027". */
export function schoolYearOf(d: Date): string {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ, year: "numeric", month: "numeric" })
    .formatToParts(d)
    .filter((p) => p.type === "year" || p.type === "month")
    .map((p) => Number(p.value));
  const start = m >= 8 ? y : y - 1;
  return `${start}-${start + 1}`;
}

/** "2026-2027" → "2027-2028" (năm sau = +1). */
export function shiftSchoolYear(year: string, by: number): string {
  const start = Number(year.slice(0, 4)) + by;
  return `${start}-${start + 1}`;
}

/** Các năm học cho ô chọn: 2 năm trước → 2 năm sau năm học hiện tại. */
export function schoolYearOptions(current: string): string[] {
  return [-2, -1, 0, 1, 2].map((k) => shiftSchoolYear(current, k));
}

export const isSchoolYear = (s: string) => /^\d{4}-\d{4}$/.test(s) && Number(s.slice(5)) === Number(s.slice(0, 4)) + 1;

/** Hiển thị "2026 - 2027". */
export const formatSchoolYear = (s: string | null) => (s ? s.replace("-", " - ") : "Chưa có năm học");

/**
 * Tên lớp cho khóa mới: tăng khối ở đầu tên nếu có (10A1 → 11A1, 6/2 → 7/2, "Lớp 9A" → "Lớp 10A").
 * Không nhận ra khối (hoặc đã lớp 12) thì giữ nguyên tên.
 */
export function nextClassName(name: string): string {
  const m = name.match(/^(\D*?)(\d{1,2})(?=\D|$)/);
  if (!m) return name;
  const grade = Number(m[2]);
  if (grade < 1 || grade >= 12) return name;
  return `${m[1]}${grade + 1}${name.slice(m[0].length)}`;
}
