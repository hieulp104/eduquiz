import type { Metadata } from "next";
import { requirePagePermission } from "@/common/guards/page.guard";
import { findFolder } from "@/modules/exams/exam-library.service";
import { getTeachingProfile } from "@/modules/worksheet/shared-bank.service";
import { ExamComposer } from "@/modules/exams/components/composer/exam-composer";

export const metadata: Metadata = { title: "Soạn đề thi" };

/**
 * Trình soạn đề (tạo mới). ?thu-muc=<id> lưu vào thư mục; ?tu-file=1 mở bản nháp vừa đọc từ file
 * (hoặc bản nháp đang soạn dở — tự lưu trong sessionStorage).
 */
export default async function ComposeExamPage({
  searchParams,
}: {
  searchParams: Promise<{ "thu-muc"?: string; "tu-file"?: string }>;
}) {
  const user = await requirePagePermission("exam.create");
  const sp = await searchParams;
  const [folder, profile] = await Promise.all([
    sp["thu-muc"] ? findFolder(user, sp["thu-muc"]) : null,
    getTeachingProfile(user.id),
  ]);

  return (
    <ExamComposer
      mode="create"
      folderId={folder?.id ?? null}
      fromFile={sp["tu-file"] === "1"}
      initialText=""
      settings={{
        title: "",
        grade: profile.grades.length === 1 ? profile.grades[0] : null,
        subject: profile.subjects.length === 1 ? profile.subjects[0] : null,
        purpose: null,
        priceMode: "FREE",
        price: 0,
        priceNote: "",
        durationMinutes: 45,
        description: "",
      }}
      backHref={folder ? `/de-thi/tao-moi?thu-muc=${folder.id}` : "/de-thi/tao-moi"}
    />
  );
}
