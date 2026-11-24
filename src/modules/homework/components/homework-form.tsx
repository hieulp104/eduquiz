"use client";

import { useEffect, useState, useTransition } from "react";
import { HOMEWORK_DRAFT_KEY } from "@/modules/worksheet/worksheet.docx";
import { useRouter } from "next/navigation";
import { LoaderCircle, RotateCcw } from "lucide-react";
import {
  Alert,
  Button,
  DATETIME_MAX,
  DATETIME_MIN,
  DateTimeField,
  Input,
  Select,
} from "@/components/ui";
import { RichTextEditor } from "@/components/ui/forms/rich-text-editor";
import { GRADES, HOMEWORK_PURPOSE_LABEL, SUBJECTS } from "@/common/enums";
import { toVnDateTimeLocal } from "@/lib/utils";
import type { UploadedFile } from "@/modules/files/files.constants";
import {
  createHomeworkAction,
  updateHomeworkAction,
} from "@/modules/homework/homework.actions";
import { AttachmentUploader } from "./attachment-uploader";
import { ClassPicker, type ClassOption } from "./class-picker";

/** Dữ liệu điền sẵn: khi sửa bài (kèm `homeworkId`) hoặc nhân bản từ bài khác. */
export type HomeworkInitial = {
  title: string;
  grade: number;
  subject: string;
  purpose: string;
  startAt: string;
  dueAt: string;
  contentHtml: string;
  showResult: boolean;
  requireLogin: boolean;
  classIds: string[];
  files: UploadedFile[];
};

type Props = {
  classes: ClassOption[];
  defaultGrade: number;
  defaultSubject: string;
  initial?: HomeworkInitial;
  /** Có id → chế độ sửa (Lưu = cập nhật bài này). */
  homeworkId?: string;
  /** Nhân bản: hiện ghi chú "đang tạo từ bài …". */
  copiedFrom?: string;
};

type Errors = Partial<
  Record<"title" | "purpose" | "time" | "classIds", string>
>;

function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-[15px] font-medium text-ink"
    >
      {children}
    </label>
  );
}

function FieldError({ children }: { children?: string }) {
  return children ? (
    <p className="mt-1.5 text-xs text-danger-600">{children}</p>
  ) : null;
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
          <label
            key={o.text}
            className="flex cursor-pointer items-center gap-2 text-[15px] text-ink"
          >
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

const QUICK_DUE = [
  { label: "Sau 1 ngày", days: 1 },
  { label: "3 ngày", days: 3 },
  { label: "1 tuần", days: 7 },
];

/** Cộng n ngày vào chuỗi ngày giờ (giờ VN), hạn chốt lúc 23:59 của ngày đó. */
function addDaysEndOfDay(base: string, days: number): string {
  const d = new Date(`${base.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.toISOString().slice(0, 10)}T23:59`;
}

/** Năm ngoài 2000–2099 (gõ nhầm kiểu 0003). Server kiểm tra cùng khoảng này. */
const outOfRange = (v: string) =>
  v !== "" && (v < DATETIME_MIN || v > DATETIME_MAX);

function timeError(startAt: string, dueAt: string): string | undefined {
  if (outOfRange(startAt) || outOfRange(dueAt))
    return "Năm phải nằm trong khoảng 2000 – 2099";
  if (startAt && dueAt && dueAt <= startAt)
    return "Thời gian kết thúc phải sau thời gian bắt đầu";
}

export function HomeworkForm({
  classes,
  defaultGrade,
  defaultSubject,
  initial,
  homeworkId,
  copiedFrom,
}: Props) {
  const editing = Boolean(homeworkId);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [grade, setGrade] = useState(initial?.grade ?? defaultGrade);
  const [subject, setSubject] = useState(initial?.subject ?? defaultSubject);
  const [purpose, setPurpose] = useState(initial?.purpose ?? "");
  const [startAt, setStartAt] = useState(initial?.startAt ?? "");
  const [dueAt, setDueAt] = useState(initial?.dueAt ?? "");
  const [contentHtml, setContentHtml] = useState(initial?.contentHtml ?? "");
  const [files, setFiles] = useState<UploadedFile[]>(initial?.files ?? []);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [showResult, setShowResult] = useState(initial?.showResult ?? true);
  const [requireLogin, setRequireLogin] = useState(
    initial?.requireLogin ?? false,
  );
  const [classIds, setClassIds] = useState<string[]>(initial?.classIds ?? []);

  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  // Nội dung mở sẵn cho trình soạn thảo + key để tạo lại editor khi nhận nội dung từ phiếu bài tập.
  const [initialContent, setInitialContent] = useState(
    initial?.contentHtml ?? "",
  );
  const [editorKey, setEditorKey] = useState(0);
  const [fromWorksheet, setFromWorksheet] = useState(false);

  // "Tạo bài tập online từ phiếu": trang phiếu để sẵn tên + nội dung trong sessionStorage.
  useEffect(() => {
    if (initial) return; // đang sửa / nhân bản — không lấy nháp từ phiếu
    try {
      const raw = sessionStorage.getItem(HOMEWORK_DRAFT_KEY);
      if (!raw) return;
      sessionStorage.removeItem(HOMEWORK_DRAFT_KEY); // dùng 1 lần
      const draft = JSON.parse(raw) as {
        title?: string;
        contentHtml?: string;
        grade?: number;
        subject?: string;
      };
      /* eslint-disable react-hooks/set-state-in-effect -- nhận dữ liệu chuyển sang từ trang khác, 1 lần */
      if (draft.title) setTitle(draft.title.slice(0, 200));
      if (draft.grade && draft.grade >= 1 && draft.grade <= 12)
        setGrade(draft.grade);
      if (draft.contentHtml) {
        setInitialContent(draft.contentHtml);
        setContentHtml(draft.contentHtml);
        setEditorKey((k) => k + 1);
      }
      if (
        draft.subject &&
        (SUBJECTS as readonly string[]).includes(draft.subject)
      )
        setSubject(draft.subject);
      setFromWorksheet(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      /* sessionStorage bị chặn — mở form trống */
    }
  }, [initial]);

  // Lỗi chỉ hiện sau lần bấm Lưu đầu tiên, rồi cập nhật theo từng thay đổi.
  const errors: Errors = {};
  if (!title.trim()) errors.title = "Vui lòng nhập tên bài tập";
  if (!purpose) errors.purpose = "Vui lòng chọn mục đích tạo đề";
  errors.time = timeError(startAt, dueAt);
  if (!errors.time) delete errors.time;
  if (classIds.length === 0) errors.classIds = "Vui lòng chọn lớp";
  // Lỗi thời gian hiện ngay khi chọn (người dùng vừa chọn xong là biết sai); lỗi khác đợi bấm Lưu.
  const shown: Errors = submitted ? errors : { time: errors.time };

  function setQuickDue(days: number) {
    const base = startAt || toVnDateTimeLocal(new Date());
    setDueAt(addDaysEndOfDay(base, days));
  }

  function save() {
    setSubmitted(true);
    setServerError(null);
    if (Object.keys(errors).length > 0) return;

    startTransition(async () => {
      const payload = {
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
      };
      const res = homeworkId
        ? await updateHomeworkAction(homeworkId, payload)
        : await createHomeworkAction(payload);
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
      <h1 className="mb-3 text-[15px] font-semibold uppercase text-ink">
        {editing ? "Sửa bài tập" : "Tạo bài tập mới"}
      </h1>

      <div className="space-y-5 rounded-lg bg-surface p-5 shadow-sm">
        {serverError && <Alert variant="danger">{serverError}</Alert>}
        {copiedFrom && (
          <Alert>
            Đang tạo bài mới từ “{copiedFrom}”. File đính kèm không được chép —
            thêm lại nếu cần.
          </Alert>
        )}
        {fromWorksheet && (
          <Alert>
            Đã điền sẵn tên và nội dung từ phiếu bài tập. Chọn mục đích, lớp rồi
            bấm Lưu.
          </Alert>
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
            <Select
              id="hw-grade"
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value))}
              className="h-[38px]"
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  Khối {g}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="hw-subject">Môn học</Label>
            <Select
              id="hw-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-[38px]"
            >
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
          <Select
            id="hw-purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="h-[38px]"
          >
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
          <div className="flex items-start justify-between gap-3">
            <Label>Thời gian nộp bài</Label>
            {(startAt || dueAt) && (
              <button
                type="button"
                onClick={() => {
                  setStartAt("");
                  setDueAt("");
                }}
                className="inline-flex items-center gap-1 rounded text-sm text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                <RotateCcw className="size-3.5" aria-hidden /> Xóa thời gian
              </button>
            )}
          </div>
          <div className="max-w-[640px] space-y-3">
            <div className="grid gap-1.5 sm:grid-cols-[5.5rem_1fr] sm:items-center sm:gap-3">
              <span className="text-sm text-ink-soft">Bắt đầu</span>
              <DateTimeField
                label="Bắt đầu"
                value={startAt}
                onChange={setStartAt}
                invalid={outOfRange(startAt)}
              />
            </div>
            <div className="grid gap-1.5 sm:grid-cols-[5.5rem_1fr] sm:items-center sm:gap-3">
              <span className="text-sm text-ink-soft">Hạn nộp</span>
              <DateTimeField
                label="Hạn nộp"
                defaultTime="23:59"
                value={dueAt}
                onChange={setDueAt}
                // Lịch làm mờ các ngày trước ngày bắt đầu.
                min={startAt || undefined}
                invalid={
                  outOfRange(dueAt) ||
                  (!!startAt && !!dueAt && dueAt <= startAt)
                }
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft sm:pl-[6.25rem]">
              <span>Chọn nhanh hạn nộp:</span>
              {QUICK_DUE.map((q) => (
                <button
                  key={q.days}
                  type="button"
                  onClick={() => setQuickDue(q.days)}
                  className="rounded-full border border-line px-2.5 py-1 text-ink hover:border-brand-500 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:hover:text-brand-300"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Bỏ trống nếu không muốn giới hạn thời gian.
          </p>
          <FieldError>{shown.time}</FieldError>
        </div>

        <div>
          <Label>Nội dung</Label>
          <AttachmentUploader
            files={files}
            setFiles={setFiles}
            onBusyChange={setUploadingFiles}
          />
          <RichTextEditor
            key={editorKey}
            defaultValue={initialContent}
            className="mt-3"
            onChange={setContentHtml}
            placeholder="Nhập nội dung, hướng dẫn làm bài..."
          />
        </div>

        <YesNo
          label="Cho xem kết quả"
          name="showResult"
          value={showResult}
          onChange={setShowResult}
        />
        <YesNo
          label="Đăng nhập để nộp bài"
          name="requireLogin"
          value={requireLogin}
          onChange={setRequireLogin}
        />

        <div>
          <Label>Giao cho lớp</Label>
          <ClassPicker
            classes={classes}
            selected={classIds}
            onChange={setClassIds}
          />
          <FieldError>{shown.classIds}</FieldError>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-3 pb-4">
        <Button
          variant="secondary"
          className="min-w-24 border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
          onClick={() =>
            router.push(homeworkId ? `/bai-tap/${homeworkId}` : "/bai-tap")
          }
        >
          Hủy
        </Button>
        <Button
          className="min-w-24"
          onClick={save}
          disabled={pending || uploadingFiles}
        >
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          {uploadingFiles ? "Đang tải file…" : editing ? "Lưu thay đổi" : "Lưu"}
        </Button>
      </div>
    </div>
  );
}
