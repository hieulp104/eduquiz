/** Phân tích cấu trúc đề: tổng hợp số câu / điểm theo mức độ và theo nhóm. Hàm thuần — client dùng được, có test. */

export type DbLevel = "RECOGNITION" | "COMPREHENSION" | "APPLICATION";

export const LEVEL_OPTIONS: { value: DbLevel; short: string; label: string }[] = [
  { value: "RECOGNITION", short: "NB", label: "Nhận biết" },
  { value: "COMPREHENSION", short: "TH", label: "Thông hiểu" },
  { value: "APPLICATION", short: "VD", label: "Vận dụng" },
];

type Q = { points: number; level: DbLevel | null; groupId: string | null };

export type LevelRow = { key: DbLevel | "NONE"; label: string; count: number; points: number; percent: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Số câu, tổng điểm và tỉ lệ điểm theo từng mức độ (kèm dòng "Chưa gán mức độ" nếu có). */
export function summarizeLevels(questions: Q[]): { rows: LevelRow[]; count: number; points: number } {
  const total = questions.reduce((s, q) => s + q.points, 0);
  const row = (key: LevelRow["key"], label: string): LevelRow => {
    const list = questions.filter((q) => (q.level ?? "NONE") === key);
    const points = list.reduce((s, q) => s + q.points, 0);
    return { key, label, count: list.length, points: round2(points), percent: total ? Math.round((points / total) * 1000) / 10 : 0 };
  };
  const rows = LEVEL_OPTIONS.map((l) => row(l.value, l.label));
  const none = row("NONE", "Chưa gán mức độ");
  if (none.count > 0) rows.push(none);
  return { rows, count: questions.length, points: round2(total) };
}

export type GroupRow = { key: string; label: string; from: number; to: number; count: number; points: number; levels: Record<DbLevel | "NONE", number> };

/** Từng khối liền nhau của đề (nhóm câu / các câu đứng riêng liền nhau): khoảng câu, số câu, điểm, số câu mỗi mức. */
export function summarizeGroups(questions: Q[]): GroupRow[] {
  const rows: GroupRow[] = [];
  let groupNo = 0;
  questions.forEach((q, i) => {
    const last = rows.at(-1);
    const key = q.groupId ?? "loose";
    if (!last || last.key !== key) {
      if (q.groupId) groupNo++;
      rows.push({
        key,
        label: q.groupId ? `Nhóm ${groupNo}` : "Câu đứng riêng",
        from: i + 1,
        to: i + 1,
        count: 0,
        points: 0,
        levels: { RECOGNITION: 0, COMPREHENSION: 0, APPLICATION: 0, NONE: 0 },
      });
    }
    const cur = rows.at(-1)!;
    cur.to = i + 1;
    cur.count++;
    cur.points = round2(cur.points + q.points);
    cur.levels[q.level ?? "NONE"]++;
  });
  return rows;
}
