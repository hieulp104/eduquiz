"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Subject = {
  name: string;
  question: string;
  options: string[];
  answer: number;
  /** Phiếu 10 câu: [đáp án đúng, học sinh chọn] — chỉ để minh họa. */
  sheet: [number, number][];
};

const SUBJECTS: Subject[] = [
  {
    name: "Toán",
    question: "Nghiệm của phương trình 2x − 6 = 0 là",
    options: ["x = 2", "x = 3", "x = 6", "x = −3"],
    answer: 1,
    sheet: [
      [1, 1],
      [0, 0],
      [3, 3],
      [2, 2],
      [1, 1],
      [0, 2],
      [3, 3],
      [2, 2],
      [1, 1],
      [0, 0],
    ],
  },
  {
    name: "Vật lý",
    question: "Trong hệ SI, đơn vị đo lực là",
    options: ["Jun (J)", "Oát (W)", "Niutơn (N)", "Paxcan (Pa)"],
    answer: 2,
    sheet: [
      [2, 2],
      [1, 1],
      [0, 0],
      [3, 1],
      [2, 2],
      [0, 0],
      [1, 1],
      [3, 3],
      [2, 2],
      [0, 0],
    ],
  },
  {
    name: "Tiếng Anh",
    question: "She ___ to school by bike every day.",
    options: ["go", "goes", "going", "gone"],
    answer: 1,
    sheet: [
      [1, 1],
      [3, 3],
      [0, 0],
      [2, 2],
      [1, 3],
      [0, 0],
      [2, 2],
      [3, 0],
      [1, 1],
      [2, 2],
    ],
  },
  {
    name: "Lịch sử",
    question: "Cách mạng tháng Tám thành công vào năm",
    options: ["1930", "1941", "1945", "1954"],
    answer: 2,
    sheet: [
      [2, 2],
      [0, 0],
      [1, 1],
      [3, 3],
      [2, 2],
      [1, 1],
      [0, 0],
      [3, 3],
      [2, 2],
      [1, 1],
    ],
  },
  {
    name: "Ngữ văn",
    question: "Tác giả của “Truyện Kiều” là",
    options: ["Nguyễn Trãi", "Nguyễn Du", "Hồ Xuân Hương", "Nguyễn Đình Chiểu"],
    answer: 1,
    sheet: [
      [1, 1],
      [2, 2],
      [0, 0],
      [1, 1],
      [3, 3],
      [2, 0],
      [0, 0],
      [1, 1],
      [3, 3],
      [2, 2],
    ],
  },
];

const LETTERS = "ABCD";

/** Phần đầu trang giới thiệu: đổi môn → đổi câu hỏi mẫu + phiếu tô chấm lại. */
export function SubjectDemo() {
  const [index, setIndex] = useState(0);
  const s = SUBJECTS[index];
  const score = s.sheet.filter(([right, picked]) => right === picked).length;

  return (
    <div>
      <div
        role="group"
        aria-label="Chọn môn học"
        className="flex flex-wrap gap-1.5"
      >
        {SUBJECTS.map((sub, i) => (
          <button
            key={sub.name}
            type="button"
            aria-pressed={i === index}
            onClick={() => setIndex(i)}
            className={cn(
              "touch-manipulation rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
              i === index
                ? "bg-ink text-canvas"
                : "text-ink-soft hover:bg-muted hover:text-ink",
            )}
          >
            {sub.name}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-stretch gap-4">
        {/* Câu hỏi */}
        <div
          aria-live="polite"
          className="flex-1 rounded-2xl border border-line bg-surface p-5 shadow-sm"
        >
          <p className="text-sm text-ink-faint">Câu 1</p>
          <p className="mt-1 min-h-[3rem] font-medium text-ink">{s.question}</p>
          <ul className="mt-4 space-y-2">
            {s.options.map((o, i) => {
              const right = i === s.answer;
              return (
                <li
                  key={o}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
                    right
                      ? "border-success-600 bg-success-600/10 font-medium text-success-600"
                      : "border-line text-ink",
                  )}
                >
                  <span className="font-semibold">{LETTERS[i]}.</span>
                  {o}
                  {right && (
                    <>
                      <Check className="ml-auto size-4" aria-hidden />
                      <span className="sr-only">(đáp án đúng)</span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Phiếu tô — chấm lại mỗi lần đổi môn */}
        <div
          key={s.name}
          role="img"
          aria-label={`Phiếu trả lời mẫu: đúng ${score} trên 10 câu`}
          className="hidden w-40 shrink-0 rounded-2xl border border-brand-300 bg-surface p-3 sm:block dark:border-brand-800"
        >
          <div className="grid grid-cols-[1.25rem_repeat(4,1fr)] items-center gap-x-1 gap-y-1 text-[11px] text-brand-700 dark:text-brand-300">
            <span />
            {LETTERS.split("").map((l) => (
              <span key={l} className="text-center font-semibold">
                {l}
              </span>
            ))}
            {s.sheet.map(([right, picked], row) => (
              <SheetRow key={row} row={row} right={right} picked={picked} />
            ))}
          </div>
          <div
            className="animate-bubble-in mt-3 border-t border-line pt-2 text-center"
            style={{ animationDelay: `${s.sheet.length * 70 + 150}ms` }}
          >
            <span className="font-display text-2xl font-bold tabular-nums text-ink">
              {score}
            </span>
            <span className="text-sm text-ink-soft"> / 10 câu đúng</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SheetRow({
  row,
  right,
  picked,
}: {
  row: number;
  right: number;
  picked: number;
}) {
  return (
    <>
      <span className="text-right tabular-nums">{row + 1}</span>
      {[0, 1, 2, 3].map((col) => {
        const isPicked = col === picked;
        const isRight = col === right;
        return (
          <span key={col} className="flex justify-center">
            <span
              className={cn(
                "flex size-4 items-center justify-center rounded-full border",
                isPicked &&
                  isRight &&
                  "animate-bubble-in border-success-600 bg-success-600 text-white",
                isPicked &&
                  !isRight &&
                  "animate-bubble-in border-danger-600 bg-danger-600 text-white",
                !isPicked && isRight && "border-2 border-success-600",
                !isPicked &&
                  !isRight &&
                  "border-brand-300 dark:border-brand-800",
              )}
              style={isPicked ? { animationDelay: `${row * 70}ms` } : undefined}
            >
              {isPicked && !isRight && (
                <X className="size-2.5" strokeWidth={3} />
              )}
            </span>
          </span>
        );
      })}
    </>
  );
}
