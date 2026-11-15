import { getCurrentUser } from "@/modules/auth/auth.service";

/**
 * GET /api/exams/template?loai=xlsx|docx — file mẫu để soạn đề rồi tải lên.
 * Sinh tại chỗ (không lưu file tĩnh) để mẫu luôn khớp với bộ đọc trong exam-import.ts.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Bạn cần đăng nhập.", { status: 401 });
  const kind = new URL(request.url).searchParams.get("loai");

  if (kind === "xlsx") {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("De thi");
    ws.columns = [
      { header: "STT", width: 6 },
      { header: "Câu hỏi", width: 50 },
      { header: "Đáp án A", width: 18 },
      { header: "Đáp án B", width: 18 },
      { header: "Đáp án C", width: 18 },
      { header: "Đáp án D", width: 18 },
      { header: "Đáp án đúng", width: 13 },
      { header: "Điểm", width: 8 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.addRow([1, "Thủ đô của Việt Nam là thành phố nào?", "Hồ Chí Minh", "Hà Nội", "Đà Nẵng", "Huế", "B", 1]);
    ws.addRow([2, "2 + 3 = ?", "4", "5", "6", "", "B", 1]);
    ws.addRow([3, "Câu chỉ có 2 đáp án vẫn được", "Đúng", "Sai", "", "", "A", 1]);
    const buf = await wb.xlsx.writeBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=\"de-thi-mau.xlsx\"",
      },
    });
  }

  if (kind === "thu-muc") {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Thu muc");
    ws.columns = [{ header: "Đường dẫn thư mục (các cấp ngăn bằng /)", width: 60 }];
    ws.getRow(1).font = { bold: true };
    for (const p of [
      "Lớp 6A1 24-25",
      "Lớp 6A1 24-25/Chương 1",
      "Lớp 6A1 24-25/Chương 2",
      "Lớp 6A1 24-25/Chương 2/Kiểm tra 15 phút",
      "Lớp 7A1",
      "Ôn thi học kì 1",
    ]) {
      ws.addRow([p]);
    }
    return new Response(await wb.xlsx.writeBuffer(), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=\"thu-muc-mau.xlsx\"",
      },
    });
  }

  if (kind === "docx" || kind === "tieng-anh") {
    const { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = await import("docx");
    const run = (text: string, bold = false) => new TextRun({ text, bold, font: "Times New Roman", size: 26 });
    const p = (text: string, bold = false) => new Paragraph({ spacing: { after: 80 }, children: [run(text, bold)] });
    // Bảng đáp án 2 hàng "Câu | 1 | 2 …" / "Chọn | B | A …" — bộ đọc nhận dạng được.
    const keyTable = (letters: string[]) =>
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [["Câu", ...letters.map((_, i) => String(i + 1))], ["Chọn", ...letters]].map(
          (cells) => new TableRow({ children: cells.map((c) => new TableCell({ children: [p(c, c === "Câu" || c === "Chọn")] })) }),
        ),
      });

    const children =
      kind === "docx"
        ? [
            p(
              "Hướng dẫn soạn (đoạn trước câu 1 sẽ thành mô tả đề — xóa đi khi dùng thật): mỗi câu bắt đầu bằng “Câu 1.”; " +
                "đáp án đúng có 3 cách ghi: đặt * trước đáp án (câu 1), dòng “Đáp án: B” (câu 2), hoặc bảng đáp án sau dòng HẾT (câu 3). " +
                "Phần “Lời giải” được bỏ qua.",
            ),
            p("PHẦN I. Câu trắc nghiệm một đáp án đúng", true),
            p("Câu 1. Thủ đô của Việt Nam là thành phố nào?", true),
            p("A. Hồ Chí Minh"),
            p("*B. Hà Nội"),
            p("C. Đà Nẵng"),
            p("D. Huế"),
            p("Câu 2. 2 + 3 = ?", true),
            p("A. 4\tB. 5\tC. 6\tD. 7"),
            p("Đáp án: B"),
            p("Câu 3. Số liền sau của 9 là:", true),
            p("A. 8\tB. 10\tC. 11\tD. 19"),
            p("Lời giải", true),
            p("Số liền sau của 9 là 10."),
            p("---------------------------HẾT------------------------"),
            p("PHẦN I", true),
            keyTable(["B", "B", "B"]),
          ]
        : [
            p("Read the passage and mark the letter A, B, C or D to indicate the option that best fits each of the numbered blanks."),
            p("A WEEKEND AT THE MARKET", true),
            p("Every Saturday morning, my grandmother takes me to the old market near our house. We usually (1)_______ early, before the streets get busy. She knows almost every seller there, and they always greet her (2)_______ a big smile."),
            p("Question 1.\t*A. arrive\tB. arrives\tC. arriving\tD. to arrive"),
            p("Lời giải", true),
            p("Chủ ngữ “We” + thì hiện tại đơn → arrive."),
            p("Question 2.\tA. at\t*B. with\tC. on\tD. by"),
            p("Lời giải", true),
            p("greet somebody with a smile: chào ai đó bằng nụ cười."),
            p("Question 3. Which word has the underlined part pronounced differently from the others?", true),
            p("A. market\tB. father\t*C. mango\tD. garden"),
          ];

    const doc = new Document({ sections: [{ children }] });
    const file = kind === "docx" ? "de-thi-mau.docx" : "de-tieng-anh-mau.docx";
    return new Response(new Uint8Array(await Packer.toBuffer(doc)), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${file}"`,
      },
    });
  }

  if (kind === "tex") {
    const tex = String.raw`% Đề mẫu LaTeX cho EduQuiz — gói ex_test: mỗi câu là \begin{ex} ... \end{ex}
% Câu trắc nghiệm: \choice{A}{B}{C}{D}, đặt \True trước đáp án đúng.
% Câu đúng/sai (\choiceTF) và trả lời ngắn (\shortans) hiện được bỏ qua khi nhập.
\documentclass[12pt,a4paper]{article}
\usepackage{amsmath,amssymb}
\usepackage[solcolor]{ex_test}
\begin{document}
\noindent\textbf{PHẦN I.} Mỗi câu hỏi chỉ chọn một phương án.
\begin{ex}%Câu 1
Giá trị của biểu thức $2^3 + 3^2$ bằng
\choice
{$13$}
{\True $17$}
{$15$}
{$12$}
\end{ex}
\begin{ex}%Câu 2
Nghiệm của phương trình $3x - 6 = 0$ là
\choice
{\True $x = 2$}
{$x = -2$}
{$x = 3$}
{$x = \dfrac{1}{2}$}
\end{ex}
\begin{ex}%Câu 3
Hình vuông có cạnh $4\,\text{cm}$ thì diện tích bằng
\choice
{$8\,\text{cm}^2$}
{$12\,\text{cm}^2$}
{\True $16\,\text{cm}^2$}
{$20\,\text{cm}^2$}
\end{ex}
\end{document}
`;
    return new Response(tex, {
      headers: {
        "Content-Type": "application/x-tex; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"de-thi-mau.tex\"",
      },
    });
  }

  return new Response("Tham số loai phải là xlsx, docx, tieng-anh, tex hoặc thu-muc.", { status: 400 });
}
