"use client";

import { useRouter } from "next/navigation";
import { updateExamSettingsAction } from "@/modules/exams/exams.actions";
import { ExamSettingsForm, type ExamSettingsValue } from "./composer/exam-settings-form";

/** Trang "Cài đặt" của đề: form Cấu hình chung → lưu → về trang chi tiết. */
export function ExamSettingsEditor({ examId, initial }: { examId: string; initial: ExamSettingsValue }) {
  const router = useRouter();
  return (
    <ExamSettingsForm
      initial={initial}
      submitLabel="Lưu"
      onCancel={() => router.push(`/de-thi/${examId}`)}
      onSubmit={async (v) => {
        const res = await updateExamSettingsAction({ ...v, id: examId });
        if (!res.ok) return res.message;
        router.push(`/de-thi/${examId}`);
        router.refresh();
        return null;
      }}
    />
  );
}
