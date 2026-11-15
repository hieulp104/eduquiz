import { getCurrentUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { saveUploadedFile } from "@/modules/files/files.service";

/**
 * POST /api/files — tải 1 file lên (multipart, trường "file").
 *
 * Dùng Route Handler thay vì Server Action vì Server Action giới hạn 1MB/request.
 * Route này nằm NGOÀI matcher của proxy.ts (proxy chỉ đệm 10MB body) nên phải tự
 * kiểm tra đăng nhập ở đây.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Bạn cần đăng nhập." }, { status: 401 });
  if (!can(user, "file.upload")) {
    return Response.json({ message: "Bạn không có quyền tải file." }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ message: "Không tìm thấy file." }, { status: 400 });
  }

  const result = await saveUploadedFile(user.id, file);
  if (!result.ok) return Response.json({ message: result.message }, { status: 400 });

  const { id, originalName, size, mimeType } = result.file;
  return Response.json({ id, name: originalName, size, mimeType });
}
