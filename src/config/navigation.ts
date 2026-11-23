import type { PermissionCode } from "@/common/permissions/permissions";

/**
 * ═══════════════════════════════════════════════════════════════
 * Danh mục chức năng — nguồn chung cho sidebar, trang Tổng quan và tiêu đề header.
 * ═══════════════════════════════════════════════════════════════
 * Chức năng chưa xây: để `href: soon("Tên")` → dẫn tới trang "Đang xây dựng".
 * Xây xong trang nào thì đổi href sang route thật là xong.
 *
 * Ẩn mục theo quyền chỉ là phụ — trang vẫn phải tự chặn bằng requirePagePermission().
 */

export type FeatureIcon =
  | "home"
  | "assignment"
  | "exam"
  | "class"
  | "teacher"
  | "content"
  | "questionBank"
  | "course"
  | "ai"
  | "account"
  | "tip"
  | "feedback"
  | "live"
  | "search"
  | "school"
  | "partner"
  | "settings"
  | "info"
  | "trash"
  | "help";

export type Feature = {
  label: string;
  href: string;
  icon: FeatureIcon;
  /** Không có = ai đăng nhập cũng thấy. */
  permission?: PermissionCode;
  badge?: string;
};

export type QuickLink = Feature & { description?: string; highlight?: boolean };

/** Route tạm cho chức năng chưa xây. */
export const SOON_PATH = "/sap-ra-mat";
const soon = (label: string) => `${SOON_PATH}?t=${encodeURIComponent(label)}`;
export const soonHref = soon;

export const isSoon = (href: string) => href.startsWith(SOON_PATH);

export const HOME: Feature = {
  label: "Màn hình chính",
  href: "/dashboard",
  icon: "home",
};

// ═══════════════════ TRANG TỔNG QUAN ═══════════════════

export const DASHBOARD_SECTIONS: { title: string; items: Feature[] }[] = [
  {
    title: "Quản lý học tập",
    items: [
      {
        label: "Bài tập",
        href: "/bai-tap",
        icon: "assignment",
        permission: "homework.view",
      },
      {
        label: "Đề thi",
        href: "/de-thi",
        icon: "exam",
        permission: "exam.view",
      },
      {
        label: "Quản lý lớp",
        href: "/lop-hoc",
        icon: "class",
        permission: "class.create",
      },
      {
        label: "Lớp của tôi",
        href: "/lop-hoc",
        icon: "class",
        permission: "class.join",
      },
      {
        label: "Quản lý giáo viên",
        href: "/quan-ly-giao-vien",
        icon: "teacher",
        permission: "teacher.manage",
      },
    ],
  },
  {
    title: "Nội dung & Công cụ",
    items: [
      {
        label: "Kho nội dung",
        href: "/kho-noi-dung",
        icon: "content",
        permission: "content.view",
      },
      {
        label: "Ngân hàng câu hỏi",
        href: "/ngan-hang",
        icon: "questionBank",
        permission: "bank.manage",
      },
      {
        label: "Khóa học",
        href: soon("Khóa học"),
        icon: "course",
        permission: "exam.create",
      },
      {
        label: "Trợ lý AI của bạn",
        href: soon("Trợ lý AI"),
        icon: "ai",
        permission: "exam.create",
      },
      {
        label: "Quản lý tài khoản",
        href: soon("Quản lý tài khoản"),
        icon: "account",
        permission: "user.manage",
      },
    ],
  },
  {
    title: "Tiện ích",
    items: [
      { label: "Mẹo", href: soon("Mẹo sử dụng"), icon: "tip" },
      {
        label: "Đề xuất tính năng",
        href: soon("Đề xuất tính năng"),
        icon: "feedback",
      },
    ],
  },
];

export const QUICK_LINKS: QuickLink[] = [
  {
    label: "Lớp học trực tuyến",
    description: "Tạo lớp học trực tuyến",
    href: soon("Lớp học trực tuyến"),
    icon: "live",
    permission: "class.create",
    badge: "Mới",
  },
  {
    label: "Tìm kiếm",
    description: "Tìm nội dung nhanh",
    href: soon("Tìm kiếm"),
    icon: "search",
  },
  {
    label: "Chuyển đổi số cho nhà trường",
    href: soon("Chuyển đổi số cho nhà trường"),
    icon: "school",
  },
  {
    label: "Kết nối trường học",
    description: "Mạng lưới cộng tác viên",
    href: soon("Kết nối trường học"),
    icon: "partner",
    highlight: true,
  },
];

/** Biểu tượng nhỏ cuối trang. */
export const FOOTER_LINKS: Feature[] = [
  { label: "Giới thiệu", href: "/gioi-thieu", icon: "info" },
  { label: "Thùng rác", href: soon("Thùng rác"), icon: "trash" },
  { label: "Trợ giúp", href: soon("Trợ giúp"), icon: "help" },
];

// ═══════════════════ SIDEBAR ═══════════════════

export const SIDEBAR_ITEMS: Feature[] = [
  HOME,
  ...DASHBOARD_SECTIONS[0].items,
  ...DASHBOARD_SECTIONS[1].items.filter(
    (f) => f.icon !== "ai" && f.icon !== "account",
  ),
];

export const SIDEBAR_BOTTOM: Feature = {
  label: "Cài đặt",
  href: soon("Cài đặt"),
  icon: "settings",
};

/** Nút phụ ở trang Bài tập. */
/** Soạn phiếu bài tập từ ngân hàng câu hỏi chung (mọi môn). */
export const WORKSHEET_HREF = "/bai-tap/phieu";

/** "Tạo đề từ ngân hàng chung": chọn khối / môn dạy → chọn sách → trang tạo phiếu. */
export const SHARED_BANK_HREF = "/de-thi/ngan-hang-chung";

export const FEEDBACK_HREF = soon("Đề xuất tính năng");
