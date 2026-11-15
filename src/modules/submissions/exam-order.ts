/**
 * Thứ tự câu / đáp án khi học sinh làm bài (đảo đề). Hàm thuần, có test trong verify-grading.
 *
 * - Mỗi học sinh một thứ tự riêng nhưng CỐ ĐỊNH theo lượt làm (`seed` = id bài làm) → tải lại trang không đổi.
 * - Đảo câu: nhóm câu (lời dẫn / đoạn văn chung) luôn đi liền một khối; câu trong nhóm chỉ đảo khi nhóm
 *   không bật "Cố định câu hỏi trong nhóm".
 * - Đảo vị trí nhóm (`shuffleGroups`): đổi chỗ các khối (nhóm / câu đứng riêng). Tắt thì nhóm đứng yên,
 *   các câu đứng riêng liền nhau chỉ đảo với nhau tại chỗ.
 * - Đảo đáp án: bỏ qua câu bật "Cố định đáp án" (VD đáp án "Cả A và B đều đúng").
 * Chấm điểm theo id phương án nên thứ tự hiển thị không ảnh hưởng điểm.
 */

type Orderable<O> = {
  fixedOptions: boolean;
  group: { id: string; fixedOrder: boolean } | null;
  options: O[];
};

/** Bộ sinh số ngẫu nhiên có hạt giống (mulberry32) từ chuỗi (FNV-1a). */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], random: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function orderForTaking<O, Q extends Orderable<O>>(
  questions: Q[],
  seed: string,
  opts: { shuffleQuestions: boolean; shuffleOptions: boolean; shuffleGroups?: boolean },
): Q[] {
  const random = rng(seed);
  const moveGroups = opts.shuffleGroups ?? false;
  // Câu liền nhau cùng nhóm = 1 khối. Câu đứng riêng: 1 khối/câu khi đảo vị trí nhóm,
  // còn không thì các câu đứng riêng liền nhau gộp 1 khối để đảo tại chỗ.
  const blocks: Q[][] = [];
  for (const q of questions) {
    const last = blocks.at(-1);
    const sameGroup = last && q.group && last[0].group?.id === q.group.id;
    const sameRun = last && !moveGroups && !q.group && !last[0].group;
    if (sameGroup || sameRun) last.push(q);
    else blocks.push([q]);
  }
  const ordered = (moveGroups ? shuffle(blocks, random) : blocks).flatMap((b) =>
    opts.shuffleQuestions && !b[0].group?.fixedOrder ? shuffle(b, random) : b,
  );
  if (!opts.shuffleOptions) return ordered;
  return ordered.map((q) => (q.fixedOptions ? q : { ...q, options: shuffle(q.options, random) }));
}
