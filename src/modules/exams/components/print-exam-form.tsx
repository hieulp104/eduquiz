"use client";

import { useState } from "react";
import { Info, LoaderCircle, Printer } from "lucide-react";
import { Alert, Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { MAX_VERSIONS, SHEETS, defaultCodes, parseCodes, printOptionsSchema, type SheetKind } from "@/modules/exams/exam-print.types";

type Props = {
  examId: string;
  title: string;
  questionCount: number;
  /** Số phương án nhiều nhất của 1 câu (4 → A–D). */
  optionCount: number;
};

const CARD = "rounded-xl border border-line bg-surface px-5 py-5 shadow-sm sm:px-6";
const LETTERS = "ABCDEFGH";

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-brand-600" : "bg-ink-faint/60")}
    >
      <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
    </button>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid items-center gap-x-8 gap-y-2 border-t border-line py-4 first:border-0 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="mt-1 text-xs leading-relaxed text-ink-soft">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Hình minh họa mẫu phiếu (vẽ bằng HTML — phiếu thật nằm trong file .docx). */
function SheetPreview({ kind, questionCount, optionCount }: { kind: SheetKind; questionCount: number; optionCount: number }) {
  if (kind === "NONE") {
    return <p className="py-16 text-center text-sm text-ink-soft">Không in phiếu trả lời — học sinh khoanh trực tiếp trên đề.</p>;
  }
  const shown = Math.min(questionCount, kind === "BUBBLE" ? 40 : 20);
  const letters = LETTERS.slice(0, optionCount).split("");
  return (
    // Tờ giấy luôn nền trắng chữ đen (cả ở chế độ tối) vì là hình minh họa bản in.
    <div className="mx-auto aspect-[210/297] w-full max-w-[340px] overflow-hidden border border-line bg-white p-4 text-[8px] leading-tight text-black shadow-sm">
      <p className="text-center text-[10px] font-bold">PHIẾU TRẢ LỜI TRẮC NGHIỆM</p>
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="space-y-1.5">
          <p>Họ và tên: ..............................</p>
          <p>Lớp: ............ Ngày thi: ..../..../......</p>
        </div>
        {[
          ["Số báo danh", 6],
          ["Mã đề", 4],
        ].map(([label, n]) => (
          <div key={label} className="border border-black text-center">
            <p className="border-b border-black px-1 font-bold">{label}</p>
            <div className="flex">
              {Array.from({ length: n as number }, (_, i) => (
                <span key={i} className="size-3 border-r border-black last:border-0" />
              ))}
            </div>
          </div>
        ))}
      </div>
      {kind === "BUBBLE" ? (
        <div className="mt-3 grid grid-flow-col grid-cols-4 gap-x-1 gap-y-1" style={{ gridTemplateRows: `repeat(${Math.ceil(shown / 4)}, minmax(0, 1fr))` }}>
          {Array.from({ length: shown }, (_, i) => (
            <p key={i} className="flex items-center gap-1">
              <b className="w-3 text-right">{i + 1}</b>
              {letters.map((l) => (
                <span key={l} className="flex size-2 items-center justify-center rounded-full border border-black text-[5px]">
                  {l}
                </span>
              ))}
            </p>
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {Array.from({ length: Math.ceil(shown / 10) }, (_, r) => (
            <div key={r} className="grid grid-cols-10 border-t border-l border-black text-center">
              {Array.from({ length: 10 }, (_, c) => (
                <div key={c} className="border-r border-b border-black">
                  <p className="border-b border-black font-bold">{r * 10 + c < shown ? r * 10 + c + 1 : ""}</p>
                  <p className="h-4" />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {questionCount > shown && <p className="mt-2 text-center text-[7px] text-neutral-500">… đủ {questionCount} câu trong file in</p>}
    </div>
  );
}

/** "In đề + phiếu trả lời": số đề đảo, mã đề, mẫu phiếu → tải file .docx. */
export function PrintExamForm({ examId, title, questionCount, optionCount }: Props) {
  const [count, setCount] = useState(1);
  const [custom, setCustom] = useState(false);
  const [codesText, setCodesText] = useState("");
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [sheet, setSheet] = useState<SheetKind>("BUBBLE");
  const [includeKey, setIncludeKey] = useState(true);
  const [extra, setExtra] = useState(false);
  const [school, setSchool] = useState("");
  const [examName, setExamName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const safeCount = Number.isInteger(count) && count >= 1 && count <= MAX_VERSIONS ? count : 1;

  async function download(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = printOptionsSchema.safeParse({
      count,
      codes: custom ? parseCodes(codesText) : [],
      shuffleQuestions,
      shuffleOptions,
      sheet,
      includeKey,
      school: extra ? school : "",
      examName: extra ? examName : "",
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Tùy chọn in không hợp lệ.");
      return;
    }
    const o = parsed.data;
    const query = new URLSearchParams({
      "so-de": String(o.count),
      "ma-de": o.codes.join(","),
      "dao-cau": o.shuffleQuestions ? "1" : "0",
      "dao-dap-an": o.shuffleOptions ? "1" : "0",
      phieu: o.sheet,
      "dap-an": o.includeKey ? "1" : "0",
      truong: o.school,
      "ky-thi": o.examName,
    });
    setBusy(true);
    try {
      const res = await fetch(`/api/exams/${examId}/print?${query}`);
      if (!res.ok) throw new Error((await res.text()) || "Không tạo được file in.");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "de-thi"} - ${o.count} ma de.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={download} className="mx-auto w-full max-w-[1000px] space-y-4">
      <header className={CARD}>
        <h1 className="text-[15px] font-medium text-ink">IN ĐỀ - CÓ PHIẾU TRẢ LỜI RIÊNG</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Tên đề thi: {title} · {questionCount} câu
        </p>
      </header>

      <section className={CARD}>
        <h2 className="mb-4 border-b border-line pb-4 text-[15px] font-medium text-ink">Cấu hình chung</h2>
        <Row label="Số lượng đề đảo" hint={`Mỗi mã đề có thứ tự câu hỏi / đáp án riêng. Tối đa ${MAX_VERSIONS} đề.`}>
          <Input
            type="number"
            min={1}
            max={MAX_VERSIONS}
            aria-label="Số lượng đề đảo"
            value={Number.isFinite(count) ? count : ""}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </Row>
        <Row label="Nhập mã đề tuỳ chỉnh" hint="Tắt: mã đề tự đánh 101, 102, … In lại với cùng mã đề sẽ ra đúng đề cũ.">
          <div className="space-y-2">
            <Toggle checked={custom} onChange={setCustom} label="Nhập mã đề tuỳ chỉnh" />
            {custom ? (
              <Input
                aria-label="Danh sách mã đề"
                value={codesText}
                onChange={(e) => setCodesText(e.target.value)}
                placeholder={`Nhập ${safeCount} mã đề, cách nhau bằng dấu phẩy — VD: ${defaultCodes(Math.min(safeCount, 3)).join(", ")}`}
              />
            ) : (
              <p className="text-xs text-ink-soft">Mã đề: {defaultCodes(safeCount).join(", ")}</p>
            )}
          </div>
        </Row>
        <Row label="Đảo câu hỏi" hint="Nhóm câu vẫn đi liền khối và giữ vị trí; nhóm “cố định” giữ nguyên thứ tự câu.">
          <Toggle checked={shuffleQuestions} onChange={setShuffleQuestions} label="Đảo câu hỏi" />
        </Row>
        <Row label="Đảo đáp án" hint="Câu “cố định đáp án” giữ nguyên thứ tự A, B, C, D.">
          <Toggle checked={shuffleOptions} onChange={setShuffleOptions} label="Đảo đáp án" />
        </Row>
      </section>

      <section className={CARD}>
        <h2 className="mb-4 border-b border-line pb-4 text-[15px] font-medium text-ink">Chọn mẫu phiếu trả lời</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm text-ink-soft">Mẫu (có SBD + Mã đề) — tự chia theo {questionCount} câu của đề</legend>
            {SHEETS.map((s) => (
              <label key={s.value} className={cn("flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5", sheet === s.value ? "border-brand-500 bg-muted" : "border-line hover:bg-muted")}>
                <input type="radio" name="sheet" checked={sheet === s.value} onChange={() => setSheet(s.value)} className="mt-0.5 size-4 accent-brand-600" />
                <span>
                  <span className="block text-sm font-medium text-ink">{s.label}</span>
                  <span className="block text-xs text-ink-soft">{s.hint}</span>
                </span>
              </label>
            ))}
            <p className="flex gap-2 pt-2 text-xs leading-relaxed text-ink-soft">
              <Info className="mt-0.5 size-4 shrink-0" />
              Phiếu dùng để in và chấm tay theo trang đáp án. Hệ thống chưa chấm tự động từ ảnh chụp / bản scan phiếu.
            </p>
          </fieldset>
          <div className="rounded-lg border border-line p-4">
            <p className="mb-3 text-center text-sm font-medium text-ink">Xem trước mẫu phiếu</p>
            <SheetPreview kind={sheet} questionCount={questionCount} optionCount={optionCount} />
          </div>
        </div>
      </section>

      <section className={CARD}>
        <h2 className="mb-4 border-b border-line pb-4 text-[15px] font-medium text-ink">Cài đặt thêm</h2>
        <Row label="Kèm trang đáp án" hint="Trang cuối file: bảng đáp án của từng mã đề để chấm bài.">
          <Toggle checked={includeKey} onChange={setIncludeKey} label="Kèm trang đáp án" />
        </Row>
        <Row label="Thêm thông tin" hint="Tên trường và tên kỳ thi in ở góc trái đầu mỗi đề.">
          <div className="space-y-2">
            <Toggle checked={extra} onChange={setExtra} label="Thêm thông tin" />
            {extra && (
              <>
                <Input aria-label="Tên trường" value={school} maxLength={120} placeholder="Tên trường — VD: Trường THCS Nguyễn Du" onChange={(e) => setSchool(e.target.value)} />
                <Input aria-label="Tên kỳ thi" value={examName} maxLength={120} placeholder="Tên kỳ thi — VD: Kiểm tra giữa kỳ I, năm học 2026 – 2027" onChange={(e) => setExamName(e.target.value)} />
              </>
            )}
          </div>
        </Row>
      </section>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="flex justify-end pb-2">
        <Button type="submit" disabled={busy}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Printer className="size-4" />}
          In đề + Phiếu
        </Button>
      </div>
    </form>
  );
}
