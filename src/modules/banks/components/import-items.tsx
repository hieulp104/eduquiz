"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Download, FileUp, LoaderCircle, Save } from "lucide-react";
import { Alert, Button, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { stripTags } from "@/lib/inline-format";
import { parseExamText, type Level } from "@/modules/exams/exam-text";
import { importItemsAction } from "@/modules/banks/banks.actions";
import { BANKS_PATH } from "@/modules/banks/banks.types";
import { ItemCard } from "./item-card";

type Props = { bankId: string; sections: { id: string; title: string; depth: number }[]; initialSection: string | null };
type Draft = { content: string; options: string[]; correctIndex: number; level: Level | null; problem: string | null };

const SAMPLE = `Câu 1. [NB] Số liền sau của 9 là:
A. 8
*B. 10
C. 11
D. 19
Câu 2. [TH] 5 + 3 = ?
A. 7\tB. 8\tC. 9\tD. 10
Đáp án: B`;

/** Văn bản đề → câu cho ngân hàng. Câu thuộc nhóm: ghép lời dẫn vào đầu nội dung (ngân hàng không có nhóm). */
function toDrafts(text: string): { drafts: Draft[]; warnings: string[] } {
  const parsed = parseExamText(text);
  const drafts = parsed.questions.map((q): Draft => {
    const group = q.groupIndex != null ? parsed.groups[q.groupIndex]?.content : "";
    const content = [group, q.content].filter((s) => s && s.trim()).join("\n");
    const correctIndex = q.options.findIndex((o) => o.isCorrect);
    const problem =
      q.options.length < 2 ? "cần ít nhất 2 phương án" : correctIndex < 0 ? "chưa có đáp án đúng" : !stripTags(content).trim() ? "thiếu nội dung câu hỏi" : null;
    return { content, options: q.options.map((o) => o.content), correctIndex, level: q.level, problem };
  });
  return { drafts, warnings: parsed.warnings };
}

/** "Nhập câu hỏi": chọn bài → dán văn bản / đọc file (.docx .xlsx .tex .txt) → xem trước → lưu. */
export function ImportItems({ bankId, sections, initialSection }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sectionId, setSectionId] = useState(initialSection ?? "");
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileWarnings, setFileWarnings] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const { drafts, warnings } = useMemo(() => (text.trim() ? toDrafts(text) : { drafts: [], warnings: [] }), [text]);
  const valid = drafts.filter((d) => !d.problem);
  const invalid = drafts.length - valid.length;

  async function readFile(f: File | undefined) {
    if (!f) return;
    setError(null);
    setReading(true);
    try {
      const body = new FormData();
      body.append("file", f);
      const res = await fetch("/api/exams/import", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? "Không đọc được file.");
      setText(json.text ?? "");
      setFileWarnings(json.warnings ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await importItemsAction({
        bankId,
        sectionId: sectionId || null,
        items: valid.map(({ content, options, correctIndex, level }) => ({ content, options, correctIndex, level })),
      });
      if (!res.ok) return setError(res.message);
      router.push(`${BANKS_PATH}/${bankId}${sectionId ? `?bai=${sectionId}` : ""}`);
    });
  }

  const allWarnings = [...fileWarnings, ...warnings];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ───── Trái: nguồn ───── */}
      <section className="space-y-3 rounded-xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-56 flex-1 text-sm font-medium text-ink">
            Lưu vào
            <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="mt-1.5">
              <option value="">Chưa xếp bài</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {"— ".repeat(s.depth)}
                  {s.title}
                </option>
              ))}
            </Select>
          </label>
          <Button variant="secondary" disabled={reading} onClick={() => fileRef.current?.click()}>
            {reading ? <LoaderCircle className="size-4 animate-spin" /> : <FileUp className="size-4" />} Đọc từ file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".docx,.xlsx,.tex,.txt"
            className="hidden"
            onChange={(e) => {
              void readFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          placeholder={`Dán câu hỏi vào đây, VD:\n\n${SAMPLE}`}
          aria-label="Văn bản câu hỏi"
          className="h-[calc(100dvh-20rem)] min-h-80 w-full resize-y rounded-lg border border-line bg-surface p-3 font-mono text-sm leading-relaxed text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none"
        />
        <p className="text-xs leading-relaxed text-ink-soft">
          Cùng định dạng với trình soạn đề: “Câu 1.” / “Question 1.” / “1.”, phương án A–H, đáp án bằng <b>*B.</b>, dòng “Đáp án: B” hoặc bảng
          “ĐÁP ÁN” cuối văn bản; mức độ ghi <b>[NB] [TH] [VD]</b> sau số câu. Lời dẫn chung của nhóm câu được ghép vào đầu từng câu.{" "}
          <a href="/api/exams/template?loai=docx" className="inline-flex items-center gap-1 text-brand-700 hover:underline dark:text-brand-300">
            <Download className="size-3.5" /> File mẫu
          </a>
        </p>
      </section>

      {/* ───── Phải: xem trước ───── */}
      <section className="flex min-h-0 flex-col rounded-xl border border-line bg-surface shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <p className="flex-1 text-sm text-ink">
            Đọc được <span className="font-semibold">{drafts.length}</span> câu
            {invalid > 0 && <span className="text-danger-600"> · {invalid} câu lỗi (bỏ qua)</span>}
          </p>
          <Button onClick={save} disabled={pending || valid.length === 0}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            Lưu {valid.length || ""} câu
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 lg:max-h-[calc(100dvh-16rem)]">
          {error && <Alert variant="danger">{error}</Alert>}
          {allWarnings.length > 0 && (
            <Alert>
              <ul className="list-disc space-y-0.5 pl-5">
                {allWarnings.slice(0, 6).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Alert>
          )}
          {drafts.length === 0 ? (
            <p className="py-16 text-center text-sm text-ink-soft">Dán văn bản hoặc đọc file để xem trước câu hỏi.</p>
          ) : (
            drafts.map((d, i) => (
              <div key={i}>
                <ItemCard
                  no={i + 1}
                  level={d.level}
                  content={d.content || "(trống)"}
                  options={d.options}
                  correctIndex={d.correctIndex}
                  className={cn(d.problem && "border-danger-200 bg-danger-50/40")}
                />
                {d.problem && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-danger-600">
                    <CircleAlert className="size-3.5" /> Câu {i + 1}: {d.problem} — sẽ bỏ qua.
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
