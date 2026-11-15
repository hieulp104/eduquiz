"use client";

import { forwardRef, useImperativeHandle, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LineKind } from "@/modules/exams/exam-text";

export type MarkupEditorHandle = {
  /** Đưa con trỏ tới đầu dòng `line` (0-based) và cuộn tới đó. */
  goToLine: (line: number) => void;
  /** Bọc đoạn đang chọn bằng thẻ <b>/<i>/<u> (giữ được Ctrl+Z). */
  wrapSelection: (tag: "b" | "i" | "u") => void;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  lineKinds: LineKind[];
  /** Dòng chứa con trỏ thay đổi (0-based). */
  onCaretLine?: (line: number) => void;
  placeholder?: string;
  className?: string;
};

// Lớp chữ màu (phía dưới) và textarea trong suốt (phía trên) PHẢI cùng font, cỡ, dòng, lề, tab
// thì chữ mới chồng khít nhau — sửa ở đây là sửa cả hai.
const TEXT = "font-mono text-[13px] leading-5 whitespace-pre-wrap break-words [tab-size:4]";
const PAD_X = "pl-14 pr-4";

/** Thẻ định dạng <b> <i> <u> và thẻ câu hỏi [NB] [cố định] [audio:id]… */
const TAG_RE = /<\/?[biu]>|\[(?:NB|TH|VD|cố định(?: nhóm)?|audio:[A-Za-z0-9_-]+)\]/gi;
const QUESTION_PREFIX_RE = /^(\s*(?:(?:Câu|Bài|Question)\s*\d+\s*[:.)]?|\d{1,3}\s*[.)]))/i;
const LABEL_RE = /(^|\s)(\*?[A-H]\s*[.)])/g;

const KIND_CLASS: Partial<Record<LineKind, string>> = {
  group: "text-warning-700 dark:text-amber-300",
  key: "text-danger-600 dark:text-red-400",
  answer: "text-success-700 dark:text-emerald-400",
  part: "text-brand-700 dark:text-brand-300",
  solution: "text-ink-faint",
  ignored: "text-ink-faint",
};

/** Tô nhãn đáp án "A." / số câu trong một đoạn chữ thường. */
function labels(text: string, kind: LineKind, atLineStart: boolean, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let n = 0;
  if (kind === "question" && atLineStart) {
    const m = rest.match(QUESTION_PREFIX_RE);
    if (m) {
      out.push(<span key={`${key}q`} className="text-brand-700 dark:text-brand-300">{m[1]}</span>);
      rest = rest.slice(m[1].length);
      if (!/^\s*\*?A\s*[.)]/.test(rest)) return [...out, rest];
    }
  }
  if (kind !== "option" && kind !== "question") return [...out, rest];
  let last = 0;
  for (const m of rest.matchAll(LABEL_RE)) {
    const start = m.index + m[1].length;
    out.push(rest.slice(last, start));
    out.push(
      <span key={`${key}l${n++}`} className="text-brand-600 dark:text-brand-300">
        {m[2]}
      </span>,
    );
    last = start + m[2].length;
  }
  out.push(rest.slice(last));
  return out;
}

/** Một dòng → các đoạn tô màu: thẻ mờ, chữ có định dạng màu đỏ, nhãn câu/đáp án màu xanh. */
function highlight(line: string, kind: LineKind): ReactNode {
  if (kind === "key" || kind === "solution" || kind === "ignored") return line;
  const out: ReactNode[] = [];
  let depth = 0;
  let last = 0;
  let i = 0;
  const pushText = (text: string, start: number) => {
    if (!text) return;
    if (depth > 0) out.push(<span key={i++} className="text-danger-600 dark:text-red-400">{text}</span>);
    else out.push(...labels(text, kind, start === 0, String(i++)));
  };
  for (const m of line.matchAll(TAG_RE)) {
    pushText(line.slice(last, m.index), last);
    if (m[0][0] === "[") {
      out.push(<span key={i++} className="text-success-700 dark:text-emerald-400">{m[0]}</span>);
    } else {
      out.push(<span key={i++} className="text-ink-soft">{m[0]}</span>);
      depth = Math.max(0, depth + (m[0][1] === "/" ? -1 : 1));
    }
    last = m.index + m[0].length;
  }
  pushText(line.slice(last), last);
  return out;
}

/** Ô soạn đề: textarea + số dòng + tô màu theo loại dòng (bộ đọc exam-text.ts trả về). */
export const MarkupEditor = forwardRef<MarkupEditorHandle, Props>(function MarkupEditor(
  { value, onChange, lineKinds, onCaretLine, placeholder, className },
  ref,
) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lines = value.split("\n");

  const reportCaret = () => {
    const el = areaRef.current;
    if (!el || !onCaretLine) return;
    onCaretLine(el.value.slice(0, el.selectionStart).split("\n").length - 1);
  };

  useImperativeHandle(ref, () => ({
    goToLine(line) {
      const el = areaRef.current;
      const box = scrollRef.current;
      if (!el || !box) return;
      const all = el.value.split("\n");
      const pos = all.slice(0, line).reduce((s, l) => s + l.length + 1, 0);
      el.focus({ preventScroll: true });
      el.setSelectionRange(pos, pos);
      const row = box.querySelector<HTMLElement>(`[data-line="${line}"]`);
      if (row) box.scrollTo({ top: Math.max(0, row.offsetTop - 80), behavior: "smooth" });
    },
    wrapSelection(tag) {
      const el = areaRef.current;
      if (!el) return;
      const { selectionStart: s, selectionEnd: e } = el;
      const selected = el.value.slice(s, e);
      const wrapped = `<${tag}>${selected}</${tag}>`;
      el.focus();
      // execCommand giữ lịch sử Ctrl+Z của textarea; trình duyệt không hỗ trợ thì ghi thẳng.
      const done = typeof document.execCommand === "function" && document.execCommand("insertText", false, wrapped);
      if (!done) onChange(el.value.slice(0, s) + wrapped + el.value.slice(e));
      const caret = s + tag.length + 2;
      requestAnimationFrame(() => el.setSelectionRange(caret, caret + selected.length));
    },
  }));

  return (
    <div ref={scrollRef} className={cn("relative overflow-auto bg-surface", className)}>
      <div className="relative min-h-full">
        <div aria-hidden className={cn(TEXT, "pointer-events-none py-3 text-ink")}>
          {lines.map((line, i) => (
            <div key={i} data-line={i} className={cn("relative min-h-5", PAD_X, KIND_CLASS[lineKinds[i]])}>
              <span className="absolute left-0 w-10 text-right text-ink-faint select-none">{i + 1}</span>
              {line ? highlight(line, lineKinds[i] ?? "ignored") : "​"}
            </div>
          ))}
          {!value && placeholder && (
            <div className={cn("absolute top-3 left-0 text-ink-faint", PAD_X)}>{placeholder}</div>
          )}
        </div>
        <textarea
          ref={areaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onSelect={reportCaret}
          spellCheck={false}
          aria-label="Nội dung đề thi"
          className={cn(
            TEXT,
            PAD_X,
            "absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent py-3 text-transparent caret-ink outline-none selection:bg-brand-200/70 dark:selection:bg-brand-800/70",
          )}
        />
      </div>
    </div>
  );
});
