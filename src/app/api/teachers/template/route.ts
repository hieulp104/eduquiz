import { getCurrentUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { buildTeacherTemplate } from "@/modules/teachers/teacher-import";

/** GET /api/teachers/template — file Excel mẫu thêm giáo viên. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Bạn cần đăng nhập.", { status: 401 });
  if (!can(user, "teacher.manage")) return new Response("Bạn không có quyền quản lý giáo viên.", { status: 403 });

  return new Response(await buildTeacherTemplate(), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="danh-sach-giao-vien-mau.xlsx"',
    },
  });
}
