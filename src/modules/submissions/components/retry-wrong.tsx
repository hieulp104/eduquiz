"use client";

import { useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { Button, Card, RichInline } from "@/components/ui";
import { cn } from "@/lib/utils";

type WrongQuestion = {
  id: string;
  /** Số thứ tự trong đề. */
  number: number;
  group: string | null;
  content: string;
  options: { id: string; content: string }[];
  correctOptionId: string;
};

const LETTERS = "ABCDEFGH";

/**
 * "Luyện tập lại những câu sai": làm lại ngay trên trang kết quả, không tính điểm.
 * Đáp án đúng của các câu này đã hiện cho học sinh ở lượt luyện tập nên chấm tại trình duyệt.
 */
export function RetryWrong({ questions }: { questions: WrongQuestion[] }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Record<string, string>>({});

  if (questions.length === 0) return null;
  const right = questions.filter((q) => picked[q.id] === q.correctOptionId).length;
  const answered = Object.keys(picked).length;

  if (!open) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink">
          Bạn làm sai <b>{questions.length}</b> câu. Luyện lại các câu này để nhớ lâu hơn.
        </p>
        <Button onClick={() => setOpen(true)}>
          <RotateCcw className="size-4" /> Luyện tập lại những câu sai
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">
          Luyện lại câu sai — đúng {right}/{questions.length} (đã làm {answered})
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPicked({})}>
            <RotateCcw className="size-4" /> Làm lại từ đầu
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Đóng
          </Button>
        </div>
      </Card>
      {questions.map((q) => {
        const chosenId = picked[q.id];
        return (
          <Card key={q.id} className="space-y-3">
            {q.group && <RichInline text={q.group} className="block border-l-4 border-brand-500 pl-3 text-sm text-ink-soft" />}
            <p className="font-semibold text-ink">Câu {q.number}</p>
            {q.content && <RichInline text={q.content} className="block text-ink" />}
            <div className="space-y-2">
              {q.options.map((o, oi) => {
                const chosen = chosenId === o.id;
                const correct = Boolean(chosenId) && q.correctOptionId === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    disabled={Boolean(chosenId)}
                    onClick={() => setPicked((p) => ({ ...p, [q.id]: o.id }))}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm",
                      correct
                        ? "border-success-200 bg-success-50 text-success-700"
                        : chosen
                          ? "border-danger-200 bg-danger-50 text-danger-700"
                          : "border-line text-ink enabled:hover:bg-muted",
                    )}
                  >
                    <span className="font-semibold">{LETTERS[oi]}.</span>
                    <RichInline text={o.content} className="flex-1" />
                    {correct && <Check className="mt-0.5 size-4 shrink-0" />}
                    {chosen && !correct && <X className="mt-0.5 size-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
