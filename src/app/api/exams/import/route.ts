import { getCurrentUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { importExamFile, UnsupportedFileError } from "@/modules/exams/exam-import";

/** Dưới mức đệm 10MB của proxy.ts (route này nằm trong matcher). */
const MAX_IMPORT_SIZE = 8 * 1024 * 1024;

/**
 * POST /api/exams/import — đọc đề từ file (.docx / .xlsx / .tex / .txt), trả VĂN BẢN đề
 * (định dạng exam-text.ts) cho trình soạn đề. KHÔNG lưu gì.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Bạn cần đăng nhập." }, { status: 401 });
  if (!can(user, "exam.create")) return Response.json({ message: "Bạn không có quyền tạo đề." }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ message: "Không tìm thấy file." }, { status: 400 });
  if (file.size > MAX_IMPORT_SIZE) return Response.json({ message: "File vượt quá 8MB." }, { status: 400 });

  try {
    return Response.json(await importExamFile(file.name, Buffer.from(await file.arrayBuffer())));
  } catch (e) {
    if (e instanceof UnsupportedFileError) return Response.json({ message: e.message }, { status: 415 });
    return Response.json({ message: "Không đọc được file — file có thể bị hỏng hoặc sai định dạng." }, { status: 400 });
  }
}
