"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dices, LoaderCircle } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { examFromMatrixAction } from "@/modules/banks/banks.actions";
import { MATRIX_LEVEL_LABEL, MATRIX_LEVELS, UNSORTED, type MatrixLevel } from "@/modules/banks/banks.types";
import { ExamSettingsFields } from "./exam-settings-fields";

export type MatrixRow = { id: string; title: string; depth: number; avail: Record<MatrixLevel, number> };

/**
 * "Tạo ma trận đề thi": mỗi dòng 1 chương / bài (chỉ câu nằm trực tiếp trong mục đó), mỗi cột 1 mức độ.
 * Nhập số câu cần bốc → server bốc ngẫu nhiên đúng số đó và tạo đề.
 */
export function MatrixForm({ bankId, bankName, rows }: { bankId: string; bankName: string; rows: MatrixRow[] }) {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [title, setTitle] = useState(`${bankName} — ma trận`);
  const [duration, setDuration] = useState("45");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const key = (id: string, l: MatrixLevel) => `${id}:${l}`;
  const num = (id: string, l: MatrixLevel) => Math.max(0, Math.floor(Number(counts[key(id, l)] || 0)));
  const colTotal = (l: MatrixLevel) => rows.reduce((s, r) => s + num(r.id, l), 0);
  const total = MATRIX_LEVELS.reduce((s, l) => s + colTotal(l), 0);
  const over = rows.some((r) => MATRIX_LEVELS.some((l) => num(r.id, l) > r.avail[l]));

  function create() {
    setError(null);
    const list = rows.flatMap((r) =>
      MATRIX_LEVELS.flatMap((l) => (num(r.id, l) > 0 ? [{ sectionId: r.id === UNSORTED ? null : r.id, level: l, count: num(r.id, l) }] : [])),
    );
    startTransition(async () => {
      const res = await examFromMatrixAction({ bankId, rows: list, title, durationMinutes: Number(duration) });
      if (!res.ok) return setError(res.message);
      router.push(`/de-thi/${res.data.examId}`);
    });
  }

  if (!rows.some((r) => MATRIX_LEVELS.some((l) => r.avail[l] > 0))) {
    return <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-16 text-center text-sm text-ink-soft">Ngân hàng chưa có câu hỏi — nhập câu hỏi trước khi tạo ma trận.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px] lg:items-start">
      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-ink-soft">
            <tr>
              <th className="px-4 py-2.5 font-medium">Chương / bài</th>
              {MATRIX_LEVELS.map((l) => (
                <th key={l} className="w-32 px-3 py-2.5 text-center font-medium">
                  {MATRIX_LEVEL_LABEL[l]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className={cn("px-4 py-2 text-ink", r.depth === 0 && "font-medium", r.id === UNSORTED && "italic")} style={{ paddingLeft: 16 + r.depth * 20 }}>
                  {r.title}
                </td>
                {MATRIX_LEVELS.map((l) => {
                  const avail = r.avail[l];
                  const bad = num(r.id, l) > avail;
                  return (
                    <td key={l} className="px-3 py-1.5 text-center">
                      {avail === 0 ? (
                        <span className="text-ink-faint">—</span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={avail}
                            inputMode="numeric"
                            aria-label={`${r.title} — ${MATRIX_LEVEL_LABEL[l]}`}
                            value={counts[key(r.id, l)] ?? ""}
                            placeholder="0"
                            onChange={(e) => setCounts((c) => ({ ...c, [key(r.id, l)]: e.target.value }))}
                            className={cn(
                              "h-8 w-14 rounded-md border bg-surface px-2 text-center text-sm text-ink focus:outline-none",
                              bad ? "border-danger-600" : "border-line focus:border-brand-500",
                            )}
                          />
                          <span className="text-xs text-ink-soft">/ {avail}</span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-line bg-muted/50">
            <tr>
              <td className="px-4 py-2.5 font-semibold text-ink">Tổng</td>
              {MATRIX_LEVELS.map((l) => (
                <td key={l} className="px-3 py-2.5 text-center font-semibold text-ink">
                  {colTotal(l)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <aside className="space-y-4 rounded-xl border border-line bg-surface p-4 shadow-sm lg:sticky lg:top-4">
        <p className="font-medium text-ink">
          Tổng số câu: <span className="text-brand-700 dark:text-brand-300">{total}</span>
        </p>
        <ExamSettingsFields title={title} onTitle={setTitle} duration={duration} onDuration={setDuration} />
        <p className="text-xs text-ink-soft">Câu được bốc ngẫu nhiên — tạo lại sẽ ra đề khác. Tổng 10 điểm chia đều.</p>
        {over && <Alert variant="danger">Có ô nhập nhiều hơn số câu đang có.</Alert>}
        {error && <Alert variant="danger">{error}</Alert>}
        <Button className="w-full" disabled={pending || total === 0 || over} onClick={create}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Dices className="size-4" />} Tạo đề thi
        </Button>
      </aside>
    </div>
  );
}
