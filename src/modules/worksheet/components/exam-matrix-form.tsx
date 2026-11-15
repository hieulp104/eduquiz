"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Shuffle } from "lucide-react";
import { Alert, Button, Input } from "@/components/ui";
import { loadBookTreeAction } from "@/modules/worksheet/worksheet.actions";
import { createExamFromMatrixAction } from "@/modules/worksheet/exam-matrix.actions";
import type { BankBook, BankTreeNode } from "@/modules/worksheet/worksheet.types";

type Props = {
  books: BankBook[];
  initialBookId: string | null;
  initialTree: BankTreeNode[];
  folderId: string | null;
};

/** Ma trận đề: chọn sách → nhập số câu cho từng chủ đề → máy bốc ngẫu nhiên thành đề. */
export function ExamMatrixForm({ books, initialBookId, initialTree, folderId }: Props) {
  const router = useRouter();
  const [bookId, setBookId] = useState(initialBookId);
  const [topics, setTopics] = useState(initialTree);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(45);
  const [error, setError] = useState<string | null>(null);
  const [loadingTree, startTreeLoad] = useTransition();
  const [pending, startTransition] = useTransition();

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const book = books.find((b) => b.id === bookId);

  function changeBook(id: string) {
    setBookId(id);
    setCounts({});
    startTreeLoad(async () => {
      const res = await loadBookTreeAction(id);
      setTopics(res.ok ? res.data : []);
    });
  }

  function submit() {
    if (!bookId) return;
    setError(null);
    startTransition(async () => {
      const res = await createExamFromMatrixAction({
        bookId,
        title: title.trim() || `Đề ${book?.title ?? ""} (${total} câu)`,
        durationMinutes: minutes,
        folderId,
        rows: topics.map((t) => ({ nodeId: t.id, count: counts[t.id] ?? 0 })),
      });
      if (!res.ok) return setError(res.message);
      router.push(`/de-thi/${res.data.id}`);
    });
  }

  if (books.length === 0) return <Alert>Ngân hàng câu hỏi chưa có sách nào.</Alert>;

  return (
    <div className="mx-auto max-w-[1000px] space-y-4">
      <div className="grid gap-4 rounded-lg bg-surface p-5 shadow-sm sm:grid-cols-[1fr_1fr_140px]">
        <label className="space-y-1.5 text-sm font-medium text-ink">
          Sách
          <select
            value={bookId ?? ""}
            onChange={(e) => changeBook(e.target.value)}
            className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm font-normal"
          >
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-medium text-ink">
          Tên đề
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Đề ${book?.title ?? ""}`} maxLength={200} />
        </label>
        <label className="space-y-1.5 text-sm font-medium text-ink">
          Thời gian (phút)
          <Input type="number" min={1} max={300} value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 1)} />
        </label>
      </div>

      <div className="overflow-hidden rounded-lg bg-surface shadow-sm">
        <div className="grid grid-cols-[1fr_120px_140px] border-b border-line bg-muted px-5 py-3 text-sm font-medium text-ink-soft">
          <span>Chủ đề</span>
          <span className="text-right">Câu có sẵn</span>
          <span className="text-right">Số câu lấy</span>
        </div>
        {loadingTree ? (
          <p className="flex items-center gap-2 px-5 py-6 text-sm text-ink-soft">
            <LoaderCircle className="size-4 animate-spin" /> Đang tải chủ đề…
          </p>
        ) : (
          topics.map((t) => (
            <div key={t.id} className="grid grid-cols-[1fr_120px_140px] items-center border-b border-line px-5 py-2.5 last:border-b-0">
              <span className="text-[15px] text-ink">{t.title}</span>
              <span className="text-right text-sm text-ink-soft">{t.count}</span>
              <span className="flex justify-end">
                <Input
                  type="number"
                  min={0}
                  max={Math.min(100, t.count)}
                  disabled={t.count === 0}
                  aria-label={`Số câu lấy từ ${t.title}`}
                  value={counts[t.id] ?? 0}
                  onChange={(e) => {
                    const n = Math.max(0, Math.min(t.count, 100, Math.floor(Number(e.target.value) || 0)));
                    setCounts((c) => ({ ...c, [t.id]: n }));
                  }}
                  className="h-9 w-24 text-right"
                />
              </span>
            </div>
          ))
        )}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="flex items-center justify-end gap-4">
        <span className="text-sm text-ink-soft">
          Tổng: <b className="text-ink">{total}</b> câu · mỗi câu 1 điểm
        </span>
        <Button onClick={submit} disabled={total === 0 || pending || !bookId}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Shuffle className="size-4" />}
          Tạo đề ngẫu nhiên
        </Button>
      </div>
    </div>
  );
}
