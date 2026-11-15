"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  Bold,
  ChevronLeft,
  CircleHelp,
  Info,
  Italic,
  LoaderCircle,
  SquareSplitHorizontal,
  Underline,
  Upload,
  X,
} from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { BrandLogo, ThemeToggle } from "@/components/theme";
import { cn } from "@/lib/utils";
import { EXAM_DRAFT_KEY, type ExamDraftPayload } from "@/modules/exams/exam-draft";
import { distributePoints, round2 } from "@/modules/exams/exam-points";
import { EXAM_SAMPLES } from "@/modules/exams/exam-samples";
import {
  LEVEL_DB,
  parseExamText,
  questionBlock,
  removeQuestion,
  replaceQuestion,
  setCorrectOption,
  setGroupMeta,
  setLevel,
  setQuestionMeta,
} from "@/modules/exams/exam-text";
import { createExamAction, updateExamAction } from "@/modules/exams/exams.actions";
import { ExamInfoDialog } from "./exam-info-dialog";
import { ExamPreview, type PreviewAction } from "./exam-preview";
import { PointSplitDialog } from "./point-split-dialog";
import { ReplaceQuestionDialog } from "./replace-question-dialog";
import { ExamSettingsForm, type ExamSettingsValue } from "./exam-settings-form";
import { MarkupEditor, type MarkupEditorHandle } from "./markup-editor";

type Props = {
  mode: "create" | "edit";
  /** Khi sửa đề. */
  examId?: string;
  folderId: string | null;
  /** Mở bản nháp đọc từ file (sessionStorage) — trang "Tạo đề mới" vừa chuyển sang. */
  fromFile: boolean;
  initialText: string;
  /** Điểm từng câu (khi sửa đề) — coi như điểm nhập tay. */
  initialPoints?: number[];
  settings: ExamSettingsValue;
  /** Bấm Hủy / quay lại thì về đây. */
  backHref: string;
};

const ACCEPT = ".docx,.xlsx,.tex,.txt";
const DEFAULT_TOTAL = 10;

/**
 * Trình soạn đề 2 cột (bố cục giống các trang tạo đề quen thuộc):
 * phải = văn bản đề (nguồn dữ liệu duy nhất), trái = câu hỏi đọc được từ văn bản, bấm phương án để chọn đáp án.
 * "Tiếp tục" → hộp Thông tin đề → bước Cấu hình chung → lưu.
 */
export function ExamComposer({ mode, examId, folderId, fromFile, initialText, initialPoints, settings, backHref }: Props) {
  const router = useRouter();
  const editorRef = useRef<MarkupEditorHandle>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [ready, setReady] = useState(!fromFile);
  const [title, setTitle] = useState(settings.title);
  const [text, setText] = useState(initialText);
  const [manual, setManual] = useState<(number | null)[]>(initialPoints ?? []);
  const [total, setTotal] = useState(initialPoints ? round2(initialPoints.reduce((s, p) => s + p, 0)) : DEFAULT_TOTAL);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [step, setStep] = useState<"edit" | "config">("edit");
  const [infoOpen, setInfoOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [goto, setGoto] = useState("1");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // ── Bản nháp từ file (trang Tạo đề mới) — đọc 1 lần; KHÔNG xóa để tải lại trang vẫn còn. ──
  useEffect(() => {
    if (!fromFile) return;
    try {
      const raw = sessionStorage.getItem(EXAM_DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as ExamDraftPayload;
        /* eslint-disable react-hooks/set-state-in-effect -- đọc bản nháp 1 lần khi mở trang */
        setText(d.text ?? "");
        setTitle(d.title ?? "");
        setImportWarnings(d.warnings ?? []);
        if (d.points) setManual(d.points);
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      /* sessionStorage bị chặn — mở trình soạn trống */
    }
    setReady(true);
  }, [fromFile]);

  // ── Đề mới: tự lưu nháp vào sessionStorage (tải lại trang không mất). ──
  useEffect(() => {
    if (mode !== "create" || !ready || !text) return;
    const timer = setTimeout(() => {
      try {
        const draft: ExamDraftPayload = { title, text, warnings: importWarnings, points: manual };
        sessionStorage.setItem(EXAM_DRAFT_KEY, JSON.stringify(draft));
        const url = new URL(window.location.href);
        if (url.searchParams.get("tu-file") !== "1") {
          url.searchParams.set("tu-file", "1");
          window.history.replaceState(window.history.state, "", url);
        }
      } catch {
        /* bỏ qua */
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [mode, ready, text, title, importWarnings, manual]);

  // ── Sửa đề: cảnh báo khi rời trang mà chưa lưu. ──
  const dirty = mode === "edit" && text !== initialText;
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const deferredText = useDeferredValue(text);
  const parsed = useMemo(() => parseExamText(deferredText, title), [deferredText, title]);
  const count = parsed.questions.length;
  const dist = useMemo(() => distributePoints(count, manual, total), [count, manual, total]);
  const totalPoints = round2(dist.points.reduce((s, p) => s + p, 0));

  const problems = useMemo(() => {
    const out: string[] = [];
    if (count === 0) out.push("Đề chưa có câu hỏi nào.");
    if (count > 200) out.push("Một đề tối đa 200 câu.");
    parsed.questions.forEach((q, i) => {
      if (!q.options.some((o) => o.isCorrect)) out.push(`Câu ${i + 1}: chưa chọn đáp án đúng.`);
      if (!q.content && q.groupIndex === null) out.push(`Câu ${i + 1}: chưa có nội dung câu hỏi.`);
    });
    if (dist.error) out.push(dist.error);
    return out;
  }, [parsed, count, dist.error]);

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(EXAM_DRAFT_KEY);
    } catch {
      /* bỏ qua */
    }
  };

  function cancel() {
    if (mode === "create" && text.trim() && !confirm("Hủy đề đang soạn? Nội dung chưa lưu sẽ mất.")) return;
    if (mode === "edit" && dirty && !confirm("Bỏ các thay đổi chưa lưu?")) return;
    if (mode === "create") clearDraft();
    router.push(backHref);
  }

  // ── Cột trái ↔ ô văn bản ──
  const onSelectOption = useCallback((qi: number, oi: number) => {
    setText((t) => setCorrectOption(t, parseExamText(t), qi, oi));
  }, []);

  const onPoints = useCallback((qi: number, value: number | null) => {
    setManual((m) => {
      const next = [...m];
      next[qi] = value !== null && Number.isFinite(value) && value > 0 ? value : null;
      return next;
    });
  }, []);

  const onLocate = useCallback((line: number) => editorRef.current?.goToLine(line), []);

  // ── Thao tác trên từng câu / nhóm (cột trái) — đều quy về sửa văn bản ──
  const audioRef = useRef<HTMLInputElement>(null);
  const audioTarget = useRef<{ kind: "q" | "g"; index: number } | null>(null);
  const [audioUploading, setAudioUploading] = useState<string | null>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const flash = (message: string) => {
    setInfo(message);
    setTimeout(() => setInfo((m) => (m === message ? null : m)), 2500);
  };
  const edit = (fn: (t: string, p: ReturnType<typeof parseExamText>) => string) => setText((t) => fn(t, parseExamText(t)));

  async function copyQuestion(qi: number) {
    try {
      await navigator.clipboard.writeText(questionBlock(text, parseExamText(text), qi));
      return true;
    } catch {
      setNotice("Trình duyệt không cho chép vào bộ nhớ tạm.");
      return false;
    }
  }

  function deleteQuestion(qi: number) {
    edit((t, p) => removeQuestion(t, p, qi));
    setManual((m) => m.filter((_, i) => i !== qi));
    setActiveIndex(null);
  }

  async function onAction(a: PreviewAction) {
    switch (a.type) {
      case "groupFixed":
        return edit((t, p) => setGroupMeta(t, p, a.gi, { fixedOrder: !p.groups[a.gi]?.fixedOrder }));
      case "groupAudio":
        audioTarget.current = { kind: "g", index: a.gi };
        return audioRef.current?.click();
      case "audio":
        audioTarget.current = { kind: "q", index: a.qi };
        return audioRef.current?.click();
      case "groupAudioRemove":
        return edit((t, p) => setGroupMeta(t, p, a.gi, { audioId: null }));
      case "audioRemove":
        return edit((t, p) => setQuestionMeta(t, p, a.qi, { audioId: null }));
      case "fixedOptions":
        return edit((t, p) => setQuestionMeta(t, p, a.qi, { fixedOptions: !p.questions[a.qi]?.fixedOptions }));
      case "level":
        return setText((t) => setLevel(t, a.qi, a.level, a.andBelow));
      case "replace":
        return setReplaceIndex(a.qi);
      case "copy":
        if (await copyQuestion(a.qi)) flash(`Đã copy nội dung câu ${a.qi + 1} — dán vào ô văn bản ở vị trí muốn chèn.`);
        return;
      case "cut":
        if (await copyQuestion(a.qi)) {
          deleteQuestion(a.qi);
          flash(`Đã cắt câu ${a.qi + 1} — dán vào ô văn bản ở vị trí mới (nhớ sửa lại số câu).`);
        }
        return;
      case "delete":
        if (confirm(`Xóa câu ${a.qi + 1}? Các câu sau sẽ được đánh số lại.`)) deleteQuestion(a.qi);
        return;
    }
  }

  async function uploadAudio(file: File | undefined) {
    const target = audioTarget.current;
    if (!file || !target) return;
    if (!file.type.startsWith("audio/")) {
      setNotice("Chỉ nhận file âm thanh (mp3, m4a, wav, ogg…).");
      return;
    }
    setNotice(null);
    setAudioUploading(`${target.kind}${target.index}`);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/files", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? "Không tải được file audio.");
      const id = String(json.id);
      edit((t, p) =>
        target.kind === "q" ? setQuestionMeta(t, p, target.index, { audioId: id }) : setGroupMeta(t, p, target.index, { audioId: id }),
      );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setAudioUploading(null);
    }
  }

  const onCaretLine = useCallback(
    (line: number) => {
      let idx = -1;
      parsed.questions.forEach((q, i) => {
        if (q.line <= line) idx = i;
      });
      if (idx < 0 || idx === activeIndex) return;
      setActiveIndex(idx);
      document.getElementById(`cau-${idx + 1}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
    [parsed, activeIndex],
  );

  function goToQuestion() {
    const n = Number(goto);
    if (!Number.isInteger(n) || n < 1 || n > count) {
      setNotice(`Đề có ${count} câu — nhập số từ 1 đến ${count}.`);
      return;
    }
    setNotice(null);
    setActiveIndex(n - 1);
    document.getElementById(`cau-${n}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
    editorRef.current?.goToLine(parsed.questions[n - 1].line);
  }

  async function uploadFile(file: File | undefined) {
    if (!file) return;
    if (text.trim() && !confirm(`Thay nội dung đang soạn bằng đề trong file “${file.name}”?`)) return;
    setUploading(true);
    setNotice(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/exams/import", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? "Không đọc được file.");
      const d = json as ExamDraftPayload;
      setText(d.text);
      setImportWarnings(d.warnings);
      setManual(d.points ?? []);
      if (!title.trim()) setTitle(d.title);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function applySample(sample: string) {
    if (text.trim() && !confirm("Thay nội dung đang soạn bằng nội dung mẫu?")) return;
    setText(sample);
    setManual([]);
    setImportWarnings([]);
  }

  async function save(v: ExamSettingsValue): Promise<string | null> {
    const latest = parseExamText(text, v.title);
    const points = distributePoints(latest.questions.length, manual, total);
    if (points.error) return points.error;
    const payload = {
      title: v.title,
      description: v.description,
      durationMinutes: v.durationMinutes,
      grade: v.grade,
      subject: v.subject,
      purpose: v.purpose,
      priceMode: v.priceMode,
      price: v.price,
      priceNote: v.priceNote,
      groups: latest.groups.map((g) => ({ content: g.content, fixedOrder: g.fixedOrder, audioFileId: g.audioId })),
      questions: latest.questions.map((q, i) => ({
        content: q.content,
        points: points.points[i],
        groupIndex: q.groupIndex,
        level: q.level ? LEVEL_DB[q.level] : null,
        fixedOptions: q.fixedOptions,
        audioFileId: q.audioId,
        options: q.options,
      })),
    };
    const res =
      mode === "edit" && examId
        ? await updateExamAction({ ...payload, id: examId })
        : await createExamAction({ ...payload, folderId });
    if (!res.ok) return res.message;
    if (mode === "create") {
      clearDraft();
      router.push(`/de-thi/${res.data.id}/hoan-tat`);
    } else {
      router.push(`/de-thi/${res.data.id}`);
    }
    return null;
  }

  if (!ready) {
    return <p className="py-24 text-center text-sm text-ink-soft">Đang mở đề…</p>;
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-canvas">
      {/* ── Thanh trên ── */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-4">
        <BrandLogo className="hidden text-lg sm:inline-flex" />
        <button
          type="button"
          onClick={() => (step === "config" ? setStep("edit") : cancel())}
          aria-label="Quay lại"
          className="ml-2 rounded p-1.5 text-ink-soft hover:bg-muted hover:text-ink"
        >
          <ChevronLeft className="size-5" />
        </button>
        <p className="ml-2 min-w-0 truncate text-sm text-ink sm:ml-8" title={title}>
          {title || "Đề chưa đặt tên"}
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {step === "edit" && (
            <>
              <Button variant="ghost" onClick={cancel} className="text-brand-700 dark:text-brand-300">
                Hủy
              </Button>
              <Button onClick={() => setInfoOpen(true)} className="px-5">
                Tiếp tục
              </Button>
            </>
          )}
          <ThemeToggle className="ml-2" />
        </div>
      </header>

      {step === "config" ? (
        <div className="flex-1 overflow-y-auto px-4 py-8">
          <ExamSettingsForm
            initial={{ ...settings, title: title || settings.title, description: settings.description || parsed.description }}
            submitLabel={mode === "edit" ? "Lưu đề" : "Tạo đề"}
            onCancel={() => setStep("edit")}
            onSubmit={save}
          />
        </div>
      ) : (
        <>
          {/* ── Thanh công cụ ── */}
          <div className="flex shrink-0 flex-wrap items-center border-b border-line bg-surface text-sm lg:h-14 lg:flex-nowrap">
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 px-4 py-2 lg:w-1/2">
              <Button size="sm" onClick={() => setSplitOpen(true)}>
                <SquareSplitHorizontal className="size-4" /> Chia điểm
              </Button>
              <button type="button" onClick={() => setInfoOpen(true)} className="flex items-center gap-1.5 text-ink hover:text-brand-700">
                <Info className="size-4" /> Thông tin đề
              </button>
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  goToQuestion();
                }}
              >
                <label htmlFor="goto" className="flex items-center gap-1.5 text-ink">
                  <ArrowUpDown className="size-4" /> Đi đến câu
                </label>
                <input
                  id="goto"
                  inputMode="numeric"
                  value={goto}
                  onChange={(e) => setGoto(e.target.value.replace(/\D/g, ""))}
                  className="h-8 w-12 rounded-md border border-line bg-surface px-2 text-center text-ink focus:border-brand-500 focus:outline-none"
                />
                <Button type="submit" size="sm">
                  Đến
                </Button>
              </form>
            </div>
            <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-line px-3 py-2 lg:w-1/2 lg:border-l">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-ink hover:bg-muted disabled:opacity-60"
              >
                {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload
              </button>
              <span className="mx-1 h-5 w-px bg-line" />
              {(
                [
                  ["b", Bold, "In đậm"],
                  ["i", Italic, "In nghiêng"],
                  ["u", Underline, "Gạch chân"],
                ] as const
              ).map(([tag, Icon, label]) => (
                <button
                  key={tag}
                  type="button"
                  title={`${label} — bôi đen chữ rồi bấm`}
                  aria-label={label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => editorRef.current?.wrapSelection(tag)}
                  className="rounded-md p-1.5 text-ink hover:bg-muted"
                >
                  <Icon className="size-4" />
                </button>
              ))}
              <span className="mx-1 h-5 w-px bg-line" />
              <button
                type="button"
                onClick={() => setHelpOpen((o) => !o)}
                aria-expanded={helpOpen}
                className={cn("flex items-center gap-1.5 rounded-md px-2 py-1.5 text-ink hover:bg-muted", helpOpen && "bg-muted")}
              >
                <CircleHelp className="size-4" /> Hướng dẫn
              </button>
            </div>
          </div>

          {/* ── 2 cột ── */}
          <div className="grid min-h-0 flex-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1">
            <div ref={previewRef} className="min-h-0 overflow-y-auto border-b border-line lg:border-r lg:border-b-0">
              {(notice || info || importWarnings.length > 0) && (
                <div className="sticky top-0 z-10 space-y-2 bg-canvas px-3 pt-3">
                  {notice && <Alert variant="danger">{notice}</Alert>}
                  {info && <Alert variant="success">{info}</Alert>}
                  {importWarnings.length > 0 && (
                    <Alert className="relative pr-9">
                      <button
                        type="button"
                        onClick={() => setImportWarnings([])}
                        aria-label="Ẩn lưu ý"
                        className="absolute top-2.5 right-2.5 rounded p-0.5 hover:bg-brand-100 dark:hover:bg-brand-900"
                      >
                        <X className="size-4" />
                      </button>
                      <p className="font-medium">Lưu ý khi đọc file:</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">
                        {importWarnings.slice(0, 6).map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    </Alert>
                  )}
                </div>
              )}
              <ExamPreview
                parsed={parsed}
                points={dist.points}
                manual={manual}
                activeIndex={activeIndex}
                onPoints={onPoints}
                onSelectOption={onSelectOption}
                onLocate={onLocate}
                uploading={audioUploading}
                onAction={onAction}
              />
            </div>

            <div className="flex min-h-0 flex-col bg-surface">
              {helpOpen && <FormatHelp onClose={() => setHelpOpen(false)} />}
              <MarkupEditor
                ref={editorRef}
                value={text}
                onChange={setText}
                lineKinds={parsed.lineKinds}
                onCaretLine={onCaretLine}
                placeholder="Gõ hoặc dán đề vào đây, hoặc bấm Upload / chọn Nội dung mẫu bên dưới…"
                className="min-h-0 flex-1"
              />
              <p className="shrink-0 border-t border-line px-4 py-2 text-sm text-ink-soft">
                Nội dung mẫu:{" "}
                {EXAM_SAMPLES.map((s, i) => (
                  <span key={s.label}>
                    {i > 0 && <span className="mx-1.5 text-ink-faint">|</span>}
                    <button type="button" onClick={() => applySample(s.text)} className="text-brand-700 hover:underline dark:text-brand-300">
                      {s.label}
                    </button>
                  </span>
                ))}
              </p>
            </div>
          </div>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          void uploadFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <ExamInfoDialog
        open={infoOpen}
        parsed={parsed}
        totalPoints={totalPoints}
        problems={problems}
        continueLabel="Tiếp tục"
        onClose={() => setInfoOpen(false)}
        onContinue={() => {
          setInfoOpen(false);
          setStep("config");
        }}
        onGoto={(i) => {
          setInfoOpen(false);
          setGoto(String(i + 1));
          setActiveIndex(i);
          document.getElementById(`cau-${i + 1}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
          editorRef.current?.goToLine(parsed.questions[i].line);
        }}
      />

      <PointSplitDialog
        open={splitOpen}
        parsed={parsed}
        points={dist.points}
        onClose={() => setSplitOpen(false)}
        onApply={(next) => {
          setManual(next);
          setTotal(round2(next.reduce((x, y) => x + y, 0)));
        }}
      />

      <ReplaceQuestionDialog
        question={replaceIndex !== null ? (parsed.questions[replaceIndex] ?? null) : null}
        groupContent={
          replaceIndex !== null && parsed.questions[replaceIndex]?.groupIndex != null
            ? parsed.groups[parsed.questions[replaceIndex].groupIndex!].content
            : null
        }
        grade={settings.grade}
        subject={settings.subject}
        examId={examId ?? null}
        onClose={() => setReplaceIndex(null)}
        onPick={(c) => {
          const qi = replaceIndex;
          setReplaceIndex(null);
          if (qi === null) return;
          edit((t, p) => replaceQuestion(t, p, qi, c));
          flash(`Đã đổi câu ${qi + 1}.`);
        }}
      />

      <input
        ref={audioRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          void uploadAudio(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Bảng hướng dẫn định dạng văn bản đề (bật/tắt bằng nút "Hướng dẫn"). */
function FormatHelp({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ["Câu 1. Nội dung…  /  1. Nội dung…", "Bắt đầu một câu hỏi (số câu tăng dần)"],
    ["A. …   B. …   C. …   D. …", "Phương án — mỗi dòng 1 cái, hoặc cách nhau bằng Tab"],
    ["*B. …   hoặc   Đáp án: B", "Đánh dấu đáp án đúng (hoặc bấm phương án ở cột trái)"],
    ["ĐÁP ÁN  rồi  1.C | 2.A | …", "Bảng đáp án cuối đề"],
    ["Dòng chữ đứng trước câu hỏi", "Tiêu đề nhóm: lời dẫn / đoạn văn dùng chung cho các câu sau"],
    ["<b>đậm</b> <i>nghiêng</i> <u>gạch chân</u>", "Định dạng chữ — bôi đen rồi bấm B / I / U"],
    ["Câu 1. [NB] [cố định] [audio:…] …", "Mức độ NB/TH/VD, cố định đáp án, file nghe — đặt bằng nút ở cột trái"],
    ["[cố định nhóm] [audio:…]", "Dòng đầu nhóm: giữ thứ tự câu trong nhóm khi đảo đề, file nghe của nhóm"],
    ["Lời giải …", "Phần giải thích — được bỏ qua"],
  ];
  return (
    <div className="relative shrink-0 border-b border-line bg-muted/60 px-4 py-3 text-sm">
      <button type="button" onClick={onClose} aria-label="Đóng hướng dẫn" className="absolute top-2 right-2 rounded p-1 text-ink-soft hover:bg-muted">
        <X className="size-4" />
      </button>
      <table className="w-full">
        <tbody>
          {rows.map(([code, desc]) => (
            <tr key={code}>
              <td className="py-0.5 pr-4 font-mono text-[12px] whitespace-nowrap text-brand-700 dark:text-brand-300">{code}</td>
              <td className="py-0.5 text-ink-soft">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
