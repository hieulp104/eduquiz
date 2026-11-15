/**
 * Ngân hàng câu hỏi mẫu: Toán 1 — Kết nối tri thức.
 *
 * Cây chủ đề / bài lấy theo mục lục SGK (chương trình công khai). Câu hỏi do EduQuiz tự
 * sinh (phép tính, so sánh, đọc số...) hoặc tự soạn (hình học, thời gian) — không lấy từ
 * nguồn nào khác. RNG có seed cố định nên chạy seed lại vẫn ra đúng bộ câu cũ.
 */

export type GenQuestion = {
  type: "MCQ" | "FILL";
  content: string;
  options: string[];
  correctIndex: number;
};

type Generator = (r: Rng) => GenQuestion;
type Lesson = { title: string; mcq?: Generator[]; fill?: Generator[] };
type Topic = { title: string; lessons: Lesson[] };

// ═══════════════════ TIỆN ÍCH ═══════════════════

export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  /** mulberry32 */
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number) {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

/** Trắc nghiệm: đáp án đúng + nhiễu (tự bỏ trùng), xáo thứ tự. */
function mcq(r: Rng, content: string, correct: string | number, wrong: (string | number)[]): GenQuestion {
  const c = String(correct);
  const distract = [...new Set(wrong.map(String))].filter((w) => w !== c).slice(0, 3);
  const options = r.shuffle([c, ...distract]);
  return { type: "MCQ", content, options, correctIndex: options.indexOf(c) };
}

/** Điền chỗ trống: vẫn lưu 3–4 phương án để đổi được sang trắc nghiệm online. */
function fill(r: Rng, content: string, correct: string | number, wrong: (string | number)[]): GenQuestion {
  return { ...mcq(r, content, correct, wrong), type: "FILL" };
}

/** Nhiễu quanh một số: ±1, ±2 (không âm). */
const near = (n: number, max = 100) =>
  [n - 1, n + 1, n + 2, n - 2, n + 10].filter((x) => x >= 0 && x <= max && x !== n);

const ONES = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

/** Đọc số 0–100 theo tiếng Việt: 21 → "hai mươi mốt", 15 → "mười lăm", 24 → "hai mươi tư". */
export function readNumber(n: number): string {
  if (n < 10) return ONES[n];
  if (n === 100) return "một trăm";
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  const head = tens === 1 ? "mười" : `${ONES[tens]} mươi`;
  if (ones === 0) return head;
  if (ones === 5) return `${head} lăm`;
  if (ones === 1 && tens > 1) return `${head} mốt`;
  if (ones === 4 && tens > 1) return `${head} tư`;
  return `${head} ${ONES[ones]}`;
}

const SIGN = (a: number, b: number) => (a > b ? ">" : a < b ? "<" : "=");
const SIGNS = [">", "<", "="];
const THINGS = ["quả cam", "quả táo", "cái kẹo", "bông hoa", "quyển vở", "con gà", "chiếc bút", "viên bi"];
const NAMES = ["Lan", "Minh", "An", "Hoa", "Nam", "Mai", "Bình", "Linh"];

// ═══════════════════ BỘ SINH THEO DẠNG ═══════════════════

const g = {
  successor: (lo: number, hi: number): Generator => (r) => {
    const a = r.int(lo, hi - 1);
    return mcq(r, `Số liền sau của ${a} là:`, a + 1, near(a + 1));
  },
  predecessor: (lo: number, hi: number): Generator => (r) => {
    const a = r.int(lo + 1, hi);
    return fill(r, `Số liền trước của ${a} là: ......`, a - 1, near(a - 1));
  },
  sequenceGap: (lo: number, hi: number): Generator => (r) => {
    const start = r.int(lo, hi - 4);
    const seq = [start, start + 1, start + 2, start + 3, start + 4];
    const gap = r.int(1, 3);
    const shown = seq.map((x, i) => (i === gap ? "......" : x)).join(", ");
    return fill(r, `Điền số thích hợp vào chỗ trống: ${shown}`, seq[gap], near(seq[gap]));
  },
  largest: (lo: number, hi: number): Generator => (r) => {
    const set = new Set<number>();
    while (set.size < 4) set.add(r.int(lo, hi));
    const list = r.shuffle([...set]);
    const max = Math.max(...list);
    return mcq(r, `Trong các số ${list.join(", ")}, số lớn nhất là:`, max, list.filter((x) => x !== max));
  },
  smallest: (lo: number, hi: number): Generator => (r) => {
    const set = new Set<number>();
    while (set.size < 4) set.add(r.int(lo, hi));
    const list = r.shuffle([...set]);
    const min = Math.min(...list);
    return mcq(r, `Trong các số ${list.join(", ")}, số bé nhất là:`, min, list.filter((x) => x !== min));
  },
  readNum: (lo: number, hi: number): Generator => (r) => {
    const n = r.int(lo, hi);
    return mcq(r, `Số ${n} đọc là:`, readNumber(n), near(n).map(readNumber));
  },
  writeNum: (lo: number, hi: number): Generator => (r) => {
    const n = r.int(lo, hi);
    return fill(r, `Số “${readNumber(n)}” viết là: ......`, n, near(n));
  },
  moreLess: (): Generator => (r) => {
    const [x, y] = r.shuffle([...THINGS]).slice(0, 2);
    const a = r.int(1, 9);
    const b = r.int(1, 9);
    const ans = a > b ? x : a < b ? y : "Bằng nhau";
    return mcq(r, `Có ${a} ${x} và ${b} ${y}. Loại nào nhiều hơn?`, ans, [x, y, "Bằng nhau"]);
  },
  compareSign: (lo: number, hi: number, asFill = false): Generator => (r) => {
    const a = r.int(lo, hi);
    const b = r.next() < 0.2 ? a : r.int(lo, hi);
    const content = asFill
      ? `Điền dấu >, <, = vào chỗ trống: ${a} ...... ${b}`
      : `Dấu thích hợp điền vào chỗ trống ${a} ...... ${b} là:`;
    return (asFill ? fill : mcq)(r, content, SIGN(a, b), SIGNS);
  },
  decompose: (lo: number, hi: number): Generator => (r) => {
    const n = r.int(lo, hi);
    const a = r.int(0, n);
    return fill(r, `${n} gồm ${a} và ......`, n - a, near(n - a, 10));
  },
  add: (maxSum: number, asFill = false): Generator => (r) => {
    const a = r.int(0, maxSum);
    const b = r.int(0, maxSum - a);
    if (asFill) return fill(r, `${a} + ...... = ${a + b}`, b, near(b, maxSum));
    return mcq(r, `${a} + ${b} = ?`, a + b, near(a + b, maxSum + 2));
  },
  sub: (max: number, asFill = false): Generator => (r) => {
    const a = r.int(0, max);
    const b = r.int(0, a);
    if (asFill) return fill(r, `${a} - ...... = ${a - b}`, b, near(b, max));
    return mcq(r, `${a} - ${b} = ?`, a - b, near(a - b, max));
  },
  wordAdd: (maxSum: number): Generator => (r) => {
    const a = r.int(1, maxSum - 1);
    const b = r.int(1, maxSum - a);
    const who = r.pick(NAMES);
    const thing = r.pick(THINGS);
    return mcq(
      r,
      `${who} có ${a} ${thing}, mẹ cho thêm ${b} ${thing}. Hỏi ${who} có tất cả bao nhiêu ${thing}?`,
      a + b,
      near(a + b, maxSum + 2),
    );
  },
  wordSub: (max: number): Generator => (r) => {
    const a = r.int(2, max);
    const b = r.int(1, a - 1);
    const who = r.pick(NAMES);
    const thing = r.pick(THINGS);
    return mcq(r, `${who} có ${a} ${thing}, ${who} cho bạn ${b} ${thing}. Hỏi ${who} còn lại bao nhiêu ${thing}?`, a - b, near(a - b, max));
  },
  tensOnes: (): Generator => (r) => {
    const t = r.int(1, 9);
    const o = r.int(0, 9);
    return mcq(r, `Số gồm ${t} chục và ${o} đơn vị là:`, t * 10 + o, [o * 10 + t, t * 10 + o + 1, t + o].filter((x) => x !== t * 10 + o));
  },
  tensOf: (): Generator => (r) => {
    const n = r.int(11, 99);
    return fill(r, `Số ${n} gồm ...... chục và ${n % 10} đơn vị.`, Math.floor(n / 10), near(Math.floor(n / 10), 9));
  },
  /** Cộng/trừ không nhớ trong phạm vi 100. kind: 21 = hai chữ số + một chữ số, 22 = hai + hai. */
  add100: (kind: 21 | 22, asFill = false): Generator => (r) => {
    const t1 = r.int(1, 8);
    const o1 = r.int(0, 8);
    const o2 = r.int(0, 9 - o1);
    const t2 = kind === 22 ? r.int(1, 9 - t1) : 0;
    const a = t1 * 10 + o1;
    const b = t2 * 10 + o2;
    if (asFill) return fill(r, `${a} + ${b} = ......`, a + b, near(a + b));
    return mcq(r, `${a} + ${b} = ?`, a + b, [a + b + 10, a + b - 1, a + b + 1]);
  },
  sub100: (kind: 21 | 22, asFill = false): Generator => (r) => {
    const t1 = r.int(kind === 22 ? 2 : 1, 9);
    const o1 = r.int(0, 9);
    const o2 = r.int(0, o1);
    const t2 = kind === 22 ? r.int(1, t1) : 0;
    const a = t1 * 10 + o1;
    const b = t2 * 10 + o2;
    if (asFill) return fill(r, `${a} - ${b} = ......`, a - b, near(a - b));
    return mcq(r, `${a} - ${b} = ?`, a - b, [a - b + 10, a - b - 1, a - b + 1].filter((x) => x >= 0));
  },
  longer: (): Generator => (r) => {
    const items = r.shuffle(["bút chì", "thước kẻ", "cục tẩy", "quyển vở", "cái kéo"]).slice(0, 2);
    const a = r.int(3, 30);
    let b = r.int(3, 30);
    if (b === a) b = a + 2;
    return mcq(r, `${items[0]} dài ${a} cm, ${items[1]} dài ${b} cm. Đồ vật nào dài hơn?`, a > b ? items[0] : items[1], [items[0], items[1], "Dài bằng nhau"]);
  },
  addCm: (): Generator => (r) => {
    const a = r.int(1, 50);
    const b = r.int(1, 99 - a);
    return mcq(r, `${a} cm + ${b} cm = ?`, `${a + b} cm`, [`${a + b + 1} cm`, `${a + b - 1} cm`, `${a + b}`]);
  },
  clock: (): Generator => (r) => {
    const h = r.int(1, 12);
    return mcq(r, `Kim ngắn chỉ số ${h}, kim dài chỉ số 12. Đồng hồ chỉ mấy giờ?`, `${h} giờ`, near(h, 12).filter((x) => x > 0).map((x) => `${x} giờ`));
  },
  nextDay: (): Generator => (r) => {
    const days = ["thứ Hai", "thứ Ba", "thứ Tư", "thứ Năm", "thứ Sáu", "thứ Bảy", "Chủ nhật"];
    const i = r.int(0, 6);
    const forward = r.next() < 0.5;
    const ans = days[(i + (forward ? 1 : 6)) % 7];
    return mcq(r, `Hôm nay là ${days[i]}. ${forward ? "Ngày mai" : "Hôm qua"} là:`, ans, days.filter((d) => d !== ans && d !== days[i]).slice(0, 3));
  },
};

/** Câu soạn sẵn — chọn ngẫu nhiên từ danh sách, xáo đáp án. */
const fixed =
  (items: [string, string, string[]][]): Generator =>
  (r) => {
    const [content, correct, wrong] = r.pick(items);
    return mcq(r, content, correct, wrong);
  };

const SHAPES = ["Hình tròn", "Hình vuông", "Hình tam giác", "Hình chữ nhật"];
const shapes2D = fixed([
  ["Hình có 3 cạnh là:", "Hình tam giác", SHAPES],
  ["Hình nào không có cạnh?", "Hình tròn", SHAPES],
  ["Hình vuông có mấy cạnh?", "4", ["3", "5", "2"]],
  ["Hình tam giác có mấy cạnh?", "3", ["4", "2", "5"]],
  ["Mặt đồng hồ treo tường thường có dạng hình gì?", "Hình tròn", SHAPES],
  ["Lá cờ Tổ quốc có dạng hình gì?", "Hình chữ nhật", SHAPES],
  ["Viên gạch lát nền thường có dạng hình gì?", "Hình vuông", SHAPES],
  ["Biển báo “Đường giao nhau” có dạng hình gì?", "Hình tam giác", SHAPES],
  ["Hình có 4 cạnh bằng nhau là:", "Hình vuông", SHAPES],
]);
const SOLIDS = ["Khối lập phương", "Khối hộp chữ nhật", "Khối cầu", "Khối trụ"];
const shapes3D = fixed([
  ["Con xúc xắc có dạng khối gì?", "Khối lập phương", SOLIDS],
  ["Hộp sữa giấy có dạng khối gì?", "Khối hộp chữ nhật", SOLIDS],
  ["Bao diêm có dạng khối gì?", "Khối hộp chữ nhật", SOLIDS],
  ["Khối rubik có dạng khối gì?", "Khối lập phương", SOLIDS],
  ["Viên phấn có dạng khối gì?", "Khối trụ", SOLIDS],
  ["Quả bóng có dạng khối gì?", "Khối cầu", SOLIDS],
]);
const POS = ["Ở trên", "Ở dưới", "Bên trái", "Bên phải"];
const positions = fixed([
  ["“Quyển sách nằm trên mặt bàn.” Quyển sách ở vị trí nào so với cái bàn?", "Ở trên", POS],
  ["“Con mèo nằm dưới gầm ghế.” Con mèo ở vị trí nào so với cái ghế?", "Ở dưới", POS],
  ["Em giơ tay cầm bút để viết. Đa số các bạn cầm bút bằng tay nào?", "Tay phải", ["Tay trái", "Cả hai tay"]],
  ["“Cái cây đứng trước ngôi nhà.” Ngôi nhà ở vị trí nào so với cái cây?", "Phía sau", ["Phía trước", "Ở trên", "Ở dưới"]],
]);
const units = fixed([
  ["Đơn vị đo độ dài xăng-ti-mét viết tắt là:", "cm", ["m", "kg", "l"]],
  ["Để đo chiều dài quyển vở, em dùng dụng cụ nào?", "Thước kẻ", ["Cân", "Đồng hồ", "Bình nước"]],
]);
const week = fixed([
  ["Một tuần lễ có mấy ngày?", "7", ["5", "6", "8"]],
  ["Trong một tuần, ngày nào thường được nghỉ học?", "Chủ nhật", ["Thứ Hai", "Thứ Tư", "Thứ Năm"]],
]);

const range10 = (lo: number, hi: number) => ({
  mcq: [g.successor(lo, hi), g.largest(lo, hi), g.smallest(lo, hi), g.readNum(lo, hi)],
  fill: [g.predecessor(lo, hi), g.sequenceGap(lo, hi), g.writeNum(lo, hi)],
});
const addSub10 = {
  mcq: [g.add(10), g.sub(10), g.wordAdd(10), g.wordSub(10)],
  fill: [g.add(10, true), g.sub(10, true)],
};
const numbers100 = {
  mcq: [g.tensOnes(), g.readNum(10, 99), g.compareSign(10, 99), g.largest(10, 99)],
  fill: [g.tensOf(), g.writeNum(10, 99), g.compareSign(10, 99, true), g.predecessor(10, 99)],
};
const ops100 = {
  mcq: [g.add100(21), g.add100(22), g.sub100(21), g.sub100(22)],
  fill: [g.add100(22, true), g.sub100(22, true)],
};

// ═══════════════════ CÂY KIẾN THỨC ═══════════════════

export const TOAN1_KNTT: { key: string; grade: number; subject: string; title: string; topics: Topic[] } = {
  key: "toan1-kntt",
  grade: 1,
  subject: "Toán",
  title: "Toán 1 - Kết nối tri thức",
  topics: [
    {
      title: "CÁC SỐ TỪ 0 ĐẾN 10",
      lessons: [
        { title: "Bài 1: Các số 0, 1, 2, 3, 4, 5", ...range10(0, 5) },
        { title: "Bài 2: Các số 6, 7, 8, 9, 10", ...range10(6, 10) },
        { title: "Bài 3: Nhiều hơn, ít hơn, bằng nhau", mcq: [g.moreLess()] },
        { title: "Bài 4: So sánh số", mcq: [g.compareSign(0, 10)], fill: [g.compareSign(0, 10, true)] },
        { title: "Bài 5: Mấy và mấy", fill: [g.decompose(2, 10)] },
        { title: "Bài 6: Luyện tập chung", mcq: [...range10(0, 10).mcq, g.compareSign(0, 10)], fill: [g.decompose(2, 10), g.sequenceGap(0, 10)] },
      ],
    },
    {
      title: "LÀM QUEN VỚI MỘT SỐ HÌNH PHẲNG",
      lessons: [
        { title: "Bài 7: Hình vuông, hình tròn, hình tam giác, hình chữ nhật", mcq: [shapes2D] },
        { title: "Bài 8: Thực hành lắp ghép, xếp hình" },
        { title: "Bài 9: Luyện tập chung", mcq: [shapes2D] },
      ],
    },
    {
      title: "PHÉP CỘNG, PHÉP TRỪ TRONG PHẠM VI 10",
      lessons: [
        { title: "Bài 10: Phép cộng trong phạm vi 10", mcq: [g.add(10), g.wordAdd(10)], fill: [g.add(10, true)] },
        { title: "Bài 11: Phép trừ trong phạm vi 10", mcq: [g.sub(10), g.wordSub(10)], fill: [g.sub(10, true)] },
        { title: "Bài 12: Bảng cộng, bảng trừ trong phạm vi 10", ...addSub10 },
        { title: "Bài 13: Luyện tập chung", ...addSub10 },
      ],
    },
    {
      title: "LÀM QUEN VỚI MỘT SỐ HÌNH KHỐI",
      lessons: [
        { title: "Bài 14: Khối lập phương, khối hộp chữ nhật", mcq: [shapes3D] },
        { title: "Bài 15: Vị trí, định hướng trong không gian", mcq: [positions] },
        { title: "Bài 16: Luyện tập chung", mcq: [shapes3D, positions] },
      ],
    },
    {
      title: "ÔN TẬP HỌC KÌ 1",
      lessons: [
        { title: "Bài 17: Ôn tập các số trong phạm vi 10", ...range10(0, 10) },
        { title: "Bài 18: Ôn tập phép cộng, phép trừ trong phạm vi 10", ...addSub10 },
        { title: "Bài 19: Ôn tập hình học", mcq: [shapes2D, shapes3D] },
        { title: "Bài 20: Ôn tập chung", mcq: [...addSub10.mcq, g.compareSign(0, 10), shapes2D], fill: addSub10.fill },
      ],
    },
    {
      title: "CÁC SỐ ĐẾN 100",
      lessons: [
        { title: "Bài 21: Số có hai chữ số", mcq: [g.tensOnes(), g.readNum(10, 99)], fill: [g.tensOf(), g.writeNum(10, 99)] },
        { title: "Bài 22: So sánh số có hai chữ số", mcq: [g.compareSign(10, 99), g.largest(10, 99), g.smallest(10, 99)], fill: [g.compareSign(10, 99, true)] },
        { title: "Bài 23: Bảng các số từ 1 đến 100", mcq: [g.successor(1, 100)], fill: [g.predecessor(1, 100), g.sequenceGap(1, 100)] },
        { title: "Bài 24: Luyện tập chung", ...numbers100 },
      ],
    },
    {
      title: "ĐỘ DÀI VÀ ĐO ĐỘ DÀI",
      lessons: [
        { title: "Bài 25: Dài hơn, ngắn hơn", mcq: [g.longer()] },
        { title: "Bài 26: Đơn vị đo độ dài", mcq: [units, g.addCm()] },
        { title: "Bài 27: Thực hành ước lượng và đo độ dài" },
        { title: "Bài 28: Luyện tập chung", mcq: [g.longer(), g.addCm(), units] },
      ],
    },
    {
      title: "PHÉP CỘNG, PHÉP TRỪ (không nhớ) TRONG PHẠM VI 100",
      lessons: [
        { title: "Bài 29: Phép cộng số có hai chữ số với số có một chữ số", mcq: [g.add100(21)], fill: [g.add100(21, true)] },
        { title: "Bài 30: Phép cộng số có hai chữ số với số có hai chữ số", mcq: [g.add100(22)], fill: [g.add100(22, true)] },
        { title: "Bài 31: Phép trừ số có hai chữ số cho số có một chữ số", mcq: [g.sub100(21)], fill: [g.sub100(21, true)] },
        { title: "Bài 32: Phép trừ số có hai chữ số cho số có hai chữ số", mcq: [g.sub100(22)], fill: [g.sub100(22, true)] },
        { title: "Bài 33: Luyện tập chung", ...ops100 },
      ],
    },
    {
      title: "THỜI GIAN. GIỜ VÀ LỊCH",
      lessons: [
        { title: "Bài 34: Xem giờ đúng trên đồng hồ", mcq: [g.clock()] },
        { title: "Bài 35: Các ngày trong tuần", mcq: [g.nextDay(), week] },
        { title: "Bài 36: Thực hành xem lịch và giờ" },
        { title: "Bài 37: Luyện tập chung", mcq: [g.clock(), g.nextDay(), week] },
      ],
    },
    {
      title: "ÔN TẬP CUỐI NĂM",
      lessons: [
        { title: "Bài 38: Ôn tập các số và phép tính trong phạm vi 10", mcq: [...range10(0, 10).mcq, ...addSub10.mcq], fill: addSub10.fill },
        { title: "Bài 39: Ôn tập các số và phép tính trong phạm vi 100", mcq: [...numbers100.mcq, ...ops100.mcq], fill: ops100.fill },
        { title: "Bài 40: Ôn tập hình học và đo lường", mcq: [shapes2D, shapes3D, g.longer(), g.clock()] },
        { title: "Bài 41: Ôn tập chung", mcq: [...addSub10.mcq, ...ops100.mcq, shapes2D, g.clock()], fill: [...addSub10.fill, ...ops100.fill] },
      ],
    },
  ],
};

/** Sinh tối đa `count` câu KHÔNG TRÙNG nội dung từ danh sách bộ sinh. */
export function generateQuestions(gens: Generator[], count: number, seed: number): GenQuestion[] {
  const r = new Rng(seed);
  const seen = new Set<string>();
  const out: GenQuestion[] = [];
  for (let attempt = 0; attempt < count * 20 && out.length < count; attempt++) {
    const q = gens[attempt % gens.length](r);
    if (seen.has(q.content) || q.options.length < 2) continue;
    seen.add(q.content);
    out.push(q);
  }
  return out;
}
