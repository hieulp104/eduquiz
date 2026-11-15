import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requirePagePermission } from "@/common/guards/page.guard";
import { can, hasPermission } from "@/common/permissions/permissions";
import { SHARED_BANK_HREF } from "@/config/navigation";
import {
  findFolder,
  folderPath,
  getLibrary,
  getRecommendedExams,
  listAllFolders,
} from "@/modules/exams/exam-library.service";
import { LIBRARY_SORTS, type LibrarySort } from "@/modules/exams/exam-library.types";
import { listBookOutlines } from "@/modules/worksheet/worksheet.service";
import { ExamLibraryToolbar } from "@/modules/exams/components/exam-library-toolbar";
import { ExamLibraryTable } from "@/modules/exams/components/exam-library-table";
import { RecommendedExams } from "@/modules/exams/components/recommended-exams";

export const metadata: Metadata = { title: "Đề thi" };

type Search = { q?: string; "thu-muc"?: string; "sap-xep"?: string; chieu?: string };

export default async function ExamsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requirePagePermission("exam.view");
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const sort = LIBRARY_SORTS.includes(sp["sap-xep"] as LibrarySort) ? (sp["sap-xep"] as LibrarySort) : undefined;
  const dir = sp.chieu === "desc" ? "desc" : "asc";

  const folder = sp["thu-muc"] ? await findFolder(user, sp["thu-muc"]) : null;
  if (sp["thu-muc"] && !folder) notFound();
  const folderId = folder?.id ?? null;
  const isRoot = !folderId && !q;

  const [library, recommended, allFolders, path] = await Promise.all([
    getLibrary(user, { folderId, q, sort, dir }),
    isRoot ? getRecommendedExams(user) : Promise.resolve([]),
    listAllFolders(user),
    folderId ? folderPath(user, folderId) : Promise.resolve([]),
  ]);

  const canCreate = hasPermission(user, "exam.create");
  const books = canCreate ? await listBookOutlines() : [];
  // Thư mục của người khác (Admin xem) thì chỉ xem, không sửa.
  const canEdit = folder ? can(user, "exam.update", { ownerId: folder.teacherId }) : hasPermission(user, "exam.update");

  return (
    <div className="space-y-7">
      <ExamLibraryToolbar q={q} folderId={folderId} canCreate={canCreate} bankHref={SHARED_BANK_HREF} books={books} />

      {isRoot && <RecommendedExams exams={recommended} />}

      <section>
        <nav aria-label="Thư mục" className="mb-4 flex flex-wrap items-center gap-1.5 text-lg font-medium text-ink">
          {q ? (
            <span>
              Kết quả tìm “{q}”{" "}
              <Link href="/de-thi" className="ml-2 text-sm font-normal text-brand-700 hover:underline">
                Xóa tìm kiếm
              </Link>
            </span>
          ) : path.length === 0 ? (
            <span>Tất cả</span>
          ) : (
            <>
              <Link href="/de-thi" className="text-ink-soft hover:text-brand-700">
                Tất cả
              </Link>
              {path.map((p, i) => (
                <span key={p.id} className="flex items-center gap-1.5">
                  <ChevronRight className="size-4 text-ink-faint" />
                  {i === path.length - 1 ? (
                    <span>{p.name}</span>
                  ) : (
                    <Link href={`/de-thi?thu-muc=${p.id}`} className="text-ink-soft hover:text-brand-700">
                      {p.name}
                    </Link>
                  )}
                </span>
              ))}
            </>
          )}
        </nav>

        <ExamLibraryTable
          // key: đổi thư mục / tìm kiếm thì bỏ các dòng đang chọn
          key={`${folderId ?? "root"}|${q}`}
          folders={library.folders}
          exams={library.exams}
          sort={sort}
          dir={dir}
          allFolders={allFolders.map((f) => ({ id: f.id, name: f.name }))}
          bankHref={isRoot && canCreate ? SHARED_BANK_HREF : undefined}
          canEdit={canEdit}
        />
      </section>
    </div>
  );
}
