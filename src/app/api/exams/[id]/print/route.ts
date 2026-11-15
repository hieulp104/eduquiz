import { getCurrentUser } from "@/modules/auth/auth.service";
import { hasPermission } from "@/common/permissions/permissions";
import { safeFileName } from "@/modules/content/exam-docx";
import { buildPrintDocx } from "@/modules/exams/exam-print";
import { parseCodes, printOptionsSchema } from "@/modules/exams/exam-print.types";
import { getExamWithAnswers } from "@/modules/exams/exams.service";

/**
 * GET /api/exams/:id/print — file .docx gồm các mã đề đã đảo + phiếu trả lời + đáp án.
 * ?so-de=4 &ma-de=101,102 &dao-cau=1 &dao-dap-an=1 &phieu=BUBBLE|LETTER|NONE &dap-an=1 &truong= &ky-thi=
 * Chỉ người xem được đề kèm đáp án (người soạn / Admin).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Bạn cần đăng nhập.", { status: 401 });
  if (!hasPermission(user, "exam.view")) return new Response("Bạn không có quyền in đề.", { status: 403 });

  // getExamWithAnswers đã lọc theo phạm vi: OWN chỉ thấy đề mình soạn.
  const exam = await getExamWithAnswers(user, id);
  if (!exam) return new Response("Không tìm thấy đề.", { status: 404 });

  const q = new URL(request.url).searchParams;
  const parsed = printOptionsSchema.safeParse({
    count: Number(q.get("so-de") ?? 1),
    codes: parseCodes(q.get("ma-de") ?? ""),
    shuffleQuestions: q.get("dao-cau") === "1",
    shuffleOptions: q.get("dao-dap-an") === "1",
    sheet: q.get("phieu") ?? "BUBBLE",
    includeKey: q.get("dap-an") !== "0",
    school: q.get("truong") ?? "",
    examName: q.get("ky-thi") ?? "",
  });
  if (!parsed.success) return new Response(parsed.error.issues[0]?.message ?? "Tùy chọn in không hợp lệ.", { status: 400 });

  const body = await buildPrintDocx(exam, parsed.data);
  const name = `${safeFileName(exam.title)} - ${parsed.data.count} ma de.docx`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
