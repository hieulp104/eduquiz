/** Bản nháp đề chuyển từ trang "Tạo đề mới" (đọc file) sang trình soạn đề qua sessionStorage. Client-safe. */

export const EXAM_DRAFT_KEY = "eduquiz:exam-draft";

export type ExamDraftPayload = {
  /** Tên file — gợi ý tên đề. */
  title: string;
  /** Văn bản đề theo định dạng exam-text.ts. */
  text: string;
  /** Lưu ý khi đọc file (công thức, hình ảnh, câu bị bỏ qua…). */
  warnings: string[];
  /** Điểm từng câu nếu file có ghi (Excel), theo thứ tự câu. */
  points?: (number | null)[];
};
