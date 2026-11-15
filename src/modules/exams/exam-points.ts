/**
 * Chia điểm cho các câu: câu có điểm nhập tay giữ nguyên, phần còn lại của tổng điểm chia đều
 * cho các câu chưa nhập (làm tròn 2 chữ số, câu cuối nhận phần lẻ để tổng khớp). Client-safe.
 */
export function distributePoints(
  count: number,
  manual: (number | null | undefined)[],
  total: number,
): { points: number[]; error: string | null } {
  const fixed = Array.from({ length: count }, (_, i) => {
    const v = manual[i];
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
  });
  const fixedSum = fixed.reduce<number>((s, v) => s + (v ?? 0), 0);
  const autoIdx = fixed.flatMap((v, i) => (v === null ? [i] : []));
  const points = fixed.map((v) => v ?? 0);

  if (autoIdx.length > 0) {
    const remain = Math.round((total - fixedSum) * 100) / 100;
    if (remain <= 0) {
      return { points, error: `Tổng điểm nhập tay (${round2(fixedSum)}) đã bằng hoặc vượt tổng điểm đề (${total}).` };
    }
    const each = Math.floor((remain / autoIdx.length) * 100) / 100;
    if (each <= 0) return { points, error: "Tổng điểm quá nhỏ so với số câu." };
    autoIdx.forEach((i) => (points[i] = each));
    points[autoIdx.at(-1)!] = round2(remain - each * (autoIdx.length - 1));
  }
  if (points.some((p) => p > 100)) return { points, error: "Mỗi câu tối đa 100 điểm." };
  return { points, error: null };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
