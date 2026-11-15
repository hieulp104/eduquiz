"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Alert } from "@/components/ui";
import { cn } from "@/lib/utils";
import { gradeLabel, subjectsForGrades, TEACHING_GRADES } from "@/common/enums";
import { saveTeachingProfileAction } from "@/modules/worksheet/shared-bank.actions";

type Props = { initialGrades: number[]; initialSubjects: string[]; nextHref: string };

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-[38px] min-w-[114px] rounded-md px-4 text-sm font-medium shadow-[0_2px_4px_rgba(15,23,42,0.12)] transition-colors",
        active ? "bg-brand-700 text-white" : "bg-muted text-ink-soft hover:bg-line hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Bước chọn "Khối dạy" + "Môn dạy" trước khi vào Ngân hàng chung. Chọn được nhiều. */
export function TeachingProfilePicker({ initialGrades, initialSubjects, nextHref }: Props) {
  const router = useRouter();
  const [grades, setGrades] = useState<number[]>(initialGrades);
  const [subjects, setSubjects] = useState<string[]>(initialSubjects);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const subjectOptions = useMemo(() => subjectsForGrades(grades), [grades]);
  // Bỏ khối thì môn không còn thuộc khối nào đã chọn cũng tự bỏ.
  const validSubjects = subjects.filter((s) => subjectOptions.includes(s));
  const ready = grades.length > 0 && validSubjects.length > 0;

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  function next() {
    setError(null);
    startTransition(async () => {
      const res = await saveTeachingProfileAction({ grades, subjects: validSubjects });
      if (!res.ok) return setError(res.message);
      router.push(nextHref);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium text-ink">Thầy/Cô vui lòng chọn Khối học và Môn học mình đang dạy để tiếp tục</h1>
        <button
          type="button"
          disabled={!ready || pending}
          onClick={next}
          className="inline-flex h-[38px] items-center gap-2 rounded-md bg-bank-500 px-4 text-sm font-semibold text-white shadow-sm hover:bg-bank-600 disabled:bg-bank-500/40 disabled:shadow-none"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          Tiếp tục
        </button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Khối dạy</h2>
        <div className="grid max-w-[640px] grid-cols-2 gap-3 sm:grid-cols-5">
          {TEACHING_GRADES.map((g) => (
            <Chip key={g} active={grades.includes(g)} onClick={() => setGrades((list) => toggle(list, g))}>
              {gradeLabel(g)}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Môn dạy</h2>
        {grades.length === 0 ? (
          <p className="text-sm text-ink-soft">Chọn khối dạy để hiện danh sách môn.</p>
        ) : (
          <div className="flex max-w-[960px] flex-wrap gap-3">
            {subjectOptions.map((s) => (
              <Chip key={s} active={validSubjects.includes(s)} onClick={() => setSubjects((list) => toggle(list, s))}>
                {s}
              </Chip>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
