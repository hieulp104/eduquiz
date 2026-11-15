import type { Metadata } from "next";
import { requirePagePermission } from "@/common/guards/page.guard";
import { getTeacherBoard } from "@/modules/teachers/teachers.service";
import { TeacherManager } from "@/modules/teachers/components/teacher-manager";

export const metadata: Metadata = { title: "Quản lý giáo viên" };

export default async function TeacherManagementPage() {
  const user = await requirePagePermission("teacher.manage");
  return <TeacherManager board={await getTeacherBoard(user.id)} />;
}
