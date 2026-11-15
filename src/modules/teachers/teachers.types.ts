/** Trang "Quản lý giáo viên" — kiểu dữ liệu client-safe (không import gì phía server). */

export type TeacherGroupItem = { id: string; name: string; memberIds: string[] };

export type ManagedTeacherItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  /** Tên tài khoản giáo viên được liên kết (trùng SĐT/email), null = giáo viên ảo. */
  accountName: string | null;
};

export type OwnClassItem = { id: string; name: string; schoolYear: string | null; memberCount: number };

export type ClassPermissionItem = { classId: string; groupId: string | null; memberId: string | null };

export type TeacherBoard = {
  groups: TeacherGroupItem[];
  teachers: ManagedTeacherItem[];
  classes: OwnClassItem[];
  permissions: ClassPermissionItem[];
};

export type PermissionTarget = { kind: "group" | "teacher"; id: string };

/** Kết quả thêm từng dòng Excel. */
export type AddTeacherOutcome = { contact: string; name: string; status: "added" | "exists" | "invalid"; message?: string };

export const ADD_OUTCOME_LABEL: Record<AddTeacherOutcome["status"], string> = {
  added: "Đã thêm",
  exists: "Trùng SĐT/email đã có trong danh sách",
  invalid: "Không hợp lệ",
};
