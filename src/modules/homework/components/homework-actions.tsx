"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { Alert, Button, buttonClass, Modal } from "@/components/ui";
import { deleteHomeworkAction } from "@/modules/homework/homework.actions";

/** Nút ở đầu trang chi tiết bài tập: Sửa · Nhân bản · Xóa (có hộp xác nhận). */
export function HomeworkActions({
  homeworkId,
  title,
}: {
  homeworkId: string;
  title: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await deleteHomeworkAction(homeworkId);
      if (!res.ok) return setError(res.message);
      router.push("/bai-tap");
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={`/bai-tap/${homeworkId}/sua`}
        className={buttonClass("primary", "sm")}
      >
        <Pencil className="size-4" aria-hidden /> Sửa
      </Link>
      <Link
        href={`/bai-tap/tao-moi?tu=${homeworkId}`}
        className={buttonClass("secondary", "sm")}
      >
        <Copy className="size-4" aria-hidden /> Nhân bản
      </Link>
      <Button
        size="sm"
        variant="ghost"
        className="text-danger-600 hover:bg-danger-600/10 hover:text-danger-600"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="size-4" aria-hidden /> Xóa
      </Button>

      <Modal
        open={confirming}
        onClose={() => !pending && setConfirming(false)}
        title="Xóa bài tập này?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Giữ lại
            </Button>
            <Button variant="danger" onClick={remove} disabled={pending}>
              {pending ? "Đang xóa…" : "Xóa bài tập"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          “{title}” sẽ biến mất khỏi danh sách bài tập và các lớp được giao.
        </p>
        {error && (
          <Alert variant="danger" className="mt-3">
            {error}
          </Alert>
        )}
      </Modal>
    </div>
  );
}
