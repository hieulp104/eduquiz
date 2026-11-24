import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Pencil } from "lucide-react";
import { requirePagePermission } from "@/common/guards/page.guard";
import { gradeLabel } from "@/common/enums";
import { Alert } from "@/components/ui";
import { getTeachingProfile, listSharedBooks } from "@/modules/worksheet/shared-bank.service";

export const metadata: Metadata = { title: "Ngân hàng chung" };

type Book = Awaited<ReturnType<typeof listSharedBooks>>[number];

function BookCard({ book }: { book: Book }) {
  return (
    <Link
      href={`/bai-tap/phieu?sach=${book.id}`}
      className="group flex items-center gap-4 rounded-lg bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-bank-500/10 text-bank-600">
        <BookOpen className="size-7" strokeWidth={1.75} />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink group-hover:text-brand-700">{book.title}</span>
        <span className="mt-0.5 block text-sm text-ink-soft">
          {gradeLabel(book.grade)} · {book.subject} · {book.topicCount} chủ đề · {book.questionCount.toLocaleString("vi-VN")} câu
        </span>
      </span>
    </Link>
  );
}

/** Bước 2: các sách trong ngân hàng chung, ưu tiên sách khớp khối / môn đang dạy. */
export default async function SharedBankBooksPage() {
  const user = await requirePagePermission("exam.create");
  const profile = await getTeachingProfile(user.id);
  if (profile.grades.length === 0) redirect("/de-thi/ngan-hang-chung");

  const books = await listSharedBooks(profile);
  const matched = books.filter((b) => b.matches);
  const others = books.filter((b) => !b.matches);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-ink">Ngân hàng chung</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Đang dạy: {profile.grades.map(gradeLabel).join(", ")} — {profile.subjects.join(", ")}
          </p>
        </div>
        <Link
          href="/de-thi/ngan-hang-chung"
          className="inline-flex h-[38px] items-center gap-2 rounded-md border border-line bg-surface px-4 text-sm font-medium text-ink hover:bg-muted"
        >
          <Pencil className="size-4" /> Đổi khối / môn
        </Link>
      </div>

      {matched.length > 0 ? (
        <section>
          <h2 className="mb-3 font-semibold text-ink">Phù hợp với Thầy/Cô</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {matched.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        </section>
      ) : (
        <Alert>
          Ngân hàng chung chưa có sách cho khối / môn Thầy/Cô đã chọn — nội dung đang được bổ sung dần.
          {others.length > 0 && " Thầy/Cô có thể dùng thử các sách đang có bên dưới."}
        </Alert>
      )}

      {others.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold text-ink">Sách khác đang có</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {others.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
