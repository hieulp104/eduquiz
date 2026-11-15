import type { Metadata } from "next";
import { requirePagePermission } from "@/common/guards/page.guard";
import { CreateExamHub } from "@/modules/exams/components/create-exam-hub";
import { findFolder } from "@/modules/exams/exam-library.service";

export const metadata: Metadata = { title: "Tạo đề mới" };

/** Chọn cách tạo đề: tải file / tự soạn / ma trận / Excel… ?thu-muc=<id> được chuyển tiếp. */
export default async function CreateExamHubPage({
  searchParams,
}: {
  searchParams: Promise<{ "thu-muc"?: string }>;
}) {
  const user = await requirePagePermission("exam.create");
  const sp = await searchParams;
  const folder = sp["thu-muc"] ? await findFolder(user, sp["thu-muc"]) : null;
  return <CreateExamHub folderId={folder?.id ?? null} />;
}
