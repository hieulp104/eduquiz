"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Info, LoaderCircle, RotateCcw, Search } from "lucide-react";
import { Alert, Button, Input, Select, Textarea } from "@/components/ui";
import { SUBJECTS, TEACHING_GRADES, gradeLabel, subjectsForGrade } from "@/common/enums";
import { cn } from "@/lib/utils";
import { PurposeSelect } from "@/modules/exams/components/purpose-select";
import { PricingFields } from "@/modules/publish/components/pricing-fields";
import { saveOnlineSettingsAction } from "@/modules/publish/publish.actions";
import {
  AUDIENCE_LABEL,
  type ExamAudience,
  type ExamMode,
  type OnlineSettingsValue,
  type RevealMode,
} from "@/modules/publish/publish.types";

type ClassOption = { id: string; name: string; students: { id: string; name: string }[] };

type Props = {
  examId: string;
  /** Mã đề (đã lưu cấu hình ít nhất 1 lần). */
  code: string | null;
  published: boolean;
  initial: OnlineSettingsValue;
  classes: ClassOption[];
};

const MODE_HINT: Record<ExamMode, string> = {
  EXAM: "Cấu hình này thường dùng cho các kỳ thi nghiêm túc, cần bảo mật đáp án và đề thi cho tới khi kết thúc kỳ thi.",
  PRACTICE:
    "Cấu hình này thường dùng cho học sinh luyện tập. Câu hỏi hiện từng câu một, trả lời tới câu nào thì học sinh biết ngay đáp án đúng của câu đó.",
};

const AUDIENCE_HINT: Record<ExamAudience, string> = {
  ALL: "Học sinh nào có link (và đã đăng nhập) cũng làm được, kể cả học sinh không thuộc lớp của bạn.",
  CLASSES: "Chỉ học sinh trong các lớp được chọn mới làm được. Bài hiện sẵn ở trang Tổng quan của học sinh.",
  STUDENTS: "Chỉ những học sinh được chọn mới làm được. Bài hiện sẵn ở trang Tổng quan của các em.",
};

// ═══════════════════ Khối dựng form ═══════════════════

/** Mỗi nhóm cài đặt là 1 thẻ có viền + bóng. */
function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface px-5 py-5 shadow-sm sm:px-6">
      {title && <h2 className="mb-5 border-b border-line pb-4 text-[15px] font-medium text-ink">{title}</h2>}
      <div className="space-y-6">{children}</div>
    </section>
  );
}

/** Hàng 2 cột: nhãn + mô tả (trái) · ô điều khiển (phải). */
function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid items-start gap-x-8 gap-y-2 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="mt-1 text-xs leading-relaxed text-ink-soft">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        checked ? "bg-brand-600" : "bg-ink-faint/60",
      )}
    >
      <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
    </button>
  );
}

function Radios<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-7 gap-y-2">
      {options.map((o) => (
        <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} className="size-4 accent-brand-600" />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
      {children}
    </label>
  );
}

// ═══════════════════ Chọn lớp / học sinh ═══════════════════

function ClassPicker({ classes, value, onChange }: { classes: ClassOption[]; value: string[]; onChange: (ids: string[]) => void }) {
  if (classes.length === 0) return <Alert>Bạn chưa có lớp nào — tạo lớp ở mục “Lớp học” trước.</Alert>;
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {classes.map((c) => (
        <li key={c.id}>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-sm hover:bg-muted">
            <input type="checkbox" checked={value.includes(c.id)} onChange={() => toggle(c.id)} className="size-4 accent-brand-600" />
            <span className="flex-1 truncate font-medium text-ink">{c.name}</span>
            <span className="text-xs text-ink-soft">{c.students.length} học sinh</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

function StudentPicker({ classes, value, onChange }: { classes: ClassOption[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const picked = new Set(value);
  const visible = classes
    .map((c) => ({ ...c, students: c.students.filter((s) => !q || s.name.toLowerCase().includes(q)) }))
    .filter((c) => c.students.length > 0);

  if (classes.every((c) => c.students.length === 0)) return <Alert>Các lớp của bạn chưa có học sinh nào.</Alert>;

  const setMany = (ids: string[], on: boolean) => {
    const next = new Set(value);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    onChange([...next]);
  };

  return (
    <div className="rounded-lg border border-line">
      <div className="flex items-center gap-3 border-b border-line px-3 py-2">
        <label className="relative flex-1">
          <span className="sr-only">Tìm học sinh</span>
          <Search className="pointer-events-none absolute top-2 left-0 size-4 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm học sinh theo tên"
            className="h-8 w-full bg-transparent pl-6 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </label>
        <span className="shrink-0 text-xs text-ink-soft">Đã chọn {picked.size}</span>
      </div>
      <div className="max-h-72 space-y-3 overflow-y-auto p-3">
        {visible.length === 0 && <p className="py-4 text-center text-sm text-ink-soft">Không tìm thấy học sinh.</p>}
        {visible.map((c) => {
          const ids = c.students.map((s) => s.id);
          const all = ids.every((id) => picked.has(id));
          return (
            <fieldset key={c.id}>
              <legend className="flex w-full items-center justify-between text-sm font-medium text-ink">
                {c.name}
                <button type="button" onClick={() => setMany(ids, !all)} className="text-xs font-normal text-brand-700 hover:underline dark:text-brand-300">
                  {all ? "Bỏ chọn cả lớp" : "Chọn cả lớp"}
                </button>
              </legend>
              <ul className="mt-1.5 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                {c.students.map((s) => (
                  <li key={s.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-ink hover:bg-muted">
                      <input
                        type="checkbox"
                        checked={picked.has(s.id)}
                        onChange={(e) => setMany([s.id], e.target.checked)}
                        className="size-4 accent-brand-600"
                      />
                      <span className="truncate">{s.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════ Form chính ═══════════════════

/** "Cài đặt làm bài online": chế độ Kiểm tra / Luyện tập, đối tượng, bảo mật, đảo đề, xem điểm, giá → Lưu nháp / Xuất bản. */
export function OnlineSettingsForm({ examId, code, published, initial, classes }: Props) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<"draft" | "publish" | null>(null);

  const set = <K extends keyof OnlineSettingsValue>(k: K, value: OnlineSettingsValue[K]) => {
    setSaved(false);
    setV((s) => ({ ...s, [k]: value }));
  };
  const exam = v.mode === "EXAM";
  const subjects = v.grade === null ? [...SUBJECTS] : subjectsForGrade(v.grade);
  if (v.subject && !subjects.includes(v.subject)) subjects.push(v.subject);

  function submit(publish: boolean) {
    setError(null);
    setSaved(false);
    setAction(publish ? "publish" : "draft");
    startTransition(async () => {
      const res = await saveOnlineSettingsAction({ ...v, examId, publish });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      if (publish) router.push(`/de-thi/${examId}/xuat-ban`);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(true);
      }}
      className="mx-auto w-full max-w-[1000px] space-y-4"
    >
      <p className="text-center text-sm font-medium text-ink">
        Tên đề thi: {initial.title}
        {code && ` - Mã đề: ${code}`}
        {published && <span className="ml-2 rounded-full bg-success-50 px-2 py-0.5 text-xs text-success-700">Đã xuất bản</span>}
      </p>

      <Section>
        <Row label="Loại cấu hình">
          <div className="inline-flex rounded-full border border-line p-0.5" role="radiogroup" aria-label="Loại cấu hình">
            {(["EXAM", "PRACTICE"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={v.mode === m}
                onClick={() => set("mode", m)}
                className={cn(
                  "h-8 rounded-full px-4 text-sm font-medium transition-colors",
                  v.mode === m ? "bg-brand-700 text-white" : "text-ink-soft hover:text-ink",
                )}
              >
                {m === "EXAM" ? "Kiểm tra" : "Luyện tập"}
              </button>
            ))}
          </div>
        </Row>
        <p className="text-xs leading-relaxed text-ink-soft">{MODE_HINT[v.mode]}</p>
      </Section>

      {!exam && (
        <Section>
          <Row
            label="Luyện tập lại những câu sai"
            hint="Cho phép học sinh ôn lại các câu trả lời sai sau khi hoàn thành bài, giúp củng cố kiến thức."
          >
            <Toggle checked={v.retryWrong} onChange={(x) => set("retryWrong", x)} label="Luyện tập lại những câu sai" />
          </Row>
        </Section>
      )}

      <Section title="Cấu hình chung">
        <div>
          <Label htmlFor="os-title">Tên đề thi</Label>
          <Input id="os-title" value={v.title} maxLength={200} onChange={(e) => set("title", e.target.value)} required />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="os-grade">Khối học</Label>
            <Select id="os-grade" value={v.grade ?? ""} onChange={(e) => set("grade", e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">---Chọn khối---</option>
              {TEACHING_GRADES.map((g) => (
                <option key={g} value={g}>
                  {gradeLabel(g)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="os-subject">Môn học</Label>
            <Select id="os-subject" value={v.subject ?? ""} onChange={(e) => set("subject", e.target.value || null)}>
              <option value="">---Chọn môn---</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="os-purpose">Mục đích tạo đề</Label>
          <PurposeSelect id="os-purpose" value={v.purpose} onChange={(p) => set("purpose", p)} />
        </div>
        <div>
          <Label htmlFor="os-duration">Thời gian làm bài (phút)</Label>
          <Input
            id="os-duration"
            type="number"
            min={1}
            max={300}
            value={Number.isFinite(v.durationMinutes) ? v.durationMinutes : ""}
            onChange={(e) => set("durationMinutes", Number(e.target.value))}
            required
          />
          <p className="mt-1 text-xs text-ink-soft">Từ 1 đến 300 phút. Hết giờ bài tự nộp.</p>
        </div>

        {exam && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Thời gian giao đề</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Input type="datetime-local" aria-label="Từ" value={v.openAt} onChange={(e) => set("openAt", e.target.value)} />
              <Input type="datetime-local" aria-label="Đến" value={v.dueAt} onChange={(e) => set("dueAt", e.target.value)} />
              <Button
                variant="secondary"
                onClick={() => {
                  setSaved(false);
                  setV((s) => ({ ...s, openAt: "", dueAt: "" }));
                }}
              >
                <RotateCcw className="size-4" /> Đặt lại
              </Button>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              Từ – Đến: khoảng thời gian học sinh được vào làm bài. Bỏ trống nếu không muốn giới hạn thời gian. Rút ngắn thời
              gian khi học sinh đang làm có thể khiến bài bị nộp sớm.
            </p>
          </div>
        )}

        <Row label="Ai được phép làm">
          <Radios
            name="os-audience"
            value={v.audience}
            onChange={(a) => set("audience", a)}
            options={(Object.keys(AUDIENCE_LABEL) as ExamAudience[]).map((a) => ({ value: a, label: AUDIENCE_LABEL[a] }))}
          />
        </Row>
        <div className="flex gap-2.5 rounded-lg border border-line bg-muted px-4 py-3 text-xs leading-relaxed text-ink-soft">
          <Info className="mt-0.5 size-4 shrink-0" /> {AUDIENCE_HINT[v.audience]}
        </div>
        {v.audience === "CLASSES" && <ClassPicker classes={classes} value={v.classIds} onChange={(ids) => set("classIds", ids)} />}
        {v.audience === "STUDENTS" && <StudentPicker classes={classes} value={v.studentIds} onChange={(ids) => set("studentIds", ids)} />}

        {exam && (
          <Row
            label="Thi tại phòng máy"
            hint="Sau khi học sinh nộp bài hệ thống tự đăng xuất tài khoản, để học sinh khác dùng cùng máy không bị nhầm tài khoản."
          >
            <Toggle checked={v.labMode} onChange={(x) => set("labMode", x)} label="Thi tại phòng máy" />
          </Row>
        )}
      </Section>

      {exam && (
        <Section title="Bảo mật">
          <Row label="Số lượt làm" hint="Làm nhiều lượt thì thống kê và bảng xếp hạng lấy lượt điểm cao nhất.">
            <Input
              type="number"
              min={0}
              max={100}
              aria-label="Số lượt làm"
              className="max-w-xs"
              value={Number.isFinite(v.maxAttempts) ? v.maxAttempts : ""}
              onChange={(e) => set("maxAttempts", Number(e.target.value))}
            />
            <p className="mt-1 text-xs text-ink-soft">*Nhập 0 để không giới hạn số lượt làm đề thi</p>
          </Row>
          <Row label="Mật khẩu đề thi" hint="Học sinh phải nhập đúng mật khẩu mới bắt đầu làm bài được.">
            <Input
              aria-label="Mật khẩu đề thi"
              value={v.password}
              maxLength={50}
              autoComplete="off"
              placeholder="Nhập mật khẩu ..."
              onChange={(e) => set("password", e.target.value)}
            />
          </Row>
          <Row label="Giám sát tự động" hint="Đếm số lần học sinh chuyển tab / rời khỏi trang làm bài và báo lại cho giáo viên.">
            <Radios
              name="os-monitor"
              value={v.monitorLeave ? "on" : "off"}
              onChange={(x) => set("monitorLeave", x === "on")}
              options={[
                { value: "off", label: "Tắt" },
                { value: "on", label: "Giám sát thoát màn hình" },
              ]}
            />
          </Row>
        </Section>
      )}

      <Section title="Đảo câu hỏi và đáp án">
        <Row
          label="Đảo câu hỏi và đáp án"
          hint="Mỗi lượt làm thấy thứ tự câu hỏi và đáp án khác nhau. Đề có nhóm câu thì chỉ đảo câu trong phạm vi nhóm; câu “cố định đáp án” và nhóm “cố định” giữ nguyên."
        >
          <Toggle checked={v.shuffle} onChange={(x) => set("shuffle", x)} label="Đảo câu hỏi và đáp án" />
        </Row>
        <Row label="Đảo vị trí nhóm" hint="Đổi chỗ các nhóm câu hỏi trong đề, hạn chế học sinh trao đổi đáp án theo thứ tự nhóm.">
          <Radios
            name="os-groups"
            value={v.shuffleGroups ? "all" : "none"}
            onChange={(x) => set("shuffleGroups", x === "all")}
            options={[
              { value: "none", label: "Không đảo" },
              { value: "all", label: "Đảo tất cả các nhóm" },
            ]}
          />
          <p className="mt-1 text-xs text-ink-soft">
            {v.shuffleGroups ? "Các nhóm câu hỏi (và câu đứng riêng) đổi chỗ ngẫu nhiên." : "Giữ nguyên vị trí các nhóm câu hỏi như trong đề gốc."}
          </p>
        </Row>
        <Row label="Ẩn tiêu đề nhóm" hint="Ẩn lời dẫn / tiêu đề của các nhóm câu khi học sinh làm bài online (file nghe của nhóm vẫn hiện).">
          <Toggle checked={v.hideGroupTitles} onChange={(x) => set("hideGroupTitles", x)} label="Ẩn tiêu đề nhóm" />
        </Row>
      </Section>

      {exam && (
        <Section title="Điểm và đáp án khi làm xong">
          <Row label="Cho xem điểm">
            <Radios<RevealMode>
              name="os-score"
              value={v.showScore}
              onChange={(x) => set("showScore", x)}
              options={[
                { value: "NEVER", label: "Không" },
                { value: "AFTER_SUBMIT", label: "Khi làm bài xong" },
                { value: "AFTER_CLOSE", label: "Khi tất cả thi xong" },
              ]}
            />
          </Row>
          <Row label="Cho xem đề thi và đáp án">
            <Radios<RevealMode>
              name="os-answers"
              value={v.showAnswers}
              onChange={(x) => set("showAnswers", x)}
              options={[
                { value: "NEVER", label: "Không" },
                { value: "AFTER_SUBMIT", label: "Khi làm bài xong" },
                { value: "AFTER_CLOSE", label: "Khi tất cả thi xong" },
                { value: "MIN_SCORE", label: "Khi đạt đến số điểm nhất định" },
              ]}
            />
            {v.showAnswers === "MIN_SCORE" && (
              <label className="mt-3 flex items-center gap-2 text-sm text-ink">
                Điểm cần đạt (thang 10)
                <Input
                  type="number"
                  min={0}
                  max={10}
                  step={0.25}
                  className="w-24"
                  value={v.minScoreForAnswers ?? ""}
                  onChange={(e) => set("minScoreForAnswers", e.target.value === "" ? null : Number(e.target.value))}
                />
              </label>
            )}
            {(v.showScore === "AFTER_CLOSE" || v.showAnswers === "AFTER_CLOSE") && (
              <p className="mt-2 text-xs text-ink-soft">
                “Khi tất cả thi xong” = sau thời điểm “Đến” của Thời gian giao đề
                {!v.dueAt && <b className="text-danger-600"> — bạn chưa đặt thời điểm này nên học sinh sẽ chưa xem được</b>}.
              </p>
            )}
          </Row>
          <Row
            label="Ẩn đáp án cho câu trả lời sai"
            hint="Với câu làm sai, học sinh chỉ biết mình sai chứ không thấy đáp án đúng — phải làm lại để tự tìm ra, hợp với đề cho làm nhiều lượt."
          >
            <Toggle checked={v.hideWrongAnswers} onChange={(x) => set("hideWrongAnswers", x)} label="Ẩn đáp án cho câu trả lời sai" />
          </Row>
        </Section>
      )}

      <Section>
        <PricingFields
          name="os-price"
          value={v}
          onChange={(patch) => {
            setSaved(false);
            setV((s) => ({ ...s, ...patch }));
          }}
        />
      </Section>

      {exam && (
        <Section title="Khác">
          <Row label="Thêm thông tin tiêu đề" hint="Dòng này hiện ngay dưới tên đề khi học sinh làm bài (VD tên trường, kỳ thi).">
            <Input
              aria-label="Thêm thông tin tiêu đề"
              value={v.headerNote}
              maxLength={300}
              placeholder="VD: Trường THCS … — Kiểm tra giữa kỳ I"
              onChange={(e) => set("headerNote", e.target.value)}
            />
          </Row>
          <Row label="Thông báo trước khi vào thi" hint="Học sinh đọc thông báo này trước khi bấm bắt đầu làm bài.">
            <Textarea
              aria-label="Thông báo trước khi vào thi"
              rows={3}
              value={v.preNotice}
              maxLength={2000}
              placeholder="Nội quy, lưu ý khi làm bài…"
              onChange={(e) => set("preNotice", e.target.value)}
            />
          </Row>
        </Section>
      )}

      {error && <Alert variant="danger">{error}</Alert>}
      {saved && <Alert variant="success">Đã lưu nháp cài đặt. Bấm “Xuất bản” khi muốn học sinh bắt đầu làm bài.</Alert>}

      <div className="flex justify-end gap-3 pb-2">
        <Button variant="secondary" disabled={pending} onClick={() => submit(false)} className="border-warning-700 text-warning-700 dark:text-amber-300">
          {pending && action === "draft" && <LoaderCircle className="size-4 animate-spin" />}
          Lưu nháp
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && action === "publish" && <LoaderCircle className="size-4 animate-spin" />}
          {published ? "Xuất bản lại" : "Xuất bản"}
        </Button>
      </div>
    </form>
  );
}
