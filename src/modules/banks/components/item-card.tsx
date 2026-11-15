import type { ReactNode } from "react";
import { RichInline } from "@/components/ui";
import { cn } from "@/lib/utils";
import { stripTags } from "@/lib/inline-format";
import { LEVELS, type Level } from "@/modules/exams/exam-text";

const LETTERS = "ABCDEFGH";

/** 1 câu trắc nghiệm: số câu · mã · mức độ · nội dung · phương án (2/4 cột) · đáp án đúng tô xanh. */
export function ItemCard({
  no,
  code,
  level,
  content,
  options,
  correctIndex,
  leading,
  actions,
  className,
}: {
  no: number;
  code?: string;
  level: Level | null;
  content: string;
  options: string[];
  correctIndex: number;
  leading?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const longest = Math.max(0, ...options.map((o) => stripTags(o).length));
  const cols = longest <= 24 ? "sm:grid-cols-4" : longest <= 60 ? "sm:grid-cols-2" : "";
  return (
    <div className={cn("flex gap-3 rounded-lg border border-line bg-surface p-4 shadow-sm", className)}>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink">Câu {no}</span>
          {code && <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-ink-soft">#{code}</span>}
          {level && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-brand-600 dark:text-brand-300">{LEVELS[level]}</span>}
          {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
        </div>
        <RichInline text={content} className="mt-1.5 block whitespace-pre-line text-ink" />
        <ul className={cn("mt-3 grid gap-x-6 gap-y-1.5 text-sm", cols)}>
          {options.map((o, i) => (
            <li key={i} className={cn("rounded-md px-2 py-1", i === correctIndex ? "bg-success-50 font-medium text-success-700" : "text-ink")}>
              <span className="font-semibold">{LETTERS[i]}.</span> <RichInline text={o} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
