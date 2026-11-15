"use client";

import { useEffect, useState, useTransition } from "react";
import { HOMEWORK_DRAFT_KEY } from "@/modules/worksheet/worksheet.docx";
import { useRouter } from "next/navigation";
import { CalendarClock, LoaderCircle, RotateCcw } from "lucide-react";
import { Alert, Button, Input, Select } from "@/components/ui";
import { RichTextEditor } from "@/components/ui/forms/rich-text-editor";
import { GRADES, HOMEWORK_PURPOSE_LABEL, SUBJECTS } from "@/common/enums";
import { cn } from "@/lib/utils";
import type { UploadedFile } from "@/modules/files/files.constants";
import { createHomeworkAction } from "@/modules/homework/homework.actions";
import { AttachmentUploader } from "./attachment-uploader";
import { ClassPicker, type ClassOption } from "./class-picker";

type Props = {
  classes: ClassOption[];
  defaultGrade: number;
  defaultSubject: string;
};

type Errors = Partial<Record<"title" | "purpose" | "time" | "classIds", string>>;

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-[15px] font-medium text-ink">
      {children}
    </label>
  );
}

function FieldError({ children }: { children?: string }) {
  return children ? <p className="mt-1.5 text-xs text-danger-600">{children}</p> : null;
}

function YesNo({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <fieldset className="grid grid-cols-[1fr_auto] items-center gap-4 sm:grid-cols-2">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden className="text-[15px] font-medium text-ink">
        {label}
      </span>
      <div className="flex gap-8">
        {[
          { v: false, text: "Không" },
          { v: true, text: "Có" },
        ].map((o) => (
          <label key={o.text} className="flex cursor-pointer items-center gap-2 text-[15px] text-ink">
            <input
              type="radio"
              name={name}
              checked={value === o.v}
              onChange={() => onChange(o.v)}
              className="size-[18px] accent-brand-800"
            />
            {o.text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Ô ngày giờ có icon lịch ở bên phải. */
function DateTimeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <Input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "peer h-[42px] pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0",
          // Chưa có giá trị: giấu "mm/dd/yyyy" của trình duyệt, hiện chữ "Từ"/"Đến"; đang nhập thì hiện lại.
          !value && "text-transparent focus:text-ink",
        )}
      />
      {!value && (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[15px] text-ink-soft peer-focus:hidden">
          {label}
        </span>
      )}
      <CalendarClock className="pointer-events-none absolute top-1/2 right-3 size-[18px] -translate-y-1/2 text-ink-soft" />
    </label>
  );
}

export function HomeworkForm({ classes, defaultGrade, defaultSubject }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState(defaultGrade);
  const [subject, setSubject] = useState(defaultSubject);
  const [purpose, setPurpose] = useState("");
  const [startAt, setStartAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [showResult, setShowResult] = useState(true);
  const [requireLogin, setRequireLogin] = useState(false);
  const [classIds, setClassIds] = useState<string[]>([]);

  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  // Nội dung mở sẵn cho trình soạn thảo + key để tạo lại editor khi nhận nội dung từ phiếu bài tập.
  const [initialContent, setInitialContent] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [fromWorksheet, setFromWorksheet] = useState(false);

  // "Tạo bài tập online từ phiếu": trang phiếu để sẵn tên + nội dung trong sessionStorage.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(HOMEWORK_DRAFT_KEY);
      if (!raw) return;
      sessionStorage.removeItem(HOMEWORK_DRAFT_KEY); // dùng 1 lần
      const draft = JSON.parse(raw) as { title?: string; contentHtml?: string; grade?: number };
      /* eslint-disable react-hooks/set-state-in-effect -- nhận dữ liệu chuyển sang từ trang khác, 1 lần */
      if (draft.title) setTitle(draft.title.slice(0, 200));
      if (draft.grade && draft.grade >= 1 && draft.grade <= 12) setGrade(draft.grade);
      if (draft.contentHtml) {
        setInitialContent(draft.contentHtml);
        setContentHtml(draft.contentHtml);
        setEditorKey((k) => k + 1);
      }
      setSubject("Toán");
      setFromWorksheet(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      /* sessionStorage bị chặn — mở form trống */
    }
  }, []);

  // Lỗi chỉ hiện sau lần bấm Lưu đầu tiên, rồi cập nhật theo từng thay đổi.
  const errors: Errors = {};
  if (!title.trim()) errors.title = "Vui lòng nhập tên bài tập";
  if (!purpose) errors.purpose = "Vui lòng chọn mục đích tạo đề";
  if (startAt && dueAt && dueAt <= startAt) errors.time = "Thời gian kết thúc phải sau thời gian bắt đầu";
  if (classIds.length === 0) errors.classIds = "Vui lòng chọn lớp";
  const shown = submitted ? errors : {};

  function save() {
    setSubmitted(true);
    setServerError(null);
    if (Object.keys(errors).length > 0) return;

    startTransition(async () => {
      const res = await createHomeworkAction({
        title,
        grade,
        subject,
        purpose,
        startAt,
        dueAt,
        contentHtml,
        showResult,
        requireLogin,
        classIds,
        fileIds: files.map((f) => f.id),
      });
      if (!res.ok) {
        setServerError(res.message);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      router.push(`/bai-tap/${res.data.id}`);
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <h1 className="mb-3 text-[15px] font-semibold uppercase text-ink">Tạo bài tập mới</h1>

      <div className="space-y-5 rounded-lg bg-surface p-5 shadow-sm">
        {serverError && <Alert variant="danger">{serverError}</Alert>}
        {fromWorksheet && (
          <Alert>Đã điền sẵn tên và nội dung từ phiếu bài tập. Chọn mục đích, lớp rồi bấm Lưu.</Alert>
        )}

        <div>
          <Label htmlFor="hw-title">Tên</Label>
          <Input
            id="hw-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nhập tên ..."
            maxLength={200}
            className="h-[38px]"
          />
          <FieldError>{shown.title}</FieldError>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="hw-grade">Khối học</Label>
            <Select id="hw-grade" value={grade} onChange={(e) => setGrade(Number(e.target.value))} className="h-[38px]">
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  Khối {g}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="hw-subject">Môn học</Label>
            <Select id="hw-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-[38px]">
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="hw-purpose">Mục đích tạo bài tập</Label>
          <Select id="hw-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} className="h-[38px]">
            <option value="">---Chọn mục đích---</option>
            {Object.entries(HOMEWORK_PURPOSE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <FieldError>{shown.purpose}</FieldError>
        </div>

        <div>
          <Label>Thời gian nộp bài</Label>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_150px]">
            <DateTimeInput label="Từ" value={startAt} onChange={setStartAt} />
            <DateTimeInput label="Đến" value={dueAt} onChange={setDueAt} />
            <Button
              variant="secondary"
              className="h-[38px]"
              onClick={() => {
                setStartAt("");
                setDueAt("");
              }}
            >
              <RotateCcw className="size-4" /> Đặt lại
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-soft">Bỏ trống nếu không muốn giới hạn thời gian.</p>
          <FieldError>{shown.time}</FieldError>
        </div>

        <div>
          <Label>Nội dung</Label>
          <AttachmentUploader files={files} setFiles={setFiles} onBusyChange={setUploadingFiles} />
          <RichTextEditor
            key={editorKey}
            defaultValue={initialContent}
            className="mt-3"
            onChange={setContentHtml}
            placeholder="Nhập nội dung, hướng dẫn làm bài..."
          />
        </div>

        <YesNo label="Cho xem kết quả" name="showResult" value={showResult} onChange={setShowResult} />
        <YesNo label="Đăng nhập để nộp bài" name="requireLogin" value={requireLogin} onChange={setRequireLogin} />

        <div>
          <Label>Giao cho lớp</Label>
          <ClassPicker classes={classes} selected={classIds} onChange={setClassIds} />
          <FieldError>{shown.classIds}</FieldError>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-3 pb-4">
        <Button
          variant="secondary"
          className="min-w-24 border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
          onClick={() => router.push("/bai-tap")}
        >
          Hủy
        </Button>
        <Button className="min-w-24" onClick={save} disabled={pending || uploadingFiles}>
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          {uploadingFiles ? "Đang tải file..." : "Lưu"}
        </Button>
      </div>
    </div>
  );
}
