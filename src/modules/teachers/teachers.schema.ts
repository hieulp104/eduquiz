import { z } from "zod";
import { normalizePhone } from "@/modules/auth/auth.schema";

const name = (what: string) =>
  z.string().trim().min(1, `${what} không được để trống`).max(100, `${what} tối đa 100 ký tự`);
const id = z.string().min(1);

/**
 * SĐT (đúng 10 chữ số, bắt đầu bằng 0; nhận "+84…", dấu cách / chấm) hoặc email.
 * → { phone } hoặc { email } đã chuẩn hóa.
 */
export const contactSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập số điện thoại hoặc email")
  .max(200, "Quá dài")
  .transform((v, ctx) => {
    if (v.includes("@")) {
      const email = v.toLowerCase();
      if (!z.email().safeParse(email).success) {
        ctx.addIssue({ code: "custom", message: "Email không hợp lệ" });
        return z.NEVER;
      }
      return { phone: null, email };
    }
    const phone = normalizePhone(v);
    if (!/^0\d{9}$/.test(phone)) {
      ctx.addIssue({ code: "custom", message: "Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0 (VD 0912345678)" });
      return z.NEVER;
    }
    return { phone, email: null };
  });

export type Contact = z.infer<typeof contactSchema>;

/** Thêm 1 giáo viên: họ tên + SĐT hoặc email (không cần tài khoản). */
export const addTeacherSchema = z.object({
  name: name("Họ và tên"),
  contact: contactSchema,
});

export const importTeachersSchema = z.object({
  rows: z
    .array(z.object({ name: z.string().max(100), contact: z.string().max(200) }))
    .min(1, "File không có giáo viên nào")
    .max(200, "Mỗi lần nhập tối đa 200 giáo viên"),
});

/** Sửa tên + SĐT/email của giáo viên trong danh sách. */
export const updateTeacherSchema = z.object({ memberId: id, name: name("Họ và tên"), contact: contactSchema });
export const teacherGroupSchema = z.object({ name: name("Tên nhóm") });
export const renameGroupSchema = z.object({ groupId: id, name: name("Tên nhóm") });
export const deleteTargetSchema = z.object({ kind: z.enum(["group", "teacher"]), id });

export const setGroupMembersSchema = z.object({
  groupId: id,
  memberIds: z.array(id).max(500),
});

/** Lưu phân quyền lớp cho 1 nhóm / 1 giáo viên: danh sách lớp thay thế toàn bộ. */
export const saveClassPermissionsSchema = z.object({
  kind: z.enum(["group", "teacher"]),
  id,
  classIds: z.array(id).max(1000),
});
