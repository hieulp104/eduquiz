import { z } from "zod";
import { isSchoolYear } from "@/modules/classes/class-board";

export const joinClassSchema = z.object({
  joinCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/, "Mã lớp gồm 6 ký tự chữ và số"),
});

export const removeMemberSchema = z.object({
  classId: z.string().min(1),
  studentId: z.string().min(1),
});

const schoolYear = z.string().refine(isSchoolYear, "Năm học không hợp lệ");
const className = z.string().trim().min(1, "Tên lớp không được để trống").max(100, "Tên lớp tối đa 100 ký tự");

/** "Thêm lớp học": mỗi dòng 1 tên lớp → tạo nhiều lớp cùng năm học + nhóm. */
export const createClassesSchema = z.object({
  names: z
    .string()
    .transform((v) => [...new Set(v.split("\n").map((l) => l.trim()).filter(Boolean))])
    .pipe(z.array(className).min(1, "Vui lòng nhập tên lớp").max(50, "Mỗi lần tạo tối đa 50 lớp")),
  schoolYear,
  groupId: z.string().min(1).nullable(),
});

export const classGroupSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên nhóm").max(100),
});

/** Tạo lớp từ file Excel (đã đọc ở /api/classes/import). Nhóm theo tên — chưa có thì tạo. */
export const importClassesSchema = z.object({
  rows: z
    .array(
      z.object({
        name: className,
        schoolYear,
        groupName: z.string().trim().max(100).nullable(),
      }),
    )
    .min(1, "File không có lớp nào")
    .max(200, "Mỗi lần tối đa 200 lớp"),
});

/** "Tạo lớp cho khóa mới": lớp cũ → lớp mới (tên mới) ở năm học mới, chép danh sách học sinh. */
export const promoteClassesSchema = z.object({
  schoolYear,
  items: z
    .array(z.object({ sourceId: z.string().min(1), name: className }))
    .min(1, "Vui lòng chọn lớp")
    .max(100),
});
