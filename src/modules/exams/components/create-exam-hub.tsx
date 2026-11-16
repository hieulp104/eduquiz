"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronUp,
  CloudUpload,
  FileSpreadsheet,
  Gamepad2,
  Hand,
  Landmark,
  ListTree,
  LoaderCircle,
  Megaphone,
  SquarePen,
  Type,
  type LucideIcon,
} from "lucide-react";
import { Alert } from "@/components/ui";
import { cn } from "@/lib/utils";
import { EXAM_DRAFT_KEY, type ExamDraftPayload } from "@/modules/exams/exam-draft";
import { parseExamText } from "@/modules/exams/exam-text";
import { soonHref } from "@/config/navigation";

type Option = {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Màu ô icon. */
  tone: string;
  href?: string;
  /** Mở hộp chọn file Excel thay vì chuyển trang. */
  pickExcel?: boolean;
  badge?: string;
  extraLink?: { label: string; href: string };
};

const ACCEPT = ".docx,.xlsx,.tex,.txt,.pdf,.png,.jpg,.jpeg";

/** File mẫu — sinh tại /api/exams/template, khớp với bộ đọc exam-import.ts. */
const SAMPLE_LINKS = [
  { label: "Đề mẫu Docx", href: "/api/exams/template?loai=docx" },
  { label: "File Excel mẫu", href: "/api/exams/template?loai=xlsx" },
  { label: "File LaTeX mẫu (.tex)", href: "/api/exams/template?loai=tex" },
  { label: "File đề Tiếng Anh mẫu (.docx)", href: "/api/exams/template?loai=tieng-anh" },
];

type Props = { folderId: string | null };

/** Trang "Tạo đề mới": tải file lên (trái) + các cách tạo đề Online / Offline (phải). */
export function CreateExamHub({ folderId }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const excelRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState({ online: true, offline: true });

  const q = folderId ? `thu-muc=${folderId}` : "";
  const withFolder = (path: string) => (q ? `${path}${path.includes("?") ? "&" : "?"}${q}` : path);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(file.name);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/exams/import", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? "Không đọc được file.");
      const draft = json as ExamDraftPayload;
      const found = parseExamText(draft.text);
      if (found.questions.length === 0) {
        throw new Error(draft.warnings[0] ?? found.warnings[0] ?? "Không tìm thấy câu hỏi nào trong file.");
      }
      sessionStorage.setItem(EXAM_DRAFT_KEY, JSON.stringify(draft));
      router.push(withFolder("/de-thi/soan?tu-file=1"));
    } catch (e) {
      setError((e as Error).message);
      setUploading(null);
    }
  }

  const online: Option[] = [
    {
      title: "Tự soạn Đề thi / Bài tập",
      description: "Dùng trình soạn thảo của EduQuiz để tạo đề trắc nghiệm: gõ câu hỏi, chọn đáp án đúng, đặt điểm từng câu.",
      icon: SquarePen,
      tone: "bg-orange-100 text-orange-500 dark:bg-orange-950/50",
      href: withFolder("/de-thi/soan"),
    },
    {
      title: "Tạo đề thi tương tác",
      description: "Đề thi, trò chơi học tập cho học sinh làm trực tiếp trên màn hình với các hoạt động sinh động.",
      icon: Gamepad2,
      tone: "bg-muted text-ink-soft",
      href: soonHref("Tạo đề thi tương tác"),
      badge: "Mới",
    },
    {
      title: "Tạo đề thi đánh giá năng lực",
      description: "Tạo nhiều bộ đề đánh giá năng lực theo bản thiết kế mẫu, tối ưu quy trình xây dựng đề.",
      icon: ListTree,
      tone: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300",
      href: soonHref("Tạo đề thi đánh giá năng lực"),
    },
    {
      title: "Tạo đề từ Ma trận đề",
      description: "Sinh ngẫu nhiên đề mới từ các chủ đề trong ngân hàng câu hỏi, theo số lượng câu bạn chọn cho mỗi chủ đề.",
      icon: Landmark,
      tone: "bg-lime-100 text-lime-600 dark:bg-lime-950/50 dark:text-lime-300",
      href: withFolder("/de-thi/ma-tran"),
    },
    {
      title: "Tạo đề thi từ file Excel",
      description: "Import câu hỏi từ file Excel để tạo đề thi nhanh chóng và thuận tiện.",
      icon: FileSpreadsheet,
      tone: "bg-lime-100 text-lime-600 dark:bg-lime-950/50 dark:text-lime-300",
      pickExcel: true,
      extraLink: { label: "Tải file mẫu", href: "/api/exams/template?loai=xlsx" },
    },
  ];

  const offline: Option[] = [
    {
      title: "Tạo đề offline thủ công",
      description: "Nhập tay đáp án cho các bài thi offline, phù hợp cho việc chấm điểm thủ công.",
      icon: Hand,
      tone: "bg-muted text-ink-soft",
      href: soonHref("Tạo đề offline thủ công"),
    },
    {
      title: "Tạo đề thi offline bằng Text",
      description: "Tạo đề thi offline bằng cách nhập văn bản trực tiếp, dễ dàng và nhanh chóng.",
      icon: Type,
      tone: "bg-muted text-ink-soft",
      href: soonHref("Tạo đề thi offline bằng Text"),
    },
    {
      title: "Tạo đề thi offline từ file Excel",
      description: "Import câu hỏi từ file Excel để tạo đề thi offline nhanh chóng và thuận tiện.",
      icon: FileSpreadsheet,
      tone: "bg-muted text-ink-soft",
      href: soonHref("Tạo đề thi offline từ file Excel"),
    },
  ];

  const renderOption = (o: Option) => {
    const inner = (
      <>
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-lg", o.tone)}>
          <o.icon className="size-6" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-[15px] font-medium text-ink group-hover:text-brand-700">
            {o.title}
            {o.badge && <span className="rounded-full bg-danger-600 px-2 py-0.5 text-xs font-bold text-white">{o.badge}</span>}
          </span>
          <span className="mt-1.5 block text-sm leading-relaxed text-ink-soft">{o.description}</span>
        </span>
      </>
    );
    const cls = "group flex w-full gap-4 border-b border-line px-4 py-4 text-left last:border-b-0 hover:bg-muted/60";
    return (
      <li key={o.title} className="relative">
        {o.pickExcel ? (
          <button type="button" className={cls} onClick={() => excelRef.current?.click()}>
            {inner}
          </button>
        ) : (
          <Link href={o.href!} className={cls}>
            {inner}
          </Link>
        )}
        {o.extraLink && (
          <a
            href={o.extraLink.href}
            className="absolute top-4 right-4 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
          >
            {o.extraLink.label}
          </a>
        )}
      </li>
    );
  };

  const renderSection = (id: "online" | "offline", title: string, items: Option[]) => (
    <section className="overflow-hidden rounded-lg bg-surface shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((s) => ({ ...s, [id]: !s[id] }))}
        aria-expanded={open[id]}
        className="flex w-full items-center justify-between border-b border-line px-4 py-4 text-lg font-medium text-ink"
      >
        {title}
        <ChevronUp className={cn("size-4 text-ink-soft transition-transform", !open[id] && "rotate-180")} />
      </button>
      {open[id] && <ul>{items.map(renderOption)}</ul>}
    </section>
  );

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-medium text-ink">Tạo đề mới</h1>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_720px]">
        {/* ── Tải file ── */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void upload(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex min-h-[600px] flex-col items-center justify-center rounded-lg bg-surface px-6 py-10 text-center shadow-sm transition-colors",
            dragging && "bg-brand-50 ring-2 ring-brand-500 ring-inset dark:bg-brand-900/20",
          )}
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading !== null}
            className="flex flex-col items-center"
          >
            {uploading ? (
              <LoaderCircle className="size-16 animate-spin text-brand-700" strokeWidth={1.5} />
            ) : (
              <CloudUpload className="size-16 text-brand-700 dark:text-brand-300" strokeWidth={1.75} />
            )}
            <span className="mt-4 text-lg font-medium text-ink">
              {uploading ? `Đang đọc “${uploading}”…` : "Chọn File hoặc kéo thả File vào đây"}
            </span>
          </button>
          <p className="mt-4 text-sm text-ink-soft">Hỗ trợ các định dạng .docx, .xlsx, .tex, .txt</p>
          <p className="mt-1 text-sm text-ink-soft">
            Upload file <b className="text-ink">Đề thi trắc nghiệm</b> — mỗi câu bắt đầu bằng “Câu 1.”, “Question 1.” hoặc “1.”. Đáp án đúng:
            tô màu chữ (VD chữ đỏ), tô nền, gạch chân nhãn, đánh dấu *, hoặc có bảng đáp án cuối đề. Đề cấu trúc 2025: nhập PHẦN I.
          </p>
          <p className="mt-1 text-sm text-ink-soft">File PDF và ảnh (chụp đề, viết tay) đang được phát triển.</p>

          <p className="mt-6 flex flex-wrap justify-center gap-x-1.5 gap-y-1 text-sm font-medium">
            {SAMPLE_LINKS.map((l, i) => (
              <span key={l.href} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-ink-faint">|</span>}
                <a href={l.href} className="text-brand-700 hover:underline dark:text-brand-300">
                  {l.label}
                </a>
              </span>
            ))}
          </p>

          {error && (
            <Alert variant="danger" className="mt-5 w-full max-w-[946px] text-left">
              {error}
            </Alert>
          )}

          <div className="mt-5 flex w-full max-w-[946px] items-center gap-3 rounded-md border border-line bg-muted/50 px-5 py-3 text-left text-base font-medium text-ink-soft">
            <Megaphone className="size-5 shrink-0" />
            File phiếu bài tập xuất từ EduQuiz (.docx) tải lên lại được ngay — đọc cả trang đáp án.
          </div>

          <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
          <input ref={excelRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
        </div>

        {/* ── Các cách tạo đề ── */}
        <div className="space-y-6">
          {renderSection("online", "Online", online)}
          {renderSection("offline", "Offline", offline)}
        </div>
      </div>
    </div>
  );
}
