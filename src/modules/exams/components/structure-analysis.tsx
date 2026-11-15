"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Info, LoaderCircle, Save } from "lucide-react";
import { Alert, Button, RichInline } from "@/components/ui";
import { cn, formatScore } from "@/lib/utils";
import { LEVEL_OPTIONS, summarizeGroups, summarizeLevels, type DbLevel } from "@/modules/exams/exam-analysis";
import { updateQuestionLevelsAction } from "@/modules/exams/exams.actions";
import { QuestionGroupHeader, startsGroup } from "@/modules/exams/components/question-group-header";

type Question = {
  id: string;
  content: string;
  points: number;
  level: DbLevel | null;
  groupId: string | null;
  group: { id: string; content: string; audioFileId: string | null } | null;
  options: { id: string; content: string; isCorrect: boolean }[];
};

type Props = {
  examId: string;
  title: string;
  /** "Khối 8 - Tiếng Anh" */
  subtitle: string;
  questions: Question[];
  canEdit: boolean;
};

const LETTERS = "ABCDEFGH";
const CARD = "rounded-xl border border-line bg-surface shadow-sm";

/** Phân tích cấu trúc đề: trái là từng câu (điểm, mức độ, đáp án), phải là bảng tổng hợp — đổi mức độ là bảng cập nhật ngay. */
export function StructureAnalysis({ examId, title, subtitle, questions, canEdit }: Props) {
  const router = useRouter();
  const initial = useMemo(() => Object.fromEntries(questions.map((q) => [q.id, q.level])), [questions]);
  const [levels, setLevels] = useState<Record<string, DbLevel | null>>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const current = questions.map((q) => ({ ...q, level: levels[q.id] ?? null }));
  const summary = summarizeLevels(current);
  const groups = summarizeGroups(current);
  const dirty = questions.some((q) => (levels[q.id] ?? null) !== q.level);

  const setLevel = (id: string, level: DbLevel | null) => {
    setSaved(false);
    setLevels((s) => ({ ...s, [id]: level }));
  };
  const setAll = (level: DbLevel | null, onlyEmpty: boolean) => {
    setSaved(false);
    setLevels((s) => Object.fromEntries(questions.map((q) => [q.id, onlyEmpty && s[q.id] ? s[q.id] : level])));
  };

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateQuestionLevelsAction({ examId, levels });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <header className={cn(CARD, "flex flex-wrap items-center justify-between gap-3 px-5 py-4")}>
        <div className="min-w-0">
          <h1 className="text-lg font-medium text-ink">Phân tích cấu trúc đề thi</h1>
          <p className="mt-1 text-sm text-ink">
            Đề thi: <b className="font-medium">{title}</b> {subtitle && <span className="text-ink-soft">({subtitle})</span>}
          </p>
        </div>
        {canEdit && (
          <Button onClick={save} disabled={pending || !dirty}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Lưu
          </Button>
        )}
      </header>

      {error && <Alert variant="danger">{error}</Alert>}
      {saved && <Alert variant="success">Đã lưu mức độ của các câu hỏi.</Alert>}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ═════ Trái: từng câu ═════ */}
        <div className="space-y-3">
          {current.map((q, qi) => {
            const correct = q.options.findIndex((o) => o.isCorrect);
            return (
              <div key={q.id} className="space-y-3">
                {startsGroup(current, qi) && <QuestionGroupHeader content={q.group!.content} audioId={q.group!.audioFileId} />}
                <section className={cn(CARD, "px-4 py-3")}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <p className="font-semibold text-ink">Câu {qi + 1}</p>
                    <span className="rounded-md border border-line px-2.5 py-1 text-sm font-medium text-ink">Điểm: {formatScore(q.points)}</span>
                    <label className="flex items-center gap-2 text-sm text-ink-soft">
                      Mức độ
                      <select
                        value={q.level ?? ""}
                        disabled={!canEdit}
                        onChange={(e) => setLevel(q.id, (e.target.value || null) as DbLevel | null)}
                        className="h-8 rounded-md border border-line bg-surface px-2 text-sm text-ink disabled:opacity-70"
                      >
                        <option value="">Chưa gán</option>
                        {LEVEL_OPTIONS.map((l) => (
                          <option key={l.value} value={l.value}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {q.content && <RichInline text={q.content} className="mt-2 block text-sm text-ink" />}
                  <ul className="mt-2 grid gap-x-4 gap-y-1 text-sm text-ink sm:grid-cols-2">
                    {q.options.map((o, oi) => (
                      <li key={o.id} className="flex gap-1.5">
                        <span className="font-semibold">{LETTERS[oi]}.</span> <RichInline text={o.content} />
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm font-medium text-success-600">Đáp án: {LETTERS[correct] ?? "—"}</p>
                </section>
              </div>
            );
          })}
        </div>

        {/* ═════ Phải: bảng tổng hợp ═════ */}
        <aside className="space-y-4 lg:sticky lg:top-4">
          <section className={cn(CARD, "p-4")}>
            <h2 className="text-sm font-medium text-ink">Theo mức độ nhận thức</h2>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-ink-soft">
                  <th className="py-2 pr-3 font-normal">Mức độ</th>
                  <th className="py-2 pr-3 text-right font-normal">Số câu</th>
                  <th className="py-2 pr-3 text-right font-normal">Điểm</th>
                  <th className="py-2 pr-3 text-right font-normal">Tỉ lệ điểm</th>
                  <th className="w-1/4 py-2 font-normal" />
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((r) => (
                  <tr key={r.key} className="border-b border-line">
                    <td className={cn("py-2 pr-3", r.key === "NONE" ? "text-warning-700 dark:text-amber-300" : "text-ink")}>{r.label}</td>
                    <td className="py-2 pr-3 text-right text-ink tabular-nums">{r.count}</td>
                    <td className="py-2 pr-3 text-right text-ink tabular-nums">{formatScore(r.points)}</td>
                    <td className="py-2 pr-3 text-right text-ink-soft tabular-nums">{formatScore(r.percent)}%</td>
                    <td className="py-2">
                      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <div className={cn("h-full", r.key === "NONE" ? "bg-ink-faint" : "bg-brand-600")} style={{ width: `${r.percent}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="font-medium text-ink">
                  <td className="py-2 pr-3">Tổng</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{summary.count}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatScore(summary.points)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">100%</td>
                  <td />
                </tr>
              </tbody>
            </table>
            {canEdit && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                Gán nhanh cho câu chưa có mức độ:
                {LEVEL_OPTIONS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => setAll(l.value, true)}
                    className="rounded-md border border-line px-2 py-1 text-ink hover:bg-muted"
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={cn(CARD, "overflow-x-auto p-4")}>
            <h2 className="text-sm font-medium text-ink">Theo nhóm câu hỏi</h2>
            <table className="mt-3 w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-ink-soft">
                  <th className="py-2 pr-3 font-normal">Phần</th>
                  <th className="py-2 pr-3 font-normal">Câu</th>
                  <th className="py-2 pr-3 text-right font-normal">Số câu</th>
                  <th className="py-2 pr-3 text-right font-normal">Điểm</th>
                  {LEVEL_OPTIONS.map((l) => (
                    <th key={l.value} className="py-2 pl-2 text-right font-normal" title={l.label}>
                      {l.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={`${g.key}-${g.from}`} className="border-b border-line last:border-0">
                    <td className="py-2 pr-3 text-ink">{g.label}</td>
                    <td className="py-2 pr-3 text-ink-soft">{g.from === g.to ? g.from : `${g.from} – ${g.to}`}</td>
                    <td className="py-2 pr-3 text-right text-ink tabular-nums">{g.count}</td>
                    <td className="py-2 pr-3 text-right text-ink tabular-nums">{formatScore(g.points)}</td>
                    {LEVEL_OPTIONS.map((l) => (
                      <td key={l.value} className="py-2 pl-2 text-right text-ink-soft tabular-nums">
                        {g.levels[l.value] || "–"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <p className={cn(CARD, "flex gap-2 px-4 py-3 text-xs leading-relaxed text-ink-soft")}>
            <Info className="mt-0.5 size-4 shrink-0" />
            Mức độ chỉ dùng để phân tích và lập ma trận, không ảnh hưởng tới điểm nên sửa được cả khi đề đã giao. Điểm từng câu sửa ở
            trình soạn đề (khi đề chưa giao).
          </p>
        </aside>
      </div>
    </div>
  );
}
