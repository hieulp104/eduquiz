/**
 * ═══════════════════════════════════════════════════════════════
 * EduQuiz — Tầng phân quyền tập trung
 * ═══════════════════════════════════════════════════════════════
 * QUY TẮC BẮT BUỘC: mọi kiểm tra quyền đi qua `can()` / `hasPermission()` trong file này.
 * TUYỆT ĐỐI không viết `if (user.role === "TEACHER")` rải rác trong code.
 *
 * Mô hình: RBAC + phạm vi (scope)
 *   ALL — toàn hệ thống (Admin)
 *   OWN — chỉ dữ liệu của chính mình: lớp mình dạy, đề mình soạn, bài mình làm
 *
 * Bộ quyền nằm cố định trong code (ROLE_GRANTS). Khi cần cho Admin sửa quyền qua UI
 * thì chuyển sang bảng role_permissions trong DB — chữ ký của can() giữ nguyên.
 */

import type { RoleCode } from "@/generated/prisma/enums";

export type { RoleCode };

// ═══════════════════ DANH MỤC QUYỀN ═══════════════════

export const PERMISSIONS = [
  // --- Người dùng ---
  { code: "user.manage", name: "Quản lý tài khoản" },
  { code: "teacher.manage", name: "Quản lý giáo viên cộng tác, phân quyền lớp" },

  // --- Lớp học ---
  { code: "class.view", name: "Xem lớp học" },
  { code: "class.create", name: "Tạo lớp học" },
  { code: "class.update", name: "Sửa lớp, xóa học sinh khỏi lớp" },
  { code: "class.join", name: "Tham gia lớp bằng mã" },

  // --- Đề thi ---
  { code: "exam.view", name: "Xem đề thi (kèm đáp án)" },
  { code: "exam.create", name: "Soạn đề thi" },
  { code: "exam.update", name: "Sửa / xóa đề thi" },

  // --- Giao bài ---
  { code: "assignment.create", name: "Giao bài cho lớp" },
  { code: "assignment.result.view", name: "Xem kết quả cả lớp" },

  // --- Bài tập (nội dung + file) ---
  { code: "homework.view", name: "Xem bài tập" },
  { code: "homework.create", name: "Tạo bài tập" },
  { code: "homework.update", name: "Sửa / xóa bài tập" },
  { code: "file.upload", name: "Tải file lên" },

  // --- Ngân hàng câu hỏi riêng ---
  { code: "bank.manage", name: "Tạo / sửa ngân hàng câu hỏi của mình, tạo đề từ ngân hàng" },

  // --- Kho nội dung ---
  { code: "content.view", name: "Xem / tải nội dung trong kho chung" },
  { code: "content.share", name: "Đóng góp nội dung lên kho, gỡ nội dung của mình" },

  // --- Làm bài ---
  { code: "submission.take", name: "Làm bài được giao" },
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number]["code"];
export type PermissionScope = "ALL" | "OWN";

export const ROLE_LABEL: Record<RoleCode, string> = {
  ADMIN: "Quản trị viên",
  TEACHER: "Giáo viên",
  STUDENT: "Học sinh",
};

/** Quyền chỉ dành cho người học. */
const LEARNER_ONLY = new Set<PermissionCode>(["class.join", "submission.take"]);

/** Bộ quyền theo vai trò. */
const ROLE_GRANTS: Record<RoleCode, Partial<Record<PermissionCode, PermissionScope>>> = {
  // Admin toàn quyền quản lý, nhưng không phải học sinh: không vào lớp / làm bài.
  ADMIN: Object.fromEntries(
    PERMISSIONS.filter((p) => !LEARNER_ONLY.has(p.code)).map((p) => [p.code, "ALL"]),
  ),
  TEACHER: {
    "teacher.manage": "OWN",
    "class.view": "OWN",
    "class.create": "OWN",
    "class.update": "OWN",
    "exam.view": "OWN",
    "exam.create": "OWN",
    "exam.update": "OWN",
    "assignment.create": "OWN",
    "assignment.result.view": "OWN",
    "homework.view": "OWN",
    "homework.create": "OWN",
    "homework.update": "OWN",
    "file.upload": "OWN",
    // Kho chung: ai cũng xem được nội dung đã chia sẻ (ALL); chỉ gỡ được nội dung của mình (OWN).
    "bank.manage": "OWN",
    "content.view": "ALL",
    "content.share": "OWN",
  },
  STUDENT: {
    "class.view": "OWN",
    "class.join": "OWN",
    "submission.take": "OWN",
  },
};

// ═══════════════════ USER TRONG PHIÊN ═══════════════════

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: RoleCode;
};

/** Ngữ cảnh bản ghi đang thao tác — dùng cho scope OWN. */
export type PermissionContext = {
  /** id người sở hữu bản ghi (giáo viên của lớp/đề, học sinh của bài nộp). */
  ownerId?: string | null;
  /**
   * Giáo viên được chủ lớp phân quyền ("Quản lý giáo viên") — CHỈ truyền khi kiểm tra quyền được chia:
   * class.view · assignment.create · assignment.result.view. Không truyền cho class.update (sửa lớp, xóa học sinh).
   * Lấy bằng classSharedWith() trong modules/teachers/class-sharing.service.ts.
   */
  sharedWith?: readonly string[];
};

/** User có quyền này ở bất kỳ phạm vi nào — dùng cho menu và chặn trang. */
export function hasPermission(user: SessionUser, permission: PermissionCode): boolean {
  return Boolean(ROLE_GRANTS[user.role]?.[permission]);
}

/** Phạm vi của quyền với user, null nếu không có quyền. */
export function scopeOf(user: SessionUser, permission: PermissionCode): PermissionScope | null {
  return ROLE_GRANTS[user.role]?.[permission] ?? null;
}

/**
 * Kiểm tra quyền trên MỘT bản ghi cụ thể.
 *
 * @example
 *   if (!can(user, "exam.update", { ownerId: exam.teacherId })) return fail("PERMISSION_DENIED");
 */
export function can(
  user: SessionUser,
  permission: PermissionCode,
  ctx?: PermissionContext,
): boolean {
  const scope = scopeOf(user, permission);
  if (!scope) return false;
  if (scope === "ALL") return true;
  // OWN: không truyền ctx nghĩa là hành động tạo mới — chỉ cần có quyền.
  if (!ctx || ctx.ownerId === undefined) return true;
  return ctx.ownerId === user.id || Boolean(ctx.sharedWith?.includes(user.id));
}
