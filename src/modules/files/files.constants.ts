/**
 * Giới hạn file tải lên — dùng chung cho client (kiểm tra sớm) và server (kiểm tra thật).
 * File này KHÔNG import gì phía server để client import được.
 */

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
export const MAX_FILES_PER_HOMEWORK = 10;

/** Ảnh, PDF, Word, Excel, PowerPoint, âm thanh, video. */
export const ALLOWED_MIME_PREFIXES = ["image/", "audio/", "video/"];
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

/** Giá trị cho thuộc tính accept của <input type="file">. */
export const FILE_INPUT_ACCEPT = "image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx";

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME_TYPES.has(mime) || ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

/** 1536000 → "1,5 MB" */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value)} ${units[i]}`;
}

export type UploadedFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
};
