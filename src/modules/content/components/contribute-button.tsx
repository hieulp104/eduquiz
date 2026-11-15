"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { CONTENT_PATH, type ShareableExam } from "@/modules/content/content.types";
import { ContributeDialog } from "./contribute-dialog";

/** Nút "Đóng góp nội dung" + hộp thoại. `?dong-gop=<examId>` (từ trang đề) → mở sẵn với đề đó. */
export function ContributeButton({ exams, presetExamId }: { exams: ShareableExam[]; presetExamId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(presetExamId));
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-800"
      >
        <Plus className="size-4" /> Đóng góp nội dung
      </button>
      <ContributeDialog
        open={open}
        exams={exams}
        defaultExamId={presetExamId}
        onClose={() => {
          setOpen(false);
          if (presetExamId) router.replace(CONTENT_PATH, { scroll: false });
        }}
      />
    </>
  );
}
