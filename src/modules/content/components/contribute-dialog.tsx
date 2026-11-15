"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, LoaderCircle, X } from "lucide-react";
import { Alert, Button, FormField, Input, Modal, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { GRADES, gradeLabel, SUBJECTS } from "@/common/enums";
import { formatFileSize, MAX_FILE_SIZE, type UploadedFile } from "@/modules/files/files.constants";
import { createContentAction } from "@/modules/content/content.actions";
import {
  CONTENT_KIND_LABEL,
  CONTENT_KINDS,
  CONTENT_PATH,
  FILE_ACCEPT,
  FILE_KINDS,
  type ContentKind,
  type ShareableExam,
} from "@/modules/content/content.types";
import { KindIcon } from "./content-card";

type Props = {
  open: boolean;
  onClose: () => void;
  exams: ShareableExam[];
  /** Mở từ trang đề ("Chia sẻ") → chọn sẵn đề này. */
  defaultExamId?: string | null;
};

/** "Đóng góp nội dung": chọn loại → đề của mình / tải file / dán link video → tên, khối, môn, mô tả. */
export function ContributeDialog({ open, onClose, exams, defaultExamId = null }: Props) {
  const router = useRouter();
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<ContentKind>("EXAM");
  const [examId, setExamId] = useState("");
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pickExam(id: string) {
    setExamId(id);
    const e = exams.find((x) => x.id === id);
    if (!e) return;
    setTitle(e.title);
    setGrade(e.grade != null ? String(e.grade) : "");
    setSubject(e.subject ?? "");
    setDescription(e.description ?? "");
  }

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- làm mới mỗi lần mở */
    setKind("EXAM");
    setFile(null);
    setUrl("");
    setTitle("");
    setGrade("");
    setSubject("");
    setDescription("");
    setError(null);
    setExamId("");
    const preset = defaultExamId ? exams.find((e) => e.id === defaultExamId && !e.sharedId) : undefined;
    if (preset) {
      setExamId(preset.id);
      setTitle(preset.title);
      setGrade(preset.grade != null ? String(preset.grade) : "");
      setSubject(preset.subject ?? "");
      setDescription(preset.description ?? "");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, defaultExamId, exams]);

  async function upload(f: File | undefined) {
    if (!f) return;
    setError(null);
    if (f.size > MAX_FILE_SIZE) return setError("File vượt quá 20MB.");
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", f);
      const res = await fetch("/api/files", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? "Không tải được file.");
      if (file) void fetch(`/api/files/${file.id}`, { method: "DELETE" });
      setFile(json);
      if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function close() {
    // File đã tải lên nhưng không đóng góp → xóa cho khỏi rác.
    if (file) void fetch(`/api/files/${file.id}`, { method: "DELETE" });
    onClose();
  }

  function submit() {
    setError(null);
    const common = { title, description, grade: grade === "" ? null : Number(grade), subject };
    const input =
      kind === "EXAM" ? { kind, examId, ...common } : kind === "VIDEO" ? { kind, url, ...common } : { kind, fileId: file?.id ?? "", ...common };
    startTransition(async () => {
      const res = await createContentAction(input);
      if (!res.ok) return setError(res.message);
      setFile(null); // đã gắn vào kho — không xóa khi đóng
      // Chỉ chuyển trang (không gọi onClose: nơi mở có thể tự đổi URL → 2 lần chuyển trang tranh nhau).
      router.push(`${CONTENT_PATH}/${res.data.id}`);
    });
  }

  const source = kind === "EXAM" ? Boolean(examId) : kind === "VIDEO" ? Boolean(url.trim()) : Boolean(file);
  const canSubmit = source && Boolean(title.trim()) && !uploading;
  const freeExams = exams.filter((e) => !e.sharedId);

  return (
    <Modal
      open={open}
      onClose={close}
      size="md"
      title="Đóng góp nội dung"
      description="Nội dung được chia sẻ cho mọi giáo viên trong hệ thống — xem, tải về, lưu về thư viện."
      closeButton
      footer={
        <>
          <Button variant="secondary" onClick={close} className="w-24">
            Hủy
          </Button>
          <Button onClick={submit} disabled={pending || !canSubmit} className="min-w-32">
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            Đóng góp
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div role="radiogroup" aria-label="Loại nội dung" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {CONTENT_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k);
                setError(null);
              }}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-xs font-medium transition-colors",
                kind === k ? "border-brand-500 bg-muted text-brand-700 ring-1 ring-brand-500 dark:text-brand-300" : "border-line text-ink-soft hover:border-brand-300",
              )}
            >
              <KindIcon kind={k} className="size-9" />
              {CONTENT_KIND_LABEL[k].section}
            </button>
          ))}
        </div>

        {kind === "EXAM" && (
          <FormField label="Chọn đề của bạn" htmlFor={`${uid}-exam`} hint="Người khác xem được câu hỏi + đáp án và lưu bản sao về thư viện của họ.">
            {exams.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-ink-soft">
                Bạn chưa có đề nào —{" "}
                <Link href="/de-thi/tao-moi" className="text-brand-700 hover:underline dark:text-brand-300">
                  tạo đề mới
                </Link>
                .
              </p>
            ) : (
              <Select id={`${uid}-exam`} value={examId} onChange={(e) => pickExam(e.target.value)}>
                <option value="">— Chọn đề —</option>
                {freeExams.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} ({e.questionCount} câu)
                  </option>
                ))}
                {exams.some((e) => e.sharedId) && (
                  <optgroup label="Đã có trên kho">
                    {exams
                      .filter((e) => e.sharedId)
                      .map((e) => (
                        <option key={e.id} value={e.id} disabled>
                          {e.title}
                        </option>
                      ))}
                  </optgroup>
                )}
              </Select>
            )}
          </FormField>
        )}

        {FILE_KINDS.has(kind) && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">File</p>
            {file ? (
              <div className="flex items-center gap-3 rounded-lg border border-line bg-muted/50 px-3 py-2.5">
                <KindIcon kind={kind} className="size-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{file.name}</p>
                  <p className="text-xs text-ink-soft">{formatFileSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void fetch(`/api/files/${file.id}`, { method: "DELETE" });
                    setFile(null);
                  }}
                  aria-label="Bỏ file"
                  className="rounded p-1 text-ink-faint hover:bg-surface hover:text-danger-600"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void upload(e.dataTransfer.files?.[0]);
                }}
                className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-line px-4 py-6 text-sm text-ink-soft hover:border-brand-500 hover:text-brand-700"
              >
                {uploading ? <LoaderCircle className="size-8 animate-spin text-brand-600" /> : <CloudUpload className="size-8 text-brand-600" strokeWidth={1.5} />}
                Kéo thả file hoặc bấm để chọn (tối đa 20MB)
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={FILE_ACCEPT[kind]}
              className="hidden"
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {kind === "VIDEO" && (
          <FormField
            label="Link video"
            htmlFor={`${uid}-url`}
            hint="Chỉ lưu đường link (YouTube, Google Drive…) — không tải video lên hệ thống. Bấm vào sẽ mở trang video."
          >
            <Input id={`${uid}-url`} type="url" value={url} maxLength={500} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
          </FormField>
        )}

        <FormField label="Tên nội dung" htmlFor={`${uid}-title`}>
          <Input id={`${uid}-title`} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Đề cương ôn tập giữa kỳ I" />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Khối" htmlFor={`${uid}-grade`}>
            <Select id={`${uid}-grade`} value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">— Chọn khối —</option>
              {[...GRADES, 0].map((g) => (
                <option key={g} value={g}>
                  {gradeLabel(g)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Môn" htmlFor={`${uid}-subject`}>
            <Select id={`${uid}-subject`} value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="">— Chọn môn —</option>
              {[...new Set([...SUBJECTS, ...(subject ? [subject] : [])])].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField label="Mô tả (không bắt buộc)" htmlFor={`${uid}-desc`}>
          <Textarea id={`${uid}-desc`} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} placeholder="Mục đích sử dụng, thời điểm dùng…" />
        </FormField>

        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
