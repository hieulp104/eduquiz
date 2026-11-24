"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Download,
  FilePlus2,
  FileQuestion,
  Inbox,
  Lightbulb,
  LoaderCircle,
  RefreshCw,
  Settings,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui";
import { GRADES, SUBJECTS } from "@/common/enums";
import {
  createExamFromWorksheetAction,
  loadBookTreeAction,
  pickQuestionAction,
} from "@/modules/worksheet/worksheet.actions";
import {
  docxFileName,
  exportWorksheetDocx,
  HOMEWORK_DRAFT_KEY,
  worksheetToHtml,
} from "@/modules/worksheet/worksheet.docx";
import {
  DEFAULT_WORKSHEET_SETTINGS,
  MAX_WORKSHEET_QUESTIONS,
  type BankBook,
  type BankTreeNode,
  type WorksheetQuestion,
  type WorksheetSettings,
} from "@/modules/worksheet/worksheet.types";
import { BankTree } from "./bank-tree";
import { WorksheetSettingsDialog } from "./worksheet-settings-dialog";

const LETTERS = "ABCDEFGH";
const DRAFT_KEY = "eduquiz:worksheet-draft";

type Props = {
  books: BankBook[];
  initialBookId: string | null;
  initialSubject: string;
  initialTree: BankTreeNode[];
  feedbackHref: string;
};

type Draft = {
  bookId: string | null;
  title: string;
  questions: WorksheetQuestion[];
  settings: WorksheetSettings;
};

const defaultTitle = (subject: string, grade: number) =>
  `Phiếu bài tập ${subject} lớp ${grade}`;

const SELECT =
  "h-[38px] w-full appearance-none rounded-md border border-line bg-surface bg-[length:10px] bg-[right_12px_center] bg-no-repeat px-3 pr-8 text-[15px] text-ink focus:border-brand-500 focus:outline-none";
// Tam giác ▼ giống mẫu (SVG nhúng — đổi màu theo currentColor không được trong background nên dùng xám trung tính).
const CARET = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M0 0h10L5 6z' fill='%236b7483'/%3E%3C/svg%3E\")",
};

/** Nút nhỏ trên thanh công cụ phiếu. */
function ToolbarButton({
  icon: Icon,
  children,
  onClick,
  disabled,
  tone = "muted",
  busy,
}: {
  icon: typeof Download;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "outline" | "muted" | "primary" | "plain";
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed",
        tone === "outline" &&
          "border border-brand-700 bg-surface text-brand-800 hover:bg-brand-50 dark:border-brand-300 dark:text-brand-200",
        tone === "muted" &&
          "bg-muted text-ink-soft enabled:hover:bg-line disabled:opacity-55",
        tone === "primary" &&
          "bg-brand-700 text-white enabled:hover:bg-brand-800 disabled:bg-brand-300 dark:disabled:bg-brand-900",
        tone === "plain" &&
          "border border-line bg-surface text-ink hover:bg-muted",
      )}
    >
      {busy ? (
        <LoaderCircle className="size-3.5 animate-spin" />
      ) : (
        <Icon className="size-3.5" />
      )}
      {children}
    </button>
  );
}

export function WorksheetWorkspace({
  books,
  initialBookId,
  initialSubject,
  initialTree,
  feedbackHref,
}: Props) {
  const router = useRouter();
  const initialGrade = books.find((b) => b.id === initialBookId)?.grade ?? 1;

  const [subject, setSubject] = useState(initialSubject);
  const [grade, setGrade] = useState(initialGrade);
  const [bookId, setBookId] = useState(initialBookId);
  const [tree, setTree] = useState(initialTree);
  const [title, setTitle] = useState(
    defaultTitle(initialSubject, initialGrade),
  );
  const [questions, setQuestions] = useState<WorksheetQuestion[]>([]);
  const [settings, setSettings] = useState(DEFAULT_WORKSHEET_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [pickingId, setPickingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "info" | "danger";
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState<"docx" | "exam" | null>(null);
  const [treeLoading, startTreeLoad] = useTransition();
  const [restored, setRestored] = useState(false);

  const gradeBooks = useMemo(
    () => books.filter((b) => b.subject === subject && b.grade === grade),
    [books, subject, grade],
  );
  /** Môn có sách trong ngân hàng chung — đánh dấu trong ô chọn môn. */
  const subjectsWithBooks = useMemo(
    () => new Set(books.map((b) => b.subject)),
    [books],
  );
  const hasQuestions = questions.length > 0;

  // Khôi phục phiếu đang soạn dở (lỡ tải lại trang) — chỉ khi cùng sách.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      const draft = raw ? (JSON.parse(raw) as Draft) : null;
      if (draft && draft.bookId === initialBookId) {
        /* eslint-disable react-hooks/set-state-in-effect -- đọc bản nháp 1 lần khi mở trang */
        setTitle(draft.title);
        setQuestions(draft.questions ?? []);
        setSettings({ ...DEFAULT_WORKSHEET_SETTINGS, ...draft.settings });
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      /* localStorage bị chặn — bỏ qua */
    }
    setRestored(true);
  }, [initialBookId]);

  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ bookId, title, questions, settings } satisfies Draft),
      );
    } catch {
      /* bỏ qua */
    }
  }, [restored, bookId, title, questions, settings]);

  function changeBook(nextBookId: string | null) {
    setBookId(nextBookId);
    setTree([]);
    if (!nextBookId) return;
    startTreeLoad(async () => {
      const res = await loadBookTreeAction(nextBookId);
      if (res.ok) setTree(res.data);
      else setNotice({ tone: "danger", text: res.message });
    });
  }

  /** Đổi môn / lớp → chọn sách đầu tiên khớp; tên phiếu còn mặc định thì đổi theo. */
  function changeScope(nextSubject: string, nextGrade: number) {
    // Đổi môn mà môn đó có sách → nhảy tới lớp có sách gần nhất cho tiện.
    if (
      nextSubject !== subject &&
      !books.some((b) => b.subject === nextSubject && b.grade === nextGrade)
    ) {
      const g = books.find((b) => b.subject === nextSubject)?.grade;
      if (g) nextGrade = g;
    }
    if (title === defaultTitle(subject, grade))
      setTitle(defaultTitle(nextSubject, nextGrade));
    setSubject(nextSubject);
    setGrade(nextGrade);
    changeBook(
      books.find((b) => b.subject === nextSubject && b.grade === nextGrade)
        ?.id ?? null,
    );
  }

  async function pick(node: BankTreeNode, replaceIndex?: number) {
    if (
      replaceIndex === undefined &&
      questions.length >= MAX_WORKSHEET_QUESTIONS
    ) {
      setNotice({
        tone: "danger",
        text: `Phiếu tối đa ${MAX_WORKSHEET_QUESTIONS} câu.`,
      });
      return;
    }
    setPickingId(node.id);
    setNotice(null);
    const res = await pickQuestionAction({
      nodeId: node.id,
      excludeIds: questions.map((q) => q.id),
    });
    setPickingId(null);
    if (!res.ok) {
      setNotice({ tone: "danger", text: res.message });
      return;
    }
    setQuestions((prev) =>
      replaceIndex === undefined
        ? [...prev, res.data]
        : prev.map((q, i) => (i === replaceIndex ? res.data : q)),
    );
    if (replaceIndex === undefined)
      setNotice({
        tone: "info",
        text: `Đã thêm câu ${questions.length + 1} từ “${node.title}”.`,
      });
  }

  /** Đổi câu khác: bốc câu mới trong đúng dạng (nút lá) của câu cũ. */
  async function swap(index: number) {
    const leaf: BankTreeNode = {
      id: questions[index].nodeId,
      title: "",
      count: 1,
      children: [],
    };
    await pick(leaf, index);
  }

  const move = (index: number, delta: number) =>
    setQuestions((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });

  async function downloadDocx() {
    setBusy("docx");
    try {
      const blob = await exportWorksheetDocx(
        title || defaultTitle(subject, grade),
        questions,
        settings,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = docxFileName(title || defaultTitle(subject, grade));
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice({
        tone: "danger",
        text: "Xuất file docx thất bại, vui lòng thử lại.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function toExam() {
    setBusy("exam");
    const res = await createExamFromWorksheetAction({
      title: title || defaultTitle(subject, grade),
      questionIds: questions.map((q) => q.id),
      durationMinutes: settings.examMinutes,
    });
    setBusy(null);
    if (!res.ok) return setNotice({ tone: "danger", text: res.message });
    router.push(`/de-thi/${res.data.id}`);
  }

  function toHomework() {
    try {
      sessionStorage.setItem(
        HOMEWORK_DRAFT_KEY,
        JSON.stringify({
          title: title || defaultTitle(subject, grade),
          contentHtml: worksheetToHtml(questions),
          grade,
          subject,
        }),
      );
    } catch {
      /* bỏ qua — form vẫn mở, chỉ không điền sẵn */
    }
    router.push("/bai-tap/tao-moi?tu-phieu=1");
  }

  return (
    <div className="flex flex-col rounded-lg bg-surface p-4 shadow-sm md:p-5 lg:h-[calc(100vh-130px)] lg:min-h-[560px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[15px] font-semibold uppercase text-ink">
          Tạo phiếu bài tập
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href={feedbackHref}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-brand-700 bg-surface px-2.5 text-xs font-medium text-brand-800 hover:bg-brand-50 dark:border-brand-300 dark:text-brand-200"
          >
            <Lightbulb className="size-3.5" /> Góp ý/đề xuất tính năng
          </Link>
          <ToolbarButton
            icon={FilePlus2}
            disabled={!hasQuestions}
            onClick={toHomework}
          >
            Tạo bài tập online từ phiếu
          </ToolbarButton>
          <ToolbarButton
            icon={FileQuestion}
            disabled={!hasQuestions}
            busy={busy === "exam"}
            onClick={toExam}
          >
            Tạo đề thi online từ phiếu
          </ToolbarButton>
          <ToolbarButton
            icon={Download}
            tone="primary"
            disabled={!hasQuestions}
            busy={busy === "docx"}
            onClick={downloadDocx}
          >
            Xuất docx phiếu bài tập
          </ToolbarButton>
          <ToolbarButton
            icon={Settings}
            tone="plain"
            onClick={() => setSettingsOpen(true)}
          >
            Cài đặt
          </ToolbarButton>
        </div>
      </div>

      {notice && (
        <Alert variant={notice.tone} className="mb-3 py-2">
          {notice.text}
        </Alert>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,565px)_minmax(0,1fr)]">
        {/* ── Trái: chọn lớp / sách + cây câu hỏi ── */}
        <div className="flex min-h-0 flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="Môn"
              value={subject}
              onChange={(e) => changeScope(e.target.value, grade)}
              className={SELECT}
              style={CARET}
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                  {subjectsWithBooks.has(s) ? "" : " (chưa có sách)"}
                </option>
              ))}
            </select>
            <select
              aria-label="Lớp"
              value={grade}
              onChange={(e) => changeScope(subject, Number(e.target.value))}
              className={SELECT}
              style={CARET}
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  Lớp {g}
                </option>
              ))}
            </select>
          </div>
          <select
            aria-label="Sách"
            value={bookId ?? ""}
            onChange={(e) => changeBook(e.target.value || null)}
            className={SELECT}
            style={CARET}
            disabled={gradeBooks.length === 0}
          >
            {gradeBooks.length === 0 && (
              <option value="">Chưa có sách cho lớp này</option>
            )}
            {gradeBooks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>

          <div className="flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-md border border-line">
            <div className="border-b border-line px-3 py-2.5">
              <p className="text-[15px] font-medium text-ink">Cây câu hỏi</p>
              <p className="text-xs text-ink-soft">
                Bấm vào các đơn vị kiến thức bên dưới để thêm ngẫu nhiên 1 câu
                hỏi
              </p>
            </div>
            <div className="flex-1 overflow-y-auto py-2 pr-1">
              {treeLoading ? (
                <p className="flex items-center gap-2 px-4 py-6 text-sm text-ink-soft">
                  <LoaderCircle className="size-4 animate-spin" /> Đang tải cây
                  câu hỏi…
                </p>
              ) : tree.length === 0 ? (
                <div className="px-4 py-6 text-sm text-ink-soft">
                  <p>
                    Ngân hàng chung chưa có sách {subject} lớp {grade}.
                    {books.length > 0 && (
                      <> Hiện có: {books.map((b) => b.title).join(", ")}.</>
                    )}
                  </p>
                  <p className="mt-2">
                    Bạn có thể tự nhập câu hỏi {subject} từ file Word / Excel
                    vào ngân hàng riêng rồi tạo đề từ đó.
                  </p>
                  <Link
                    href="/ngan-hang"
                    className="mt-3 inline-flex h-8 items-center rounded-md bg-brand-700 px-3 text-xs font-medium text-white hover:bg-brand-800"
                  >
                    Mở ngân hàng câu hỏi riêng
                  </Link>
                </div>
              ) : (
                <BankTree
                  nodes={tree}
                  onPick={(n) => void pick(n)}
                  pendingId={pickingId}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Phải: tên phiếu + danh sách câu ── */}
        <div className="flex min-h-[320px] flex-col overflow-hidden rounded-md border border-line">
          <div className="border-b border-line px-3 py-3">
            <label
              htmlFor="ws-title"
              className="mb-2 block text-[15px] font-medium text-ink"
            >
              Tên phiếu bài tập
            </label>
            <input
              id="ws-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="h-[38px] w-full rounded-md border border-line bg-surface px-3 text-[15px] text-ink focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {!hasQuestions ? (
              <div className="flex flex-col items-center px-4 pt-6 pb-10 text-center">
                <Inbox
                  className="size-20 text-brand-600 dark:text-brand-300"
                  strokeWidth={1.25}
                />
                <p className="mt-2 text-[15px] text-ink-soft">
                  Chưa có câu hỏi
                </p>
              </div>
            ) : (
              <ol className="divide-y divide-line">
                {questions.map((q, i) => (
                  <li key={q.id} className="group px-4 py-3">
                    <div className="flex items-start gap-3">
                      <p className="flex-1 text-[15px] text-ink">
                        <span className="font-semibold">Câu {i + 1}:</span>{" "}
                        {q.content}
                        {q.type === "FILL" && (
                          <span className="ml-2 rounded bg-success-50 px-1.5 py-0.5 text-xs font-medium text-success-700">
                            Đáp án: {q.options[q.correctIndex]}
                          </span>
                        )}
                      </p>
                      <div className="flex shrink-0 gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                        <IconAction
                          label="Lên"
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                          icon={ArrowUp}
                        />
                        <IconAction
                          label="Xuống"
                          disabled={i === questions.length - 1}
                          onClick={() => move(i, 1)}
                          icon={ArrowDown}
                        />
                        <IconAction
                          label="Đổi câu khác"
                          disabled={pickingId !== null}
                          onClick={() => void swap(i)}
                          icon={RefreshCw}
                        />
                        <IconAction
                          label="Xóa câu"
                          danger
                          onClick={() =>
                            setQuestions((prev) =>
                              prev.filter((_, j) => j !== i),
                            )
                          }
                          icon={Trash2}
                        />
                      </div>
                    </div>
                    {q.type === "MCQ" && (
                      <div className="mt-2 grid gap-x-4 gap-y-1 pl-4 sm:grid-cols-2 xl:grid-cols-4">
                        {q.options.map((o, oi) => (
                          <span
                            key={oi}
                            className={cn(
                              "text-sm",
                              oi === q.correctIndex
                                ? "font-semibold text-success-700"
                                : "text-ink",
                            )}
                          >
                            {LETTERS[oi]}. {o}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {hasQuestions && (
            <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-ink-soft">
              <span>
                {questions.length} câu · đáp án đúng tô xanh (chỉ hiện trên màn
                hình giáo viên)
              </span>
              <button
                type="button"
                onClick={() =>
                  confirm("Xóa hết câu hỏi trên phiếu?") && setQuestions([])
                }
                className="font-medium text-danger-600 hover:underline"
              >
                Xóa tất cả
              </button>
            </div>
          )}
        </div>
      </div>

      <WorksheetSettingsDialog
        open={settingsOpen}
        value={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={(v) => {
          setSettings(v);
          setSettingsOpen(false);
        }}
      />
    </div>
  );
}

function IconAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: typeof Trash2;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded p-1.5 text-ink-soft hover:bg-muted disabled:opacity-30",
        danger ? "hover:text-danger-600" : "hover:text-brand-700",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
