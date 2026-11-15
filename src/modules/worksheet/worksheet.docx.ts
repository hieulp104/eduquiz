import type { WorksheetQuestion, WorksheetSettings } from "@/modules/worksheet/worksheet.types";

const LETTERS = "ABCDEFGH";

/**
 * Xuất phiếu bài tập ra .docx ngay trên trình duyệt (thư viện `docx` chỉ nạp khi bấm nút).
 * Bố cục: tiêu đề · Họ tên/Lớp · Câu 1..n (trắc nghiệm A–D trên 1 dòng, điền chỗ trống giữ "......")
 * · trang ĐÁP ÁN (tùy chọn).
 */
export async function exportWorksheetDocx(
  title: string,
  questions: WorksheetQuestion[],
  settings: WorksheetSettings,
): Promise<Blob> {
  const { AlignmentType, Document, Packer, PageBreak, Paragraph, TabStopType, TextRun } = await import("docx");

  const FONT = "Times New Roman";
  const SIZE = 26; // 13pt (docx tính theo nửa point)
  const run = (text: string, opts: { bold?: boolean; size?: number } = {}) =>
    new TextRun({ text, font: FONT, size: opts.size ?? SIZE, bold: opts.bold });

  const body: InstanceType<typeof Paragraph>[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [run(title.toUpperCase(), { bold: true, size: 32 })],
    }),
  ];

  if (settings.includeStudentInfo) {
    body.push(
      new Paragraph({
        spacing: { after: 240 },
        tabStops: [{ type: TabStopType.LEFT, position: 6500 }],
        children: [run("Họ và tên: ......................................................\tLớp: ..................")],
      }),
    );
  }

  questions.forEach((q, i) => {
    body.push(
      new Paragraph({
        spacing: { before: 160, after: 80 },
        children: [run(`Câu ${i + 1}: `, { bold: true }), run(q.content)],
      }),
    );
    if (q.type === "MCQ") {
      // 4 phương án chia đều 1 dòng bằng tab stop (trang A4 rộng ~9000 twip phần chữ).
      body.push(
        new Paragraph({
          spacing: { after: 80 },
          indent: { left: 360 },
          tabStops: [2250, 4500, 6750].map((position) => ({ type: TabStopType.LEFT, position })),
          children: q.options.flatMap((opt, oi) => [
            ...(oi > 0 ? [run("\t")] : []),
            run(`${LETTERS[oi]}. `, { bold: true }),
            run(opt),
          ]),
        }),
      );
    }
  });

  if (settings.includeAnswerKey && questions.length > 0) {
    body.push(new Paragraph({ children: [new PageBreak()] }));
    body.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [run("ĐÁP ÁN", { bold: true, size: 28 })],
      }),
    );
    questions.forEach((q, i) => {
      const answer =
        q.type === "MCQ" ? `${LETTERS[q.correctIndex]}. ${q.options[q.correctIndex]}` : q.options[q.correctIndex];
      body.push(new Paragraph({ children: [run(`Câu ${i + 1}: `, { bold: true }), run(answer)] }));
    });
  }

  const doc = new Document({
    creator: "EduQuiz",
    title,
    sections: [
      {
        properties: {
          page: { margin: { top: 1134, bottom: 1134, left: 1418, right: 1134 } }, // 2cm / 2.5cm lề trái
        },
        children: body,
      },
    ],
  });
  return Packer.toBlob(doc);
}

/** Tên file an toàn: "Phiếu bài tập Toán lớp 1" → "Phieu-bai-tap-Toan-lop-1.docx" */
export function docxFileName(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "phieu-bai-tap"}.docx`;
}

/** HTML cho trình soạn thảo bài tập ("Tạo bài tập online từ phiếu"). Đã escape — server lọc lại lần nữa. */
export function worksheetToHtml(questions: WorksheetQuestion[]): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return questions
    .map((q, i) => {
      const head = `<p><strong>Câu ${i + 1}:</strong> ${esc(q.content)}</p>`;
      if (q.type !== "MCQ") return head;
      const opts = q.options.map((o, oi) => `<strong>${LETTERS[oi]}.</strong> ${esc(o)}`).join("&nbsp;&nbsp;&nbsp;&nbsp;");
      return `${head}<p>${opts}</p>`;
    })
    .join("");
}

/** Khóa sessionStorage để chuyển phiếu sang form Tạo bài tập. */
export const HOMEWORK_DRAFT_KEY = "eduquiz:homework-draft";
