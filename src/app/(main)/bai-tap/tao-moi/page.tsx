import type { Metadata } from "next";
import { requirePagePermission } from "@/common/guards/page.guard";
import { SUBJECTS } from "@/common/enums";
import {
  getHomework,
  lastHomeworkDefaults,
  listAssignableClasses,
  toHomeworkInitial,
} from "@/modules/homework/homework.service";
import { HomeworkForm } from "@/modules/homework/components/homework-form";

export const metadata: Metadata = { title: "Tạo bài tập mới" };

/** `?tu=<id>` = nhân bản: điền sẵn từ bài có sẵn (không chép file, bỏ chọn lớp để giao lớp khác). */
export default async function CreateHomeworkPage({
  searchParams,
}: {
  searchParams: Promise<{ tu?: string }>;
}) {
  const user = await requirePagePermission("homework.create");
  const { tu } = await searchParams;
  const [classes, last, source] = await Promise.all([
    listAssignableClasses(user.id),
    lastHomeworkDefaults(user.id),
    tu ? getHomework(user, tu) : null,
  ]);

  const initial = source
    ? {
        ...toHomeworkInitial(source, false),
        title: `${source.title} (bản sao)`.slice(0, 200),
        classIds: [],
      }
    : undefined;

  return (
    <HomeworkForm
      initial={initial}
      copiedFrom={source?.title}
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
