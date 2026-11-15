/**
 * Kiểu, nhãn và luật hiển thị của "Cài đặt làm bài online" — KHÔNG import gì phía server
 * để component client dùng được. Hàm thuần, có test trong verify-publish.
 */

export type ExamMode = "EXAM" | "PRACTICE";
export type ExamAudience = "ALL" | "CLASSES" | "STUDENTS";
export type RevealMode = "NEVER" | "AFTER_SUBMIT" | "AFTER_CLOSE" | "MIN_SCORE";
export type PriceMode = "FREE" | "PAID_ENTRY" | "PAID_EXPLANATION";

export const PRICE_MODE_LABEL: Record<PriceMode, string> = {
  FREE: "Miễn phí",
  PAID_ENTRY: "Thu phí khi tham gia thi",
  PAID_EXPLANATION: "Thu phí khi xem giải thích",
};

export const AUDIENCE_LABEL: Record<ExamAudience, string> = {
  ALL: "Tất cả mọi người",
  CLASSES: "Giao theo lớp",
  STUDENTS: "Giao theo học sinh",
};

/** Tên hiển thị cho bài giao không gắn lớp. */
export const OPEN_AUDIENCE_NAME = "Link chung";

export function formatPrice(vnd: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(vnd)} đ`;
}

/** Giá trị form của trang cài đặt (ngày giờ là chuỗi datetime-local theo giờ VN, "" = bỏ trống). */
export type OnlineSettingsValue = {
  title: string;
  grade: number | null;
  subject: string | null;
  purpose: string | null;
  durationMinutes: number;
  mode: ExamMode;
  openAt: string;
  dueAt: string;
  audience: ExamAudience;
  classIds: string[];
  studentIds: string[];
  labMode: boolean;
  maxAttempts: number;
  password: string;
  monitorLeave: boolean;
  shuffle: boolean;
  shuffleGroups: boolean;
  hideGroupTitles: boolean;
  showScore: RevealMode;
  showAnswers: RevealMode;
  minScoreForAnswers: number | null;
  hideWrongAnswers: boolean;
  retryWrong: boolean;
  headerNote: string;
  preNotice: string;
  priceMode: PriceMode;
  price: number;
  priceNote: string;
};

/** Phần cấu hình ảnh hưởng tới lúc làm bài / xem kết quả. */
export type TakeSettings = {
  mode: ExamMode;
  /** 0 = không giới hạn. */
  maxAttempts: number;
  password: string | null;
  monitorLeave: boolean;
  labMode: boolean;
  hideGroupTitles: boolean;
  showScore: RevealMode;
  showAnswers: RevealMode;
  minScoreForAnswers: number | null;
  hideWrongAnswers: boolean;
  retryWrong: boolean;
  headerNote: string;
  preNotice: string;
};

type ConfigLike = Omit<TakeSettings, "password"> & { password: string | null; publishedAt: Date | null };

/**
 * Cấu hình áp dụng cho 1 bài giao. Đề đã xuất bản thì theo cấu hình online;
 * bài giao kiểu cũ (từ trang lớp, chưa có cấu hình) → 1 lượt, xem điểm ngay, đáp án theo `showAnswer`.
 * Luyện tập: luôn không giới hạn lượt, không mật khẩu, xem điểm + đáp án ngay.
 */
export function takeSettings(assignment: { showAnswer: boolean }, config: ConfigLike | null | undefined): TakeSettings {
  if (!config || !config.publishedAt) {
    return {
      mode: "EXAM",
      maxAttempts: 1,
      password: null,
      monitorLeave: false,
      labMode: false,
      hideGroupTitles: false,
      showScore: "AFTER_SUBMIT",
      showAnswers: assignment.showAnswer ? "AFTER_SUBMIT" : "NEVER",
      minScoreForAnswers: null,
      hideWrongAnswers: false,
      retryWrong: false,
      headerNote: "",
      preNotice: "",
    };
  }
  const base: TakeSettings = {
    mode: config.mode,
    maxAttempts: config.maxAttempts,
    password: config.password || null,
    monitorLeave: config.monitorLeave,
    labMode: config.labMode,
    hideGroupTitles: config.hideGroupTitles,
    showScore: config.showScore,
    showAnswers: config.showAnswers,
    minScoreForAnswers: config.minScoreForAnswers,
    hideWrongAnswers: config.hideWrongAnswers,
    retryWrong: config.retryWrong,
    headerNote: config.headerNote,
    preNotice: config.preNotice,
  };
  if (config.mode !== "PRACTICE") return { ...base, retryWrong: false };
  return {
    ...base,
    maxAttempts: 0,
    password: null,
    monitorLeave: false,
    showScore: "AFTER_SUBMIT",
    showAnswers: "AFTER_SUBMIT",
    minScoreForAnswers: null,
    hideWrongAnswers: false,
  };
}

/** Còn được làm thêm lượt nữa không (đã nộp `submitted` lượt). */
export function attemptsLeft(maxAttempts: number, submitted: number): number {
  return maxAttempts === 0 ? Infinity : Math.max(0, maxAttempts - submitted);
}

type RevealContext = { dueAt: Date | null; now?: Date; score10: number };

const closed = (ctx: RevealContext) => Boolean(ctx.dueAt && (ctx.now ?? new Date()) > ctx.dueAt);

export function canSeeScore(s: Pick<TakeSettings, "showScore">, ctx: RevealContext): boolean {
  if (s.showScore === "NEVER") return false;
  if (s.showScore === "AFTER_CLOSE") return closed(ctx);
  return true;
}

export function canSeeAnswers(s: Pick<TakeSettings, "showAnswers" | "minScoreForAnswers">, ctx: RevealContext): boolean {
  switch (s.showAnswers) {
    case "NEVER":
      return false;
    case "AFTER_CLOSE":
      return closed(ctx);
    case "MIN_SCORE":
      return ctx.score10 >= (s.minScoreForAnswers ?? 0);
    default:
      return true;
  }
}

/** Lý do chưa xem được — để báo cho học sinh. */
export function revealHint(mode: RevealMode, what: "điểm" | "đề và đáp án", minScore: number | null): string {
  if (mode === "AFTER_CLOSE") return `Bạn sẽ xem được ${what} sau khi hết thời gian giao đề.`;
  if (mode === "MIN_SCORE") return `Bạn sẽ xem được ${what} khi đạt từ ${minScore ?? 0} điểm trở lên.`;
  return `Giáo viên không cho xem ${what} của bài này.`;
}
