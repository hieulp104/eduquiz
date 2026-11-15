"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, LoaderCircle, Search, X } from "lucide-react";
import { Alert, Button, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { stripTags } from "@/lib/inline-format";
import { LEVELS, type Level } from "@/modules/exams/exam-text";
import { examFromItemsAction } from "@/modules/banks/banks.actions";
import { subtreeIds, UNSORTED, type BankItemView, type SectionRow } from "@/modules/banks/banks.types";
import { ItemCard } from "./item-card";
import { ExamSettingsFields } from "./exam-settings-fields";

type Props = { bankId: string; bankName: string; sections: SectionRow[]; flat: { id: string; title: string; depth: number }[]; items: BankItemView[] };

/** "Tự chọn câu hỏi": lọc theo bài / mức độ / nội dung → tích chọn → tạo đề (giữ thứ tự chọn). */
export function PickItems({ bankId, bankName, sections, flat, items }: Props) {
  const router = useRouter();
  const [section, setSection] = useState("");
  const [level, setLevel] = useState("");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [title, setTitle] = useState(bankName);
  const [duration, setDuration] = useState("45");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = useMemo(() => {
    const ids = section && section !== UNSORTED ? subtreeIds(sections, section) : null;
    const query = q.trim().toLowerCase().replace(/^#/, "");
    return items.filter(
      (i) =>
        (!section || (section === UNSORTED ? !i.sectionId : Boolean(i.sectionId && ids?.has(i.sectionId)))) &&
        (!level || (level === "NONE" ? !i.level : i.level === level)) &&
        (!query || i.code.toLowerCase() === query || stripTags(i.content).toLowerCase().includes(query)),
    );
  }, [items, sections, section, level, q]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const pickedSet = new Set(picked);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const allShown = shown.length > 0 && shown.every((i) => pickedSet.has(i.id));

  function create() {
    setError(null);
    startTransition(async () => {
      const res = await examFromItemsAction({ bankId, itemIds: picked, title, durationMinutes: Number(duration) });
      if (!res.ok) return setError(res.message);
      router.push(`/de-thi/${res.data.examId}`);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3 shadow-sm">
          <Select value={section} onChange={(e) => setSection(e.target.value)} className="h-9 w-auto max-w-72" aria-label="Lọc theo bài">
            <option value="">Tất cả chương / bài</option>
            {flat.map((n) => (
              <option key={n.id} value={n.id}>
                {"— ".repeat(n.depth)}
                {n.title}
              </option>
            ))}
            <option value={UNSORTED}>Chưa xếp bài</option>
          </Select>
          <Select value={level} onChange={(e) => setLevel(e.target.value)} className="h-9 w-auto" aria-label="Lọc theo mức độ">
            <option value="">Mọi mức độ</option>
            {(Object.keys(LEVELS) as Level[]).map((l) => (
              <option key={l} value={l}>
                {LEVELS[l]}
              </option>
            ))}
            <option value="NONE">Chưa phân mức</option>
          </Select>
          <label className="relative min-w-48 flex-1">
            <span className="sr-only">Tìm câu hỏi</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm mã / nội dung"
              className="h-9 w-full rounded-md border border-line bg-surface pr-9 pl-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none"
            />
            <Search className="pointer-events-none absolute top-2.5 right-3 size-4 text-ink-soft" />
          </label>
          <label className="flex h-9 items-center gap-2 rounded-md border border-line px-3 text-sm text-ink">
            <input
              type="checkbox"
              className="size-4 accent-brand-600"
              checked={allShown}
              disabled={!shown.length}
              onChange={() =>
                setPicked((p) => (allShown ? p.filter((id) => !shown.some((s) => s.id === id)) : [...p, ...shown.map((s) => s.id).filter((id) => !p.includes(id))]))
              }
            />
            Chọn tất cả ({shown.length})
          </label>
        </div>
        {shown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-14 text-center text-sm text-ink-soft">Không có câu hỏi phù hợp.</p>
        ) : (
          <ul className="space-y-3">
            {shown.map((it, i) => (
              <li key={it.id}>
                <label className="block cursor-pointer">
                  <ItemCard
                    no={i + 1}
                    code={it.code}
                    level={it.level}
                    content={it.content}
                    options={it.options}
                    correctIndex={it.correctIndex}
                    className={cn(pickedSet.has(it.id) && "border-brand-500 ring-1 ring-brand-500")}
                    leading={<input type="checkbox" className="mt-1 size-4 shrink-0 accent-brand-600" checked={pickedSet.has(it.id)} onChange={() => toggle(it.id)} />}
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="space-y-4 rounded-xl border border-line bg-surface p-4 shadow-sm lg:sticky lg:top-4">
        <div className="flex items-center justify-between">
          <p className="font-medium text-ink">
            Đã chọn <span className="text-brand-700 dark:text-brand-300">{picked.length}</span> câu
          </p>
          {picked.length > 0 && (
            <button type="button" onClick={() => setPicked([])} className="text-xs text-ink-soft hover:text-danger-600">
              Bỏ chọn hết
            </button>
          )}
        </div>
        {picked.length > 0 && (
          <ol className="max-h-56 space-y-1 overflow-y-auto text-sm">
            {picked.map((id, i) => {
              const it = byId.get(id);
              return (
                <li key={id} className="flex items-center gap-2 rounded-md bg-muted px-2 py-1">
                  <span className="w-6 shrink-0 text-xs text-ink-soft">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{it ? stripTags(it.content).split("\n").pop() : id}</span>
                  <button type="button" onClick={() => toggle(id)} aria-label="Bỏ câu này" className="rounded p-0.5 text-ink-faint hover:text-danger-600">
                    <X className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        <ExamSettingsFields title={title} onTitle={setTitle} duration={duration} onDuration={setDuration} />
        <p className="text-xs text-ink-soft">Đề tạo ở thư mục gốc của Đề thi, tổng 10 điểm chia đều — sửa được trước khi giao.</p>
        {error && <Alert variant="danger">{error}</Alert>}
        <Button className="w-full" disabled={pending || picked.length === 0} onClick={create}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <FilePlus2 className="size-4" />} Tạo đề thi
        </Button>
      </aside>
    </div>
  );
}
