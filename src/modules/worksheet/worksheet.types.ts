/** Kiểu dữ liệu dùng chung server ↔ client cho trang Tạo phiếu bài tập. Không import gì phía server. */

export type BankTreeNode = {
  id: string;
  title: string;
  /** Tổng số câu trong cả nhánh. */
  count: number;
  children: BankTreeNode[];
};

export type BankBook = {
  id: string;
  grade: number;
  subject: string;
  title: string;
};

export type WorksheetQuestion = {
  id: string;
  /** Dạng câu hỏi (nút lá) chứa câu — "Đổi câu khác" bốc lại trong đúng dạng này. */
  nodeId: string;
  type: "MCQ" | "FILL";
  content: string;
  options: string[];
  correctIndex: number;
};

export type WorksheetSettings = {
  /** Kèm bảng đáp án cuối file docx. */
  includeAnswerKey: boolean;
  /** Dòng "Họ và tên / Lớp" đầu phiếu. */
  includeStudentInfo: boolean;
  /** Thời gian làm bài khi tạo đề thi online từ phiếu. */
  examMinutes: number;
};

export const DEFAULT_WORKSHEET_SETTINGS: WorksheetSettings = {
  includeAnswerKey: true,
  includeStudentInfo: true,
  examMinutes: 45,
};

export const MAX_WORKSHEET_QUESTIONS = 100;
