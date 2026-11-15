import type { Metadata } from "next";
import { requirePagePermission } from "@/common/guards/page.guard";
import { getTeachingProfile } from "@/modules/worksheet/shared-bank.service";
import { TeachingProfilePicker } from "@/modules/worksheet/components/teaching-profile-picker";

export const metadata: Metadata = { title: "Ngân hàng chung" };

/** Bước 1: chọn khối / môn đang dạy (mở sẵn lựa chọn lần trước). */
export default async function SharedBankPickPage() {
  const user = await requirePagePermission("exam.create");
  const profile = await getTeachingProfile(user.id);
  return (
    <TeachingProfilePicker
      initialGrades={profile.grades}
      initialSubjects={profile.subjects}
      nextHref="/de-thi/ngan-hang-chung/kho"
    />
  );
}
