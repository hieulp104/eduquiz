/** Kiểu + nhãn cho thư viện đề — KHÔNG import gì phía server để component client dùng được. */

export type ExamStatus = "DRAFT" | "OPEN" | "CLOSED";

export const EXAM_STATUS_LABEL: Record<ExamStatus, string> = {
  DRAFT: "Chưa giao",
  OPEN: "Đang mở",
  CLOSED: "Đã đóng",
};

export type LibrarySort = "name" | "submitted" | "status" | "assignedAt";
export type SortDir = "asc" | "desc";

export const LIBRARY_SORTS: LibrarySort[] = ["name", "submitted", "status", "assignedAt"];

export type LibraryExam = {
  id: string;
  title: string;
  durationMinutes: number;
  questionCount: number;
  submittedCount: number;
  status: ExamStatus;
  classNames: string[];
  /** Lần giao gần nhất. */
  assignedAt: Date | null;
  createdAt: Date;
};

export type LibraryFolder = { id: string; name: string; itemCount: number; createdAt: Date };
