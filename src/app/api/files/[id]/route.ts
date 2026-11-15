import { getCurrentUser } from "@/modules/auth/auth.service";
import { canReadFile, deleteUnattachedFile, findFile } from "@/modules/files/files.service";
import { getObject } from "@/shared/storage/storage.service";

/** Loại file trình duyệt mở thẳng được; còn lại bắt tải về (tránh chạy HTML/SVG lạ). */
const INLINE_MIME = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|audio\/|video\/)/;

/** GET /api/files/:id — xem / tải file (kiểm tra quyền theo bài tập chứa file). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Bạn cần đăng nhập.", { status: 401 });

  const file = await findFile(id);
  if (!file || !(await canReadFile(user, file))) {
    return new Response("Không tìm thấy file.", { status: 404 });
  }

  const object = await getObject(file.objectKey);
  if (!object) return new Response("File không còn trong kho.", { status: 404 });

  const download = new URL(request.url).searchParams.has("download") || !INLINE_MIME.test(file.mimeType);
  const encodedName = encodeURIComponent(file.originalName);
  return new Response(object.stream, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(object.size),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodedName}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

/** DELETE /api/files/:id — bỏ file khỏi form khi CHƯA lưu bài tập. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  const removed = await deleteUnattachedFile(user.id, id);
  return new Response(null, { status: removed ? 204 : 404 });
}
