/** Số liệu cho trang chi tiết đề (thống kê, bảng xếp hạng). Hàm thuần — không truy vấn DB. */

export type ResultRow = {
  id: string;
  studentName: string;
  className: string;
  /** Điểm quy về thang 10. */
  score10: number;
  /** Thời gian làm bài (giây). */
  seconds: number;
  submittedAt: Date;
};

/** Xếp hạng: điểm cao trước, bằng điểm thì ai làm nhanh hơn đứng trước; bằng nhau hoàn toàn thì đồng hạng. */
export function rankRows(rows: ResultRow[]) {
  const sorted = [...rows].sort((a, b) => b.score10 - a.score10 || a.seconds - b.seconds);
  return sorted.map((r, i) => {
    let rank = i + 1;
    for (let j = i - 1; j >= 0 && sorted[j].score10 === r.score10 && sorted[j].seconds === r.seconds; j--) rank = j + 1;
    return { ...r, rank };
  });
}

/** Xếp loại theo thang 10 quen dùng ở trường phổ thông. */
export const SCORE_BANDS = [
  { label: "Giỏi", range: "8 – 10", min: 8 },
  { label: "Khá", range: "6,5 – dưới 8", min: 6.5 },
  { label: "Trung bình", range: "5 – dưới 6,5", min: 5 },
  { label: "Yếu", range: "3,5 – dưới 5", min: 3.5 },
  { label: "Kém", range: "dưới 3,5", min: -Infinity },
] as const;

export function scoreSummary(rows: ResultRow[]) {
  const scores = rows.map((r) => r.score10);
  const n = scores.length;
  const bands = SCORE_BANDS.map((b, i) => {
    const upper = i === 0 ? Infinity : SCORE_BANDS[i - 1].min;
    const count = scores.filter((s) => s >= b.min && s < upper).length;
    return { ...b, count, percent: n ? Math.round((count / n) * 1000) / 10 : 0 };
  });
  return {
    count: n,
    average: n ? Math.round((scores.reduce((a, b) => a + b, 0) / n) * 100) / 100 : null,
    max: n ? Math.max(...scores) : null,
    min: n ? Math.min(...scores) : null,
    passed: scores.filter((s) => s >= 5).length,
    bands,
  };
}

/** 754 → "12 phút 34 giây". */
export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return m ? `${m} phút ${s % 60} giây` : `${s} giây`;
}
