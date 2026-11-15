"use client";

import { memo } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  EllipsisVertical,
  LoaderCircle,
  Paperclip,
  Pin,
  RefreshCw,
  Scissors,
  Tag,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Dropdown, DropdownItem, DropdownSeparator, RichInline } from "@/components/ui";
import { cn, formatScore } from "@/lib/utils";
import { LETTERS, LEVELS, type Level, type ParsedExam } from "@/modules/exams/exam-text";

/** Thao tác trên cột xem trước — trình soạn đề đổi lại văn bản tương ứng. */
export type PreviewAction =
  | { type: "groupFixed" | "groupAudio" | "groupAudioRemove"; gi: number }
  | { type: "audio" | "audioRemove" | "fixedOptions" | "copy" | "cut" | "delete" | "replace"; qi: number }
  | { type: "level"; qi: number; level: Level | null; andBelow: boolean };

type Props = {
  parsed: ParsedExam;
  /** Điểm thực tế từng câu (đã chia). */
  points: number[];
  /** Điểm nhập tay (null = tự chia). */
  manual: (number | null)[];
  activeIndex: number | null;
  /** Đang tải audio cho "g<gi>" / "q<qi>". */
  uploading: string | null;
  onPoints: (index: number, value: number | null) => void;
  onSelectOption: (index: number, option: number) => void;
  /** Bấm số câu → nhảy tới dòng tương ứng trong ô văn bản. */
  onLocate: (line: number) => void;
  onAction: (action: PreviewAction) => void;
};

const box = "rounded border border-line bg-surface";
const toolBtn = "flex items-center gap-1 rounded px-1 py-0.5 text-brand-700 hover:bg-muted dark:text-brand-300";

function AudioPlayer({ id, onRemove }: { id: string; onRemove: () => void }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <audio controls preload="none" src={`/api/files/${id}`} className="h-9 w-full max-w-md" />
      <button type="button" onClick={onRemove} aria-label="Bỏ file audio" title="Bỏ file audio" className="rounded p-1 text-ink-soft hover:bg-muted">
        <X className="size-4" />
      </button>
    </div>
  );
}

/** Cột trái của trình soạn đề: nhóm câu + câu hỏi đọc từ văn bản; bấm phương án để chọn đáp án đúng. */
export const ExamPreview = memo(function ExamPreview({
  parsed,
  points,
  manual,
  activeIndex,
  uploading,
  onPoints,
  onSelectOption,
  onLocate,
  onAction,
}: Props) {
  const { questions, groups } = parsed;
  if (questions.length === 0) {
    return (
      <div className="px-6 py-16 text-center text-sm text-ink-soft">
        <p className="font-medium text-ink">Chưa có câu hỏi nào</p>
        <p className="mt-1">
          Gõ hoặc dán đề vào ô bên phải — mỗi câu bắt đầu bằng “Câu 1.” hoặc “1.”, phương án “A. … B. …”.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-3 py-3">
      {questions.map((q, qi) => {
        const gi = q.groupIndex;
        const g = gi !== null ? groups[gi] : null;
        const showGroup = g && (qi === 0 || questions[qi - 1].groupIndex !== gi);
        const noAnswer = !q.options.some((o) => o.isCorrect);
        return (
          <div key={qi} className="space-y-3">
            {showGroup && (
              <section className="rounded-md border border-line bg-surface px-7 py-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <button
                    type="button"
                    onClick={() => onLocate(g.line)}
                    title="Tới dòng của nhóm trong ô văn bản"
                    className={cn(box, "px-2.5 py-1 font-medium text-ink hover:border-brand-500")}
                  >
                    Tiêu đề nhóm
                  </button>
                  <button
                    type="button"
                    onClick={() => onAction({ type: "groupFixed", gi: gi! })}
                    aria-pressed={g.fixedOrder}
                    title="Khi đảo câu hỏi, các câu trong nhóm vẫn giữ nguyên thứ tự"
                    className={cn(
                      "flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted",
                      g.fixedOrder ? "font-medium text-brand-600 dark:text-brand-300" : "text-brand-700 dark:text-brand-300",
                    )}
                  >
                    {g.fixedOrder && <Pin className="size-3.5" />} Cố định câu hỏi trong nhóm
                  </button>
                  <button
                    type="button"
                    onClick={() => onAction({ type: "groupAudio", gi: gi! })}
                    disabled={uploading === `g${gi}`}
                    title="Chọn file nghe (mp3, m4a, wav…) từ máy"
                    className="flex items-center gap-1 rounded-full border border-dashed border-brand-300 px-3 py-0.5 text-brand-700 hover:bg-muted disabled:opacity-60 dark:text-brand-300"
                  >
                    {uploading === `g${gi}` ? <LoaderCircle className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />} Audio
                  </button>
                </div>
                {g.audioId && <AudioPlayer id={g.audioId} onRemove={() => onAction({ type: "groupAudioRemove", gi: gi! })} />}
                {g.content && (
                  <div className={cn(box, "mt-2 px-2 py-1.5")}>
                    <RichInline text={g.content} className="block text-sm leading-relaxed text-ink" />
                  </div>
                )}
              </section>
            )}

            <article
              id={`cau-${qi + 1}`}
              className={cn(
                "scroll-mt-3 rounded-md border bg-surface px-7 py-4 transition-colors",
                activeIndex === qi ? "border-brand-500" : "border-line",
              )}
            >
              <div className="flex flex-wrap items-center gap-y-1 text-sm [&>*+*]:border-l [&>*+*]:border-line [&>*+*]:px-2.5">
                <div className="pr-3">
                  <button
                    type="button"
                    onClick={() => onLocate(q.line)}
                    title="Tới dòng của câu này trong ô văn bản"
                    className={cn(box, "min-w-8 px-2 py-1 font-medium text-brand-700 hover:border-brand-500 dark:text-brand-300")}
                  >
                    {qi + 1}.
                  </button>
                </div>
                <label className="!border-l-0 !px-0">
                  <span className="sr-only">Điểm câu {qi + 1}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.05}
                    value={manual[qi] ?? ""}
                    placeholder={`Nhập điểm (${formatScore(points[qi])})`}
                    onChange={(e) => onPoints(qi, e.target.value === "" ? null : Number(e.target.value))}
                    className="h-8 w-36 rounded-md border border-transparent bg-transparent px-1.5 text-sm text-ink placeholder:text-brand-600 hover:border-line focus:border-brand-500 focus:outline-none dark:placeholder:text-brand-300"
                  />
                </label>
                <span>
                  <button
                    type="button"
                    onClick={() => onAction({ type: "audio", qi })}
                    disabled={uploading === `q${qi}`}
                    title="Chọn file nghe từ máy"
                    className={cn(toolBtn, "disabled:opacity-60")}
                  >
                    {uploading === `q${qi}` ? <LoaderCircle className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />} Audio
                  </button>
                </span>
                <span className="flex items-center gap-1 text-ink-faint" title="Loại câu hỏi — hiện hỗ trợ trắc nghiệm 1 đáp án">
                  Trắc nghiệm <ChevronDown className="size-4" />
                </span>
                <Dropdown
                  label="Mức độ"
                  triggerClassName={cn(toolBtn, !q.level && "text-ink-soft")}
                  trigger={
                    <>
                      <Tag className="size-4" />
                      {q.level && <span className="text-xs font-medium">{LEVELS[q.level]}</span>}
                    </>
                  }
                >
                  {(Object.keys(LEVELS) as Level[]).map((l) => (
                    <DropdownItem key={l} active={q.level === l} onSelect={() => onAction({ type: "level", qi, level: l, andBelow: false })}>
                      {LEVELS[l]}
                    </DropdownItem>
                  ))}
                  <DropdownSeparator />
                  {(Object.keys(LEVELS) as Level[]).map((l) => (
                    <DropdownItem key={`b${l}`} onSelect={() => onAction({ type: "level", qi, level: l, andBelow: true })}>
                      {LEVELS[l]} - Cho câu này và các câu bên dưới
                    </DropdownItem>
                  ))}
                  {q.level && (
                    <>
                      <DropdownSeparator />
                      <DropdownItem onSelect={() => onAction({ type: "level", qi, level: null, andBelow: false })}>Bỏ mức độ</DropdownItem>
                    </>
                  )}
                </Dropdown>
                <span>
                  <button type="button" onClick={() => onAction({ type: "replace", qi })} className={toolBtn}>
                    <RefreshCw className="size-3.5" /> Đổi câu khác
                  </button>
                </span>
                <Dropdown label="Thao tác khác" triggerClassName={toolBtn} trigger={<EllipsisVertical className="size-4" />}>
                  <DropdownItem icon={<Pin className="size-4" />} active={q.fixedOptions} onSelect={() => onAction({ type: "fixedOptions", qi })}>
                    {q.fixedOptions ? "Bỏ cố định đáp án" : "Cố định Đáp án"}
                  </DropdownItem>
                  <DropdownItem icon={<Copy className="size-4" />} onSelect={() => onAction({ type: "copy", qi })}>
                    Copy nội dung
                  </DropdownItem>
                  <DropdownItem icon={<Scissors className="size-4" />} onSelect={() => onAction({ type: "cut", qi })}>
                    Cắt
                  </DropdownItem>
                  <DropdownItem icon={<Trash2 className="size-4" />} danger onSelect={() => onAction({ type: "delete", qi })}>
                    Xóa
                  </DropdownItem>
                </Dropdown>
                {q.fixedOptions && (
                  <span className="flex items-center gap-1 text-xs text-ink-soft" title="Không đảo thứ tự đáp án câu này">
                    <Pin className="size-3.5" /> Cố định đáp án
                  </span>
                )}
                {noAnswer && (
                  <span className="flex items-center gap-1 text-xs font-medium text-danger-600">
                    <TriangleAlert className="size-3.5" /> Chưa chọn đáp án
                  </span>
                )}
              </div>

              {q.audioId && <AudioPlayer id={q.audioId} onRemove={() => onAction({ type: "audioRemove", qi })} />}

              <div className={cn(box, "mt-2 min-h-3 px-2", q.content && "py-1.5")}>
                {q.content && <RichInline text={q.content} className="block text-sm leading-relaxed text-ink" />}
              </div>

              <ul className="mt-2 space-y-1.5">
                {q.options.map((o, oi) => (
                  <li key={oi} className="relative">
                    <span className="absolute top-2 -left-5 text-brand-600 dark:text-brand-300">
                      {o.isCorrect && <Check className="size-4" strokeWidth={3} />}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectOption(qi, oi)}
                      title="Chọn làm đáp án đúng"
                      className="group flex items-stretch gap-1 text-left text-sm"
                    >
                      <span
                        className={cn(
                          box,
                          "flex w-7 shrink-0 items-center justify-center font-medium",
                          o.isCorrect ? "border-brand-600 text-brand-600 dark:text-brand-300" : "text-ink group-hover:border-brand-300",
                        )}
                      >
                        {LETTERS[oi]}
                      </span>
                      <span
                        className={cn(
                          box,
                          "min-h-8 px-1.5 py-1 leading-6",
                          o.isCorrect ? "border-brand-600 text-brand-600 dark:text-brand-300" : "text-ink group-hover:border-brand-300",
                        )}
                      >
                        <RichInline text={o.content} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        );
      })}
    </div>
  );
});
