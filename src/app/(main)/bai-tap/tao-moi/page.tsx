import type { Metadata } from "next";
import { requirePagePermission } from "@/common/guards/page.guard";
import { SUBJECTS } from "@/common/enums";
import {
  lastHomeworkDefaults,
  listAssignableClasses,
} from "@/modules/homework/homework.service";
import { HomeworkForm } from "@/modules/homework/components/homework-form";

export const metadata: Metadata = { title: "Tạo bài tập mới" };

export default async function CreateHomeworkPage() {
  const user = await requirePagePermission("homework.create");
  const [classes, last] = await Promise.all([
    listAssignableClasses(user.id),
    lastHomeworkDefaults(user.id),
  ]);

  return (
    <HomeworkForm
      classes={classes.map((c) => ({
        id: c.id,
        name: c.name,
        subject: c.subject,
        memberCount: c._count.members,
      }))}
      // Mở sẵn khối / môn của bài tạo gần nhất — giáo viên thường dạy cố định 1–2 môn.
      defaultGrade={last?.grade ?? 10}
      defaultSubject={last?.subject ?? SUBJECTS[0]}
    />
  );
}
