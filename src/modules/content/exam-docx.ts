/**
 * Đề trong kho → file .docx (CHỈ chạy ở server — thư viện docx).
 * Dùng chung định dạng văn bản đề (`serializeExam`) nên file tải về nhập lại được bằng "Tạo đề từ file".
 * Giữ đậm / nghiêng / gạch chân; thẻ [audio:…] [NB]… bỏ đi (chỉ có nghĩa trong hệ thống).
 */
import { serializeExam } from "@/modules/exams/exam-text";
import { toRuns } from "@/lib/inline-format";
import type { ContentDetail } from "@/modules/content/content.service";

const LEVEL = { RECOGNITION: "NB", COMPREHENSION: "TH", APPLICATION: "VD" } as const;

export async function buildExamDocx(exam: NonNullable<ContentDetail["exam"]>, title: string): Promise<Uint8Array<ArrayBuffer>> {
  const { Document, Packer, Paragraph, TextRun, Tab, AlignmentType } = await import("docx");
  const groupIndex = new Map(exam.groups.map((g, i) => [g.id, i]));
  const text = serializeExam({
    groups: exam.groups.map((g) => ({ content: g.content, fixedOrder: false, audioId: null })),
    questions: exam.questions.map((q) => ({
      content: q.content,
      groupIndex: q.groupId ? (groupIndex.get(q.groupId) ?? null) : null,
      options: q.options.map((o) => ({ content: o.content, isCorrect: o.isCorrect })),
      level: q.level ? LEVEL[q.level] : null,
      fixedOptions: false,
      audioId: null,
    })),
  });

  const font = { font: "Times New Roman", size: 26 };
  const line = (raw: string) => {
    const clean = raw.replace(/\s*\[(?:NB|TH|VD|cố định nhóm|cố định|audio:[^\]]*)\]/g, "");
    const head = clean.match(/^Câu \d+\./)?.[0];
    const bold = clean === "ĐÁP ÁN";
    const children: InstanceType<typeof TextRun>[] = head ? [new TextRun({ text: head, bold: true, ...font })] : [];
    for (const r of toRuns(head ? clean.slice(head.length) : clean)) {
      // Tab giữa các phương án "A. …⇥B. …" → tab thật trong Word.
      r.text.split("\t").forEach((t, i) => {
        if (i) children.push(new TextRun({ children: [new Tab()], ...font }));
        if (t) children.push(new TextRun({ text: t, bold: r.b || bold, italics: r.i, underline: r.u ? {} : undefined, ...font }));
      });
    }
    return new Paragraph({ spacing: { after: 80 }, children });
  };

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: title.toUpperCase(), bold: true, ...font, size: 30 })] }),
          ...(exam.description ? [new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: exam.description, italics: true, ...font })] })] : []),
          ...text.split("\n").filter((l) => l.trim()).map(line),
        ],
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}

/** Tên file an toàn cho Content-Disposition (giữ tiếng Việt qua filename*). */
export const safeFileName = (s: string) => s.replace(/[\\/:*?"<>|\r\n]+/g, " ").trim().slice(0, 120) || "de-thi";
