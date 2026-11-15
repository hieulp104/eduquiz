/**
 * "In đề + phiếu trả lời": sinh 1 file .docx gồm các mã đề đã đảo, phiếu trả lời trắc nghiệm và trang đáp án.
 * CHỈ chạy ở server (thư viện docx). Phiếu trả lời là mẫu tự thiết kế — chỉ để in và chấm tay, chưa chấm bằng ảnh.
 */
import { toRuns, stripTags } from "@/lib/inline-format";
import { gradeLabel } from "@/common/enums";
import { buildVersions, type PrintOptions } from "@/modules/exams/exam-print.types";

type PrintExam = {
  id: string;
  title: string;
  grade: number | null;
  subject: string | null;
  durationMinutes: number;
  groups: { id: string; content: string; fixedOrder: boolean }[];
  questions: {
    id: string;
    groupId: string | null;
    content: string;
    fixedOptions: boolean;
    options: { content: string; isCorrect: boolean }[];
  }[];
};

const LETTERS = "ABCDEFGH";
const FONT = "Times New Roman";
/** Chữ cái trong vòng tròn Ⓐ Ⓑ … — ô tô của phiếu trả lời. */
const bubble = (i: number) => String.fromCodePoint(0x24b6 + i);
/** Bề rộng vùng in (twips) của A4 với lề 0,6 inch. */
const CONTENT_WIDTH = 11906 - 2 * 864;

export async function buildPrintDocx(exam: PrintExam, opts: PrintOptions): Promise<Uint8Array<ArrayBuffer>> {
  const { AlignmentType, BorderStyle, Document, Packer, Paragraph, Tab, TabStopType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType } =
    await import("docx");
  type Block = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;
  type RunOptions = { bold?: boolean; italics?: boolean; size?: number; font?: string };

  const groupById = new Map(exam.groups.map((g) => [g.id, g]));
  const questions = exam.questions.map((q) => ({ ...q, group: q.groupId ? (groupById.get(q.groupId) ?? null) : null }));
  const versions = buildVersions(exam.id, questions, opts);
  const optionCount = Math.max(2, ...questions.map((q) => q.options.length));
  const total = questions.length;

  // ── Khối dựng chữ
  const text = (value: string, o: RunOptions = {}) => new TextRun({ text: value, font: o.font ?? FONT, size: o.size ?? 26, bold: o.bold, italics: o.italics });
  /** Nội dung có <b> <i> <u> và xuống dòng → các TextRun. */
  const rich = (content: string, o: RunOptions = {}) =>
    toRuns(content).flatMap((r) =>
      r.text.split("\n").map(
        (part, i) =>
          new TextRun({
            text: part,
            break: i ? 1 : undefined,
            font: FONT,
            size: o.size ?? 26,
            bold: r.b || o.bold,
            italics: r.i || o.italics,
            underline: r.u ? {} : undefined,
          }),
      ),
    );
  const para = (children: InstanceType<typeof TextRun>[], o: { center?: boolean; after?: number; before?: number; pageBreak?: boolean; tabs?: number[] } = {}) =>
    new Paragraph({
      alignment: o.center ? AlignmentType.CENTER : undefined,
      spacing: { after: o.after ?? 80, before: o.before },
      pageBreakBefore: o.pageBreak,
      tabStops: o.tabs?.map((position) => ({ type: TabStopType.LEFT, position })),
      children,
    });
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
  const thin = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
  const boxBorders = { top: thin, bottom: thin, left: thin, right: thin, insideHorizontal: thin, insideVertical: thin };
  const cell = (children: Block[], o: { width?: number; span?: number } = {}) =>
    new TableCell({
      children,
      columnSpan: o.span,
      verticalAlign: VerticalAlign.CENTER,
      width: o.width ? { size: o.width, type: WidthType.DXA } : undefined,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
    });

  // ── Đầu đề: trường / kỳ thi (trái) · tên đề, môn, thời gian (phải)
  const subjectLine = [exam.subject ? `Môn: ${exam.subject}` : null, exam.grade ? gradeLabel(exam.grade) : null].filter(Boolean).join(" – ");
  const heading = (code: string): Block[] => [
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      borders: noBorders,
      rows: [
        new TableRow({
          children: [
            cell(
              [
                para([text((opts.school || "TRƯỜNG ..............................").toUpperCase(), { bold: true, size: 24 })], { center: true, after: 40 }),
                para([text(opts.examName || "ĐỀ KIỂM TRA", { size: 24 })], { center: true, after: 40 }),
                para([text(`(Đề gồm ${total} câu)`, { italics: true, size: 22 })], { center: true, after: 0 }),
              ],
              { width: Math.round(CONTENT_WIDTH * 0.42) },
            ),
            cell(
              [
                para([text(exam.title.toUpperCase(), { bold: true })], { center: true, after: 40 }),
                ...(subjectLine ? [para([text(subjectLine, { size: 24 })], { center: true, after: 40 })] : []),
                para([text(`Thời gian làm bài: ${exam.durationMinutes} phút`, { italics: true, size: 24 })], { center: true, after: 0 }),
              ],
              { width: Math.round(CONTENT_WIDTH * 0.58) },
            ),
          ],
        }),
      ],
    }),
    para(
      [
        text("Họ và tên: ........................................................  Số báo danh: ....................  "),
        text(`Mã đề: ${code}`, { bold: true }),
      ],
      { before: 200, after: 200 },
    ),
  ];

  // ── Phương án: ngắn thì 4 / 2 phương án một dòng (canh bằng tab), dài thì mỗi phương án một dòng
  const optionLines = (options: { content: string }[]): Block[] => {
    const longest = Math.max(...options.map((o) => stripTags(o.content).length));
    const perLine = options.some((o) => o.content.includes("\n")) || longest > 34 ? 1 : longest > 15 ? 2 : 4;
    const step = Math.floor(CONTENT_WIDTH / perLine);
    const lines: Block[] = [];
    for (let i = 0; i < options.length; i += perLine) {
      const children: InstanceType<typeof TextRun>[] = [];
      options.slice(i, i + perLine).forEach((o, k) => {
        if (k) children.push(new TextRun({ children: [new Tab()], font: FONT, size: 26 }));
        children.push(text(`${LETTERS[i + k]}. `, { bold: true }), ...rich(o.content));
      });
      lines.push(para(children, { after: 40, tabs: Array.from({ length: perLine - 1 }, (_, k) => step * (k + 1)) }));
    }
    return lines;
  };

  const examBlocks = (v: (typeof versions)[number], first: boolean): Block[] => {
    const blocks: Block[] = [...(first ? [] : [para([], { pageBreak: true, after: 0 })]), ...heading(v.code)];
    v.questions.forEach((q, i) => {
      const startsGroup = q.group && v.questions[i - 1]?.group?.id !== q.group.id;
      if (startsGroup && q.group!.content) {
        // Lời dẫn ngắn 1 dòng thì in đậm; đoạn văn đọc hiểu giữ nguyên định dạng gốc.
        const instruction = !q.group!.content.includes("\n") && q.group!.content.length <= 220;
        blocks.push(para(rich(q.group!.content, { bold: instruction }), { before: 160, after: 100 }));
      }
      blocks.push(para([text(`Câu ${i + 1}. `, { bold: true }), ...rich(q.content)], { before: 80, after: 40 }));
      blocks.push(...optionLines(q.options));
    });
    blocks.push(para([text("------ HẾT ------", { bold: true })], { center: true, before: 240 }));
    return blocks;
  };

  // ── Phiếu trả lời (1 trang, dùng chung cho mọi mã đề — học sinh tự ghi mã đề)
  const boxes = (label: string, count: number) => {
    const w = 380;
    return new Table({
      width: { size: w * count, type: WidthType.DXA },
      borders: boxBorders,
      rows: [
        new TableRow({ children: [cell([para([text(label, { bold: true, size: 20 })], { center: true, after: 0 })], { span: count })] }),
        new TableRow({ height: { value: 460, rule: "atLeast" }, children: Array.from({ length: count }, () => cell([para([], { after: 0 })], { width: w })) }),
      ],
    });
  };
  const sheetHead = (): Block[] => [
    para([text("PHIẾU TRẢ LỜI TRẮC NGHIỆM", { bold: true, size: 30 })], { center: true, pageBreak: true, after: 60 }),
    para([text(exam.title, { italics: true, size: 24 })], { center: true, after: 200 }),
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      borders: noBorders,
      rows: [
        new TableRow({
          children: [
            cell(
              [
                para([text("Họ và tên: ....................................................................", { size: 24 })], { after: 120 }),
                para([text("Lớp: ..............................   Ngày thi: ......../......../............", { size: 24 })], { after: 120 }),
                para([text(`Trường: ${opts.school || "......................................................................"}`, { size: 24 })], { after: 0 }),
              ],
              { width: CONTENT_WIDTH - 380 * 10 - 400 },
            ),
            cell([boxes("Số báo danh", 6)], { width: 380 * 6 + 200 }),
            cell([boxes("Mã đề", 4)], { width: 380 * 4 + 200 }),
          ],
        }),
      ],
    }),
  ];

  const bubbleSheet = (): Block[] => {
    const cols = optionCount <= 4 ? 4 : optionCount <= 6 ? 3 : 2;
    const rows = Math.ceil(total / cols);
    const marks = Array.from({ length: optionCount }, (_, i) => bubble(i)).join("  ");
    return [
      ...sheetHead(),
      para([text("Tô kín một ô tròn cho mỗi câu bằng bút chì hoặc bút mực. Muốn đổi đáp án: gạch chéo ô cũ rồi tô ô mới.", { italics: true, size: 22 })], {
        before: 200,
        after: 160,
      }),
      new Table({
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        borders: { ...noBorders, insideVertical: { style: BorderStyle.DOTTED, size: 4, color: "808080" } },
        rows: Array.from({ length: rows }, (_, r) =>
          new TableRow({
            children: Array.from({ length: cols }, (_, c) => {
              const n = c * rows + r + 1; // đánh số theo cột
              return cell(
                n > total
                  ? [para([], { after: 0 })]
                  : [para([text(`${String(n).padStart(2, "0")}.  `, { bold: true, size: 24 }), text(marks, { font: "Segoe UI Symbol", size: 28 })], { after: 0 })],
                { width: Math.floor(CONTENT_WIDTH / cols) },
              );
            }),
          }),
        ),
      }),
    ];
  };

  const letterSheet = (): Block[] => {
    const perRow = 10;
    const w = Math.floor((CONTENT_WIDTH - 1000) / perRow);
    const tables: Block[] = [];
    for (let start = 0; start < total; start += perRow) {
      const numbers = Array.from({ length: perRow }, (_, i) => (start + i < total ? String(start + i + 1) : ""));
      tables.push(
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          borders: boxBorders,
          rows: [
            new TableRow({
              children: [
                cell([para([text("Câu", { bold: true, size: 22 })], { center: true, after: 0 })], { width: 1000 }),
                ...numbers.map((n) => cell([para([text(n, { bold: true, size: 22 })], { center: true, after: 0 })], { width: w })),
              ],
            }),
            new TableRow({
              height: { value: 520, rule: "atLeast" },
              children: [
                cell([para([text("Đáp án", { size: 22 })], { center: true, after: 0 })], { width: 1000 }),
                ...numbers.map(() => cell([para([], { after: 0 })], { width: w })),
              ],
            }),
          ],
        }),
        para([], { after: 120 }),
      );
    }
    return [
      ...sheetHead(),
      para([text(`Ghi một chữ cái in hoa (${LETTERS.slice(0, optionCount).split("").join(", ")}) vào ô đáp án của mỗi câu.`, { italics: true, size: 22 })], {
        before: 200,
        after: 160,
      }),
      ...tables,
    ];
  };

  // ── Trang đáp án của mọi mã đề
  const keyBlocks = (): Block[] => {
    const perRow = 10;
    const w = Math.floor(CONTENT_WIDTH / perRow);
    const blocks: Block[] = [
      para([text("ĐÁP ÁN", { bold: true, size: 30 })], { center: true, pageBreak: true, after: 60 }),
      para([text(exam.title, { italics: true, size: 24 })], { center: true, after: 200 }),
    ];
    for (const v of versions) {
      blocks.push(para([text(`Mã đề ${v.code}`, { bold: true })], { before: 160, after: 80 }));
      blocks.push(
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          borders: boxBorders,
          rows: Array.from({ length: Math.ceil(total / perRow) }, (_, r) =>
            new TableRow({
              children: Array.from({ length: perRow }, (_, c) => {
                const i = r * perRow + c;
                return cell(
                  [para(i < total ? [text(`${i + 1}. `, { size: 22 }), text(v.key[i], { bold: true, size: 22 })] : [], { center: true, after: 0 })],
                  { width: w },
                );
              }),
            }),
          ),
        }),
      );
    }
    return blocks;
  };

  const doc = new Document({
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 720, bottom: 720, left: 864, right: 864 } } },
        children: [
          ...versions.flatMap((v, i) => examBlocks(v, i === 0)),
          ...(opts.sheet === "BUBBLE" ? bubbleSheet() : opts.sheet === "LETTER" ? letterSheet() : []),
          ...(opts.includeKey ? keyBlocks() : []),
        ],
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}
