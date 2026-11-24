"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Alert, Button, FormField, Input, Select, Textarea } from "@/components/ui";
import { SUBJECTS, TEACHING_GRADES, gradeLabel, subjectsForGrade } from "@/common/enums";
import { PurposeSelect } from "@/modules/exams/components/purpose-select";
import { PricingFields } from "@/modules/publish/components/pricing-fields";
import type { PriceMode } from "@/modules/publish/publish.types";

export type ExamSettingsValue = {
  title: string;
  grade: number | null;
  subject: string | null;
  /** Mã trong EXAM_PURPOSE_GROUPS. */
  purpose: string | null;
  durationMinutes: number;
  description: string;
  priceMode: PriceMode;
  price: number;
  priceNote: string;
};

type Props = {
  initial: ExamSettingsValue;
  submitLabel: string;
  onCancel: () => void;
  /** Trả về thông báo lỗi, hoặc null nếu lưu thành công. */
  onSubmit: (value: ExamSettingsValue) => Promise<string | null>;
};

/** "Cấu hình chung" của đề: tên, khối, môn, mục đích, thời gian, giá, mô tả. */
export function ExamSettingsForm({ initial, submitLabel, onCancel, onSubmit }: Props) {
  const [v, setV] = useState(initial);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = <K extends keyof ExamSettingsValue>(k: K, value: ExamSettingsValue[K]) => setV((s) => ({ ...s, [k]: value }));

  const subjects = v.grade === null ? [...SUBJECTS] : subjectsForGrade(v.grade);
  if (v.subject && !subjects.includes(v.subject)) subjects.push(v.subject);
  const missing = {
    title: !v.title.trim(),
    purpose: !v.purpose,
    duration: !(v.durationMinutes >= 1 && v.durationMinutes <= 300),
    price: v.priceMode !== "FREE" && v.price < 1000,
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (missing.title || missing.purpose || missing.duration || missing.price) return;
    setPending(true);
    setError(null);
    const err = await onSubmit({ ...v, title: v.title.trim(), description: v.description.trim() });
    setPending(false);
    if (err) setError(err);
  }

  const hint = (show: boolean, text: string) => show && touched && <p className="text-sm text-danger-600">{text}</p>;

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-[1040px] rounded-lg bg-surface px-6 py-8 shadow-sm sm:px-16">
      <h2 className="text-[15px] font-medium text-ink uppercase">Cấu hình chung</h2>

      <div className="mt-6 space-y-5 sm:px-4">
        <FormField label="Tên" htmlFor="exam-title">
          <Input id="exam-title" value={v.title} maxLength={200} onChange={(e) => set("title", e.target.value)} />
          {hint(missing.title, "Vui lòng nhập tên đề")}
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2 sm:gap-8">
          <FormField label="Khối học" htmlFor="exam-grade">
            <Select
              id="exam-grade"
              value={v.grade ?? ""}
              onChange={(e) => set("grade", e.target.value === "" ? null : Number(e.target.value))}
            >
              <option value="">---Chọn khối---</option>
              {TEACHING_GRADES.map((g) => (
                <option key={g} value={g}>
                  {gradeLabel(g)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Môn học" htmlFor="exam-subject">
            <Select id="exam-subject" value={v.subject ?? ""} onChange={(e) => set("subject", e.target.value || null)}>
              <option value="">---Chọn môn---</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="grid gap-5 sm:grid-cols-[1fr_220px] sm:gap-8">
          <FormField label="Mục đích tạo đề" htmlFor="exam-purpose">
            <PurposeSelect id="exam-purpose" value={v.purpose} onChange={(p) => set("purpose", p)} />
            {hint(missing.purpose, "Vui lòng chọn mục đích tạo đề")}
          </FormField>
          <FormField label="Thời gian làm bài (phút)" htmlFor="exam-duration">
            <Input
              id="exam-duration"
              type="number"
              min={1}
              max={300}
              value={Number.isFinite(v.durationMinutes) ? v.durationMinutes : ""}
              onChange={(e) => set("durationMinutes", Number(e.target.value))}
            />
            {hint(missing.duration, "Từ 1 đến 300 phút")}
          </FormField>
        </div>

        <div>
          <PricingFields value={v} onChange={(patch) => setV((s) => ({ ...s, ...patch }))} />
          {hint(missing.price, "Nhập giá tiền từ 1.000 đ trở lên")}
        </div>

        <FormField label="Mô tả" htmlFor="exam-description">
          <Textarea
            id="exam-description"
            rows={6}
            maxLength={2000}
            value={v.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Hướng dẫn làm bài, ghi chú cho học sinh… (không bắt buộc)"
          />
        </FormField>

        {error && <Alert variant="danger">{error}</Alert>}
      </div>

      <div className="mt-8 flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={pending} className="text-brand-700 dark:text-brand-300">
          Hủy
        </Button>
        <Button type="submit" variant="decisive" disabled={pending}>
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
