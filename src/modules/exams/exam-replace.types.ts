/** Câu gợi ý cho "Đổi câu khác" — client-safe. */
export type ReplaceCandidate = {
  /** "q:<id>" câu trong đề của mình · "b:<id>" câu ngân hàng chung. */
  id: string;
  /** Lấy từ đâu (tên đề / sách). */
  source: string;
  content: string;
  options: string[];
  correctIndex: number;
  grade: number | null;
  subject: string | null;
};
