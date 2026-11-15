"use client";

import { useTransition } from "react";
import { UserMinus } from "lucide-react";
import { removeStudentAction } from "@/modules/classes/classes.actions";

export function RemoveStudentButton({
  classId,
  studentId,
  studentName,
}: {
  classId: string;
  studentId: string;
  studentName: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      title="Xóa khỏi lớp"
      className="rounded-lg p-1.5 text-ink-faint hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
      onClick={() => {
        if (!confirm(`Xóa ${studentName} khỏi lớp?`)) return;
        startTransition(async () => {
          const res = await removeStudentAction({ classId, studentId });
          if (!res.ok) alert(res.message);
        });
      }}
    >
      <UserMinus className="size-4" />
    </button>
  );
}
