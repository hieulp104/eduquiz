/**
 * Nhãn tiếng Việt cho trạng thái hiển thị trên UI.
 * Nhãn vai trò nằm ở common/permissions (ROLE_LABEL).
 */

import type { HomeworkPurpose } from "@/generated/prisma/enums";

export const HOMEWORK_PURPOSE_LABEL: Record<HomeworkPurpose, string> = {
  HOMEWORK: "Bài tập về nhà",
  PRACTICE: "Luyện tập trên lớp",
  REVIEW: "Ôn tập",
  QUIZ_15: "Kiểm tra 15 phút",
  TEST_45: "Kiểm tra 1 tiết",
  SEMESTER_EXAM: "Thi học kỳ",
  OTHER: "Khác",
};

/** Mục đích tạo ĐỀ THI — theo nhóm, lưu mã trong Exam.purpose (bài tập vẫn dùng HomeworkPurpose). */
export const EXAM_PURPOSE_GROUPS = [
  {
    label: "Học kỳ 1",
    options: [
      { value: "HK1_REVIEW", label: "Ôn tập theo chương bài" },
      { value: "HK1_MIDTERM", label: "Kiểm tra giữa kỳ I" },
      { value: "HK1_FINAL", label: "Kiểm tra cuối kỳ I" },
      { value: "HK1_OTHER", label: "Khác" },
    ],
  },
  {
    label: "Học kỳ 2",
    options: [
      { value: "HK2_REVIEW", label: "Ôn tập theo chương bài" },
      { value: "HK2_MIDTERM", label: "Kiểm tra giữa kỳ II" },
      { value: "HK2_FINAL", label: "Kiểm tra cuối kỳ II" },
      { value: "HK2_OTHER", label: "Khác" },
    ],
  },
  {
    label: "Mục đích khác",
    options: [
      { value: "OTHER_THPT", label: "Thi tốt nghiệp THPT" },
      { value: "OTHER_GRADE10", label: "Thi vào Lớp 10" },
      { value: "OTHER_GRADE6", label: "Thi vào Lớp 6" },
      { value: "OTHER_REVIEW", label: "Ôn tập theo chương bài" },
      { value: "OTHER_OTHER", label: "Khác" },
    ],
  },
] as const;

export type ExamPurpose = (typeof EXAM_PURPOSE_GROUPS)[number]["options"][number]["value"];

export const EXAM_PURPOSES = EXAM_PURPOSE_GROUPS.flatMap((g) => g.options.map((o) => o.value)) as [ExamPurpose, ...ExamPurpose[]];

/** "Kiểm tra giữa kỳ I"; nhãn trùng giữa các nhóm ("Khác", "Ôn tập…") thì kèm tên nhóm. */
export function examPurposeLabel(value: string | null | undefined, withGroup = false): string | null {
  for (const g of EXAM_PURPOSE_GROUPS) {
    const o = g.options.find((x) => x.value === value);
    if (o) return withGroup ? `${o.label} (${g.label})` : o.label;
  }
  return null;
}

export const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);

export const SUBJECTS = [
  "Toán",
  "Ngữ văn",
  "Tiếng Anh",
  "Vật lý",
  "Hóa học",
  "Sinh học",
  "Lịch sử",
  "Địa lý",
  "Giáo dục công dân",
  "Tin học",
  "Công nghệ",
  "Khoa học tự nhiên",
  "Lịch sử và Địa lý",
  "Tự nhiên và Xã hội",
  "Đạo đức",
  "Âm nhạc",
  "Mỹ thuật",
  "Giáo dục thể chất",
  "Khác",
] as const;

/** Khối chọn ở "Khối dạy": 1–12, 0 = "Khác". */
export const TEACHING_GRADES = [...GRADES, 0];
export const gradeLabel = (g: number) => (g === 0 ? "Khác" : `Khối ${g}`);

/** Môn theo cấp (Chương trình GDPT 2018). */
const PRIMARY = ["Toán", "Tiếng Việt", "Tiếng Anh", "Đạo đức", "Tự nhiên và Xã hội", "Khoa học", "Lịch sử và Địa lý", "Tin học", "Công nghệ", "Âm nhạc", "Mỹ thuật", "Giáo dục thể chất"];
const LOWER_SECONDARY = ["Toán", "Ngữ văn", "Tiếng Anh", "Khoa học tự nhiên", "Lịch sử và Địa lý", "Giáo dục công dân", "Tin học", "Công nghệ", "Âm nhạc", "Mỹ thuật", "Giáo dục thể chất"];
const UPPER_SECONDARY = ["Toán", "Ngữ văn", "Tiếng Anh", "Vật lý", "Hóa học", "Sinh học", "Lịch sử", "Địa lý", "Giáo dục kinh tế và pháp luật", "Tin học", "Công nghệ", "Giáo dục thể chất"];

/** Môn có ở 1 khối (tiểu học: TN&XH chỉ lớp 1–3; Khoa học, LS&ĐL lớp 4–5; Tin, Công nghệ từ lớp 3). */
export function subjectsForGrade(grade: number): string[] {
  if (grade === 0) return ["Khác"];
  if (grade <= 5) {
    return PRIMARY.filter((s) => {
      if (s === "Tự nhiên và Xã hội") return grade <= 3;
      if (s === "Khoa học" || s === "Lịch sử và Địa lý") return grade >= 4;
      if (s === "Tin học" || s === "Công nghệ") return grade >= 3;
      return true;
    });
  }
  return grade <= 9 ? LOWER_SECONDARY : UPPER_SECONDARY;
}

/** Hợp các môn của nhiều khối, giữ thứ tự xuất hiện. */
export function subjectsForGrades(grades: number[]): string[] {
  return [...new Set([...grades].sort((a, b) => (a || 99) - (b || 99)).flatMap(subjectsForGrade))];
}

export type AssignmentStatus = "UPCOMING" | "OPEN" | "CLOSED";

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  UPCOMING: "Chưa mở",
  OPEN: "Đang mở",
  CLOSED: "Đã hết hạn",
};

/** dueAt = null: không giới hạn thời gian. */
export function assignmentStatus(
  a: { openAt: Date; dueAt: Date | null },
  now = new Date(),
): AssignmentStatus {
  if (now < a.openAt) return "UPCOMING";
  if (a.dueAt && now > a.dueAt) return "CLOSED";
  return "OPEN";
}
