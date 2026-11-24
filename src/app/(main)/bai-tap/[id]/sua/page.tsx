import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePagePermission } from "@/common/guards/page.guard";
import { can } from "@/common/permissions/permissions";
import {
  getHomework,
  listAssignableClasses,
  toHomeworkInitial,
} from "@/modules/homework/homework.service";
import { HomeworkForm } from "@/modules/homework/components/homework-form";

export const metadata: Metadata = { title: "Sửa bài tập" };

export default async function EditHomeworkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePagePermission("homework.update");
  const hw = await getHomework(user, id);
  if (!hw) notFound();
  if (!can(user, "homework.update", { ownerId: hw.teacherId }))
    redirect("/khong-co-quyen");

  const classes = await listAssignableClasses(hw.teacherId);
  return (
    <HomeworkForm
      homeworkId={hw.id}
      initial={toHomeworkInitial(hw, true)}
      classes={classes.map((c) => ({
        id: c.id,
        name: c.name,
        subject: c.subject,
        memberCount: c._count.members,
      }))}
      defaultGrade={hw.grade}
      defaultSubject={hw.subject}
    />
  );
}
