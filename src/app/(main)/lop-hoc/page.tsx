import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { requirePagePermission } from "@/common/guards/page.guard";
import { hasPermission } from "@/common/permissions/permissions";
import { PageHeader } from "@/components/patterns/page-header";
import { Badge, Card, EmptyState } from "@/components/ui";
import { listClassBoard, listClasses } from "@/modules/classes/classes.service";
import { schoolYearOf } from "@/modules/classes/class-board";
import { ClassBoard } from "@/modules/classes/components/class-board";
import { JoinClassForm } from "@/modules/classes/components/join-class-form";

export const metadata: Metadata = { title: "Lớp học" };

export default async function ClassesPage() {
  const user = await requirePagePermission("class.view");

  // Giáo viên / Admin: trang "Danh sách lớp" (nhóm lớp, năm học, tạo nhiều cách).
  if (hasPermission(user, "class.create")) {
    const board = await listClassBoard(user);
    return <ClassBoard classes={board.classes} groups={board.groups} currentYear={schoolYearOf(new Date())} />;
  }

  // Học sinh: vào lớp bằng mã + các lớp đã tham gia.
  const classes = await listClasses(user);

  return (
    <>
      <PageHeader title="Lớp học" />

      <div className="mb-6 space-y-4">
        {hasPermission(user, "class.join") && <JoinClassForm />}
      </div>

      {classes.length === 0 ? (
        <EmptyState title="Chưa có lớp nào" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <Link key={c.id} href={`/lop-hoc/${c.id}`} className="group">
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-ink group-hover:text-brand-700">{c.name}</p>
                  {c.teacherId === user.id && <Badge variant="brand">{c.joinCode}</Badge>}
                </div>
                {c.subject && <p className="mt-0.5 text-sm text-ink-soft">{c.subject}</p>}
                <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-soft">
                  <Users className="size-4" />
                  {c._count.members} học sinh · {c._count.assignments} bài
                </p>
                <p className="mt-1 text-xs text-ink-faint">GV: {c.teacher.fullName}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
