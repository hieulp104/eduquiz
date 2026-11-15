/** Kho nội dung — kiểu, nhãn, đường dẫn. Client-safe (không import gì phía server). */
import type { ContentKind } from "@/generated/prisma/enums";

export type { ContentKind };

export const CONTENT_KINDS: ContentKind[] = ["EXAM", "REFERENCE", "VIDEO", "SLIDE", "LESSON_PLAN"];

/** Nhãn mục (trang kho) + nhãn ngắn (thẻ). */
export const CONTENT_KIND_LABEL: Record<ContentKind, { section: string; short: string }> = {
  EXAM: { section: "Đề thi", short: "Đề thi" },
  REFERENCE: { section: "Tài liệu tham khảo", short: "Tài liệu" },
  VIDEO: { section: "Bài giảng video", short: "Video" },
  SLIDE: { section: "Slide PowerPoint", short: "Slide" },
  LESSON_PLAN: { section: "Kế hoạch bài giảng", short: "Kế hoạch" },
};

/** Loại dùng file tải lên. */
export const FILE_KINDS = new Set<ContentKind>(["REFERENCE", "SLIDE", "LESSON_PLAN"]);

/** `?loai=` trên URL ↔ loại. "moi-nhat" / "cua-toi" là bộ lọc riêng. */
export const KIND_SLUG: Record<ContentKind, string> = {
  EXAM: "de-thi",
  REFERENCE: "tham-khao",
  VIDEO: "video",
  SLIDE: "slide",
  LESSON_PLAN: "ke-hoach",
};
export const kindFromSlug = (slug: string | undefined) =>
  (Object.entries(KIND_SLUG).find(([, s]) => s === slug)?.[0] as ContentKind | undefined) ?? null;

export const CONTENT_PATH = "/kho-noi-dung";

/** Đuôi file nhận cho từng loại (input accept). */
export const FILE_ACCEPT: Record<string, string> = {
  REFERENCE: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*",
  SLIDE: ".ppt,.pptx,.pdf",
  LESSON_PLAN: ".pdf,.doc,.docx",
};

export type ContentCard = {
  id: string;
  kind: ContentKind;
  title: string;
  grade: number | null;
  subject: string | null;
  ownerName: string;
  downloadCount: number;
  viewCount: number;
  /** Tên file (loại file) / tên miền (video). */
  extra: string | null;
  createdAt: string;
};

/** "https://www.youtube.com/watch?v=…" → "youtube.com". */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Đề của giáo viên để chọn khi đóng góp. sharedId ≠ null = đã có trên kho. */
export type ShareableExam = {
  id: string;
  title: string;
  grade: number | null;
  subject: string | null;
  description: string | null;
  questionCount: number;
  sharedId: string | null;
};
