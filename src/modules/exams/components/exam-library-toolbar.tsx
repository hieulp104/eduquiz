import Link from "next/link";
import { Landmark, Plus, Search } from "lucide-react";
import { FolderCreateMenu } from "./folder-create-menu";

type Props = {
  q: string;
  folderId: string | null;
  canCreate: boolean;
  bankHref: string;
  /** Sách trong ngân hàng — cho "Tạo thư mục theo sách". */
  books: { id: string; title: string; topicCount: number; lessonCount: number }[];
};

/** Ô tìm kiếm + 3 nút: Tạo đề từ ngân hàng chung · Tạo đề thi · Tạo thư mục (menu). */
export function ExamLibraryToolbar({ q, folderId, canCreate, bankHref, books }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <form className="relative w-full sm:w-[232px]" role="search">
        {folderId && <input type="hidden" name="thu-muc" value={folderId} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Tìm kiếm"
          aria-label="Tìm kiếm đề thi, thư mục"
          className="h-[38px] w-full rounded-md border border-line bg-surface pr-9 pl-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none"
        />
        <button type="submit" aria-label="Tìm" className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-ink-soft">
          <Search className="size-4" />
        </button>
      </form>

      {canCreate && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={bankHref}
            className="inline-flex h-[38px] items-center gap-2 rounded-md bg-bank-500 px-4 text-sm font-semibold text-white shadow-sm hover:bg-bank-600"
          >
            <Landmark className="size-4" /> Tạo đề từ ngân hàng chung
          </Link>
          <Link
            href={folderId ? `/de-thi/tao-moi?thu-muc=${folderId}` : "/de-thi/tao-moi"}
            className="inline-flex h-[38px] items-center gap-2 rounded-md bg-cta-500 px-4 text-sm font-semibold text-white shadow-sm hover:bg-cta-600"
          >
            <Plus className="size-4" /> Tạo đề thi
          </Link>
          <FolderCreateMenu folderId={folderId} books={books} />
        </div>
      )}
    </div>
  );
}
