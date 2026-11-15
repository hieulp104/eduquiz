import { getCurrentUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { countContent, getContentDetail } from "@/modules/content/content.service";
import { buildExamDocx, safeFileName } from "@/modules/content/exam-docx";
import { getObject } from "@/shared/storage/storage.service";

const attachment = (name: string) => `attachment; filename*=UTF-8''${encodeURIComponent(name)}`;

/**
 * GET /api/kho-noi-dung/:id/tai-ve — tải nội dung trong kho, đếm lượt.
 * Đề thi → .docx (nhập lại được) · file → file gốc · video → chuyển sang link gốc (không lưu video).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Bạn cần đăng nhập.", { status: 401 });
  if (!can(user, "content.view")) return new Response("Bạn không có quyền xem kho nội dung.", { status: 403 });

  const item = await getContentDetail(id);
  if (!item) return new Response("Không tìm thấy nội dung.", { status: 404 });

  if (item.kind === "VIDEO" && item.url) {
    await countContent(item.id, "viewCount");
    return new Response(null, { status: 302, headers: { Location: item.url, "Referrer-Policy": "no-referrer" } });
  }

  if (item.kind === "EXAM" && item.exam) {
    const body = await buildExamDocx(item.exam, item.title);
    await countContent(item.id, "downloadCount");
    return new Response(body, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": attachment(`${safeFileName(item.title)}.docx`),
      },
    });
  }

  const object = item.file ? await getObject(item.file.objectKey) : null;
  if (!item.file || !object) return new Response("File không còn trong kho.", { status: 404 });
  await countContent(item.id, "downloadCount");
  return new Response(object.stream, {
    headers: {
      "Content-Type": item.file.mimeType,
      "Content-Length": String(object.size),
      "Content-Disposition": attachment(item.file.originalName),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
