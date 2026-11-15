import { getCurrentUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { buildClassTemplate } from "@/modules/classes/class-import";

/** GET /api/classes/template — file Excel mẫu tạo danh sách lớp. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Bạn cần đăng nhập.", { status: 401 });
  if (!can(user, "class.create")) return new Response("Bạn không có quyền tạo lớp.", { status: 403 });

  return new Response(await buildClassTemplate(), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="danh-sach-lop-mau.xlsx"',
    },
  });
}
