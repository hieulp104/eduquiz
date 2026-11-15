import { getCurrentUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { parseTeacherWorkbook } from "@/modules/teachers/teacher-import";

const MAX_SIZE = 2 * 1024 * 1024;

/** POST /api/teachers/import — đọc file Excel danh sách giáo viên, trả bản xem trước. KHÔNG thêm giáo viên. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Bạn cần đăng nhập." }, { status: 401 });
  if (!can(user, "teacher.manage")) return Response.json({ message: "Bạn không có quyền quản lý giáo viên." }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ message: "Không tìm thấy file." }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return Response.json({ message: "Chỉ nhận file Excel .xlsx — tải file biểu mẫu để điền." }, { status: 415 });
  }
  if (file.size > MAX_SIZE) return Response.json({ message: "File vượt quá 2MB." }, { status: 400 });

  try {
    return Response.json(await parseTeacherWorkbook(Buffer.from(await file.arrayBuffer())));
  } catch {
    return Response.json({ message: "Không đọc được file Excel — file có thể bị hỏng." }, { status: 400 });
  }
}
