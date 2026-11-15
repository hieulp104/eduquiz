"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { deleteExamAction } from "@/modules/exams/exams.actions";

/** Nút xóa đề. `asMenuItem` = dòng chữ đỏ trong menu trang chi tiết đề. */
export function DeleteExamButton({ examId, asMenuItem }: { examId: string; asMenuItem?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!confirm("Xóa đề này? Bài đã giao vẫn giữ kết quả.")) return;
    startTransition(async () => {
      const res = await deleteExamAction(examId);
      if (!res.ok) return alert(res.message);
      router.push("/de-thi");
    });
  };

  if (asMenuItem) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-danger-600 hover:bg-danger-50 disabled:opacity-60 dark:hover:bg-danger-700/20"
      >
        <Trash2 className="size-4" /> {pending ? "Đang xóa…" : "Xóa"}
      </button>
    );
  }

  return (
    <Button variant="secondary" disabled={pending} onClick={onClick}>
      <Trash2 className="size-4" /> Xóa đề
    </Button>
  );
}
