"use client";

import { useId } from "react";
import { FormField, Input } from "@/components/ui";

/** Tên đề + thời gian (phút) — dùng chung cho "Tự chọn câu hỏi" và "Tạo ma trận đề thi". */
export function ExamSettingsFields({
  title,
  onTitle,
  duration,
  onDuration,
}: {
  title: string;
  onTitle: (v: string) => void;
  duration: string;
  onDuration: (v: string) => void;
}) {
  const uid = useId();
  return (
    <div className="space-y-3">
      <FormField label="Tên đề" htmlFor={`${uid}-t`}>
        <Input id={`${uid}-t`} value={title} maxLength={200} onChange={(e) => onTitle(e.target.value)} />
      </FormField>
      <FormField label="Thời gian làm bài (phút)" htmlFor={`${uid}-d`}>
        <Input id={`${uid}-d`} type="number" min={1} max={300} value={duration} onChange={(e) => onDuration(e.target.value)} />
      </FormField>
    </div>
  );
}
