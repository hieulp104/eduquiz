import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowLeftRight,
  BadgeDollarSign,
  Globe,
  BookOpen,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  ChartLine,
  ChartPie,
  Printer,
  ClipboardList,
  FileCheck2,
  FileText,
  ListOrdered,
  PencilLine,
  RefreshCw,
  Search,
  Settings,
  Share2,
  UserRound,
  UserX,
} from "lucide-react";
import { requirePagePermission } from "@/common/guards/page.guard";
import { can, hasPermission } from "@/common/permissions/permissions";
import { examPurposeLabel, gradeLabel } from "@/common/enums";
import { soonHref } from "@/config/navigation";
import { buttonClass } from "@/components/ui";
import { cn, formatDateTime, formatScore, toScale10 } from "@/lib/utils";
import { getExamOverview } from "@/modules/exams/exams.service";
import { formatDuration, rankRows, scoreSummary, type ResultRow } from "@/modules/exams/exam-stats";
import { CopyLinkButton } from "@/modules/exams/components/copy-link-button";
import { DeleteExamButton } from "@/modules/exams/components/delete-exam-button";
import { AUDIENCE_LABEL, OPEN_AUDIENCE_NAME, PRICE_MODE_LABEL, formatPrice } from "@/modules/publish/publish.types";

export const metadata: Metadata = { title: "Chi tiết đề" };

const VIEWS = ["danh-sach", "thong-ke", "bang-xep-hang", "thang-diem"] as const;
type View = (typeof VIEWS)[number];

type SearchParams = { xem?: string; q?: string; lop?: string };

/**
 * Trang quản lý một đề: thông tin + menu (trái), danh sách học sinh đã thi / thống kê / xếp hạng / thang điểm (phải).
 * ?xem=thong-ke|bang-xep-hang|thang-diem · ?q= tìm theo tên/SĐT/email · ?lop= lọc theo lớp.
 */
export default async function ExamDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await requirePagePermission("exam.view");
  const data = await getExamOverview(user, id);
  if (!data) notFound();
  const { exam } = data;

  const canEdit = can(user, "exam.update", { ownerId: exam.teacherId });
  const canResults = can(user, "assignment.result.view", { ownerId: exam.teacherId });
  const canAssign = hasPermission(user, "assignment.create");
  const view: View = VIEWS.includes(sp.xem as View) ? (sp.xem as View) : "danh-sach";
  const assigned = exam.assignments.length > 0;
  const latest = exam.assignments[0] ?? null;
  const totalPoints = exam.questions.reduce((s, q) => s + q.points, 0);
  const config = exam.onlineConfig;
  const published = Boolean(config?.publishedAt);
  const settingsHref = `/de-thi/${exam.id}/lam-bai-online`;
  /** Tên đối tượng của 1 bài giao: tên lớp, hoặc đối tượng của "link chung". */
  const audienceName = (a: { classroom: { name: string } | null }) =>
    a.classroom?.name ?? (config && config.audience !== "CLASSES" ? AUDIENCE_LABEL[config.audience] : OPEN_AUDIENCE_NAME);

  const allRows: Row[] = canResults
    ? data.submissions.map((s) => ({
        id: s.id,
        studentId: s.studentId,
        studentName: s.student.fullName,
        phone: s.student.phone,
        email: s.student.email,
        className: audienceName(s.assignment),
        score10: toScale10(s.score ?? 0, s.maxScore),
        seconds: (s.submittedAt!.getTime() - s.startedAt.getTime()) / 1000,
        submittedAt: s.submittedAt!,
        attempt: s.attempt,
        leaveCount: s.leaveCount,
      }))
    : [];
  // Làm nhiều lượt: thống kê + xếp hạng chỉ tính lượt điểm cao nhất của mỗi học sinh (bằng điểm → lượt nhanh hơn).
  const bestRows = [
    ...new Map(
      [...allRows].sort((a, b) => a.score10 - b.score10 || b.seconds - a.seconds).map((r) => [r.studentId, r]),
    ).values(),
  ];
  // Số học sinh được giao: sĩ số các lớp; bài "link chung" tính theo danh sách học sinh (hoặc số người đã làm).
  const studentSlots = exam.assignments.reduce(
    (s, a) =>
      s +
      (a.classroom
        ? a.classroom._count.members
        : config?.audience === "STUDENTS"
          ? config.studentIds.length
          : new Set(allRows.filter((r) => r.className === audienceName(a)).map((r) => r.studentId)).size),
    0,
  );
  const q = sp.q?.trim().toLowerCase() ?? "";
  const rows = allRows.filter(
    (r) =>
      (!sp.lop || r.className === sp.lop) &&
      (!q || [r.studentName, r.phone ?? "", r.email].some((v) => v.toLowerCase().includes(q))),
  );
  const classNames = [...new Set(exam.assignments.map(audienceName))];

  const href = (xem: View) => `/de-thi/${exam.id}${xem === "danh-sach" ? "" : `?xem=${xem}`}`;
  const info: { icon: LucideIcon; text: string }[] = [
    { icon: CalendarDays, text: `Ngày tạo: ${formatDateTime(exam.createdAt)}` },
    {
      icon: CalendarClock,
      text: `Thời gian giao đề: ${latest ? `${formatDateTime(latest.openAt)} – ${latest.dueAt ? formatDateTime(latest.dueAt) : "không giới hạn"}` : "chưa giao"}`,
    },
    { icon: UserRound, text: `Người tạo: ${exam.teacher.fullName}` },
    { icon: FileCheck2, text: `Số lượt làm: ${data.submissions.length}` },
    {
      icon: BookOpen,
      text: [exam.grade !== null ? gradeLabel(exam.grade) : null, exam.subject].filter(Boolean).join(" - ") || "Chưa chọn khối / môn",
    },
  ];
  const purpose = examPurposeLabel(exam.purpose, true);
  if (purpose) info.push({ icon: ClipboardList, text: `Mục đích: ${purpose}` });
  if (exam.priceMode !== "FREE") {
    info.push({ icon: BadgeDollarSign, text: `${PRICE_MODE_LABEL[exam.priceMode]}: ${formatPrice(exam.price)}` });
  }
  info.push({
    icon: Globe,
    text: published
      ? `Đã xuất bản · ${config!.mode === "PRACTICE" ? "Luyện tập" : "Kiểm tra"} · ${AUDIENCE_LABEL[config!.audience]}`
      : config
        ? "Cài đặt làm bài online: đang lưu nháp"
        : "Chưa xuất bản làm bài online",
  });

  const menu: { label: string; icon: LucideIcon; href: string; active?: boolean; hidden?: boolean }[] = [
    { label: "Cài đặt", icon: Settings, href: `/de-thi/${exam.id}/cai-dat`, hidden: !canEdit },
    { label: "Cài đặt làm bài online", icon: Globe, href: settingsHref, hidden: !canEdit },
    { label: "Phân tích cấu trúc đề", icon: ChartPie, href: `/de-thi/${exam.id}/phan-tich` },
    { label: "In đề + phiếu trả lời", icon: Printer, href: `/de-thi/${exam.id}/in-de` },
    { label: "Thống kê", icon: ChartLine, href: href("thong-ke"), active: view === "thong-ke" },
    { label: "Nhật ký hoạt động", icon: Activity, href: soonHref("Nhật ký hoạt động") },
    { label: "Bảng xếp hạng", icon: ChartColumn, href: href("bang-xep-hang"), active: view === "bang-xep-hang" },
    { label: "Thang điểm", icon: ListOrdered, href: href("thang-diem"), active: view === "thang-diem" },
    { label: "Chấm lại điểm", icon: RefreshCw, href: soonHref("Chấm lại điểm") },
    { label: "Chuyển kết quả theo SBD mới", icon: ArrowLeftRight, href: soonHref("Chuyển kết quả theo SBD mới") },
    { label: "Danh sách học sinh bị cấm thi (0)", icon: UserX, href: soonHref("Danh sách học sinh bị cấm thi") },
  ];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      {/* ═════ Cột trái: thông tin đề ═════ */}
      <aside className="space-y-6 lg:sticky lg:top-4">
        <div>
          <h1 className="flex items-start gap-2 text-[15px] font-medium text-ink">
            <FileText className="mt-0.5 size-5 shrink-0 text-warning-700 dark:text-amber-300" />
            <span className="break-words">{exam.title}</span>
          </h1>
          <div className="mt-3 flex items-center gap-2">
            <CopyLinkButton
              path={published ? `/thi/${config!.code}` : latest ? `/lam-bai/${latest.id}` : null}
              disabledReason="Xuất bản đề ở “Cài đặt làm bài online” để có link gửi học sinh."
            />
            {!published && exam.assignments.length > 1 && <span className="text-xs text-ink-soft">({audienceName(latest!)})</span>}
          </div>
          <ul className="mt-4 space-y-2.5 text-sm text-ink-soft">
            {info.map((i) => (
              <li key={i.text} className="flex items-start gap-2">
                <i.icon className="mt-0.5 size-4 shrink-0 text-ink-faint" /> {i.text}
              </li>
            ))}
            <li>
              <Link href={`/kho-noi-dung?dong-gop=${exam.id}`} title="Chia sẻ đề lên Kho nội dung" className="flex items-center gap-2 text-ink-soft hover:text-brand-700">
                <Share2 className="size-4" /> Chia sẻ
              </Link>
            </li>
          </ul>
        </div>

        <nav aria-label="Menu đề thi">
          <p className="mb-2 text-sm font-medium text-ink">Menu</p>
          <ul className="space-y-0.5">
            {menu
              .filter((m) => !m.hidden)
              .map((m) => (
                <li key={m.label}>
                  <Link
                    href={m.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ink hover:bg-muted",
                      m.active && "bg-muted font-medium text-brand-600 dark:text-brand-300",
                    )}
                  >
                    <m.icon className="size-4 text-ink-soft" /> {m.label}
                  </Link>
                </li>
              ))}
            {canEdit && (
              <li>
                <DeleteExamButton examId={exam.id} asMenuItem />
              </li>
            )}
          </ul>
        </nav>

        <section>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink">Giao cho</p>
            {canAssign && (
              <Link href={settingsHref} className="flex items-center gap-1 text-xs text-brand-700 hover:underline dark:text-brand-300">
                <PencilLine className="size-3.5" /> Sửa
              </Link>
            )}
          </div>
          {assigned ? (
            <ul className="mt-2 space-y-2 text-sm">
              {exam.assignments.map((a) => (
                <li key={a.id} className="rounded-md bg-muted/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    {a.classroom ? (
                      <Link href={`/lop-hoc/${a.classroom.id}/bai/${a.id}`} className="font-medium text-ink hover:text-brand-700">
                        {a.classroom.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink">{audienceName(a)}</span>
                    )}
                    <CopyLinkButton path={`/lam-bai/${a.id}`} label="Link" className="h-7 px-2" />
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {formatDateTime(a.openAt)} – {a.dueAt ? formatDateTime(a.dueAt) : "không giới hạn"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-center text-sm text-ink-faint">Chưa giao cho ai</p>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink">Nội dung</p>
            {canEdit && !assigned && (
              <Link href={`/de-thi/${exam.id}/sua`} className="flex items-center gap-1 text-xs text-brand-700 hover:underline dark:text-brand-300">
                <PencilLine className="size-3.5" /> Sửa
              </Link>
            )}
          </div>
          <Link
            href={`/de-thi/${exam.id}/noi-dung`}
            className="mt-2 flex items-center gap-2 text-sm text-brand-700 hover:underline dark:text-brand-300"
          >
            <FileText className="size-4" /> Xem chi tiết ({exam.questions.length} câu · {formatScore(totalPoints)} điểm)
          </Link>
          {canEdit && assigned && <p className="mt-1 text-xs text-ink-faint">Đề đã giao cho lớp nên không sửa câu hỏi được.</p>}
        </section>
      </aside>

      {/* ═════ Cột phải ═════ */}
      <section className="min-h-[600px] rounded-lg bg-surface p-4 shadow-sm sm:p-5">
        {view === "thang-diem" ? (
          <ScaleView questions={exam.questions} total={totalPoints} />
        ) : !canResults ? (
          <p className="py-20 text-center text-sm text-ink-soft">Bạn không có quyền xem kết quả của đề này.</p>
        ) : view === "thong-ke" ? (
          <StatsView rows={bestRows} />
        ) : view === "bang-xep-hang" ? (
          <RankingView rows={bestRows} />
        ) : (
          <>
            <form className="flex flex-wrap items-center gap-3 border-b border-line pb-4" action={`/de-thi/${exam.id}`}>
              <p className="mr-auto text-sm text-ink">
                Danh sách đã thi ({bestRows.length}/{studentSlots})
              </p>
              <label className="relative">
                <span className="sr-only">Tìm học sinh</span>
                <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-ink-faint" />
                <input
                  name="q"
                  defaultValue={sp.q ?? ""}
                  placeholder="Tên | SĐT | Email"
                  className="h-9 w-56 rounded-md border border-line bg-surface pr-3 pl-8 text-sm text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none"
                />
              </label>
              {classNames.length > 1 && (
                <select
                  name="lop"
                  defaultValue={sp.lop ?? ""}
                  aria-label="Lọc theo lớp"
                  className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
                >
                  <option value="">Tất cả lớp</option>
                  {classNames.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
              <button type="submit" className={buttonClass("secondary", "sm")}>
                Lọc
              </button>
            </form>

            {allRows.length === 0 ? (
              <EmptyResults href={settingsHref} assigned={assigned} canAssign={canAssign} />
            ) : rows.length === 0 ? (
              <p className="py-16 text-center text-sm text-ink-soft">Không có học sinh nào khớp tìm kiếm.</p>
            ) : (
              <ResultsTable rows={rows} />
            )}
          </>
        )}
      </section>
    </div>
  );
}

type Row = ResultRow & { studentId: string; phone: string | null; email: string; attempt: number; leaveCount: number };

function EmptyResults({ href, assigned, canAssign }: { href: string; assigned: boolean; canAssign: boolean }) {
  return (
    <div className="flex flex-col items-center px-4 py-24 text-center">
      <p className="text-lg font-medium text-ink">Chưa có dữ liệu nộp bài</p>
      <p className="mt-2 text-sm text-ink-soft">
        {assigned
          ? "Đề đã giao — bấm “Copy link” để gửi link làm bài cho học sinh."
          : "Vào “Cài đặt làm bài online” rồi Xuất bản để học sinh bắt đầu làm bài."}
      </p>
      {canAssign && (
        <Link href={href} className={cn(buttonClass("primary"), "mt-5")}>
          {assigned ? "Sửa cài đặt làm bài" : "Cài đặt làm bài online"}
        </Link>
      )}
    </div>
  );
}

function ResultsTable({ rows }: { rows: Row[] }) {
  const multi = rows.some((r) => r.attempt > 1);
  const monitored = rows.some((r) => r.leaveCount > 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-ink-soft">
            <th className="py-3 pr-3 font-normal">STT</th>
            <th className="py-3 pr-3 font-normal">Họ và tên</th>
            <th className="py-3 pr-3 font-normal">Lớp</th>
            {multi && <th className="py-3 pr-3 font-normal">Lượt</th>}
            <th className="py-3 pr-3 font-normal">Điểm</th>
            <th className="py-3 pr-3 font-normal">Thời gian làm</th>
            {monitored && <th className="py-3 pr-3 font-normal">Rời trang</th>}
            <th className="py-3 pr-3 font-normal">Nộp lúc</th>
            <th className="py-3 font-normal" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-b border-line last:border-0">
              <td className="py-3 pr-3 text-ink-soft">{i + 1}</td>
              <td className="py-3 pr-3 font-medium text-ink">{r.studentName}</td>
              <td className="py-3 pr-3 text-ink-soft">{r.className}</td>
              {multi && <td className="py-3 pr-3 text-ink-soft tabular-nums">{r.attempt}</td>}
              <td className="py-3 pr-3 font-semibold text-brand-700 tabular-nums dark:text-brand-300">{formatScore(r.score10)}</td>
              <td className="py-3 pr-3 text-ink-soft">{formatDuration(r.seconds)}</td>
              {monitored && (
                <td className={cn("py-3 pr-3 tabular-nums", r.leaveCount > 0 ? "font-medium text-danger-600" : "text-ink-soft")}>
                  {r.leaveCount} lần
                </td>
              )}
              <td className="py-3 pr-3 text-ink-soft">{formatDateTime(r.submittedAt)}</td>
              <td className="py-3 text-right">
                <Link href={`/ket-qua/${r.id}`} className="text-brand-700 hover:underline dark:text-brand-300">
                  Xem bài
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatsView({ rows }: { rows: ResultRow[] }) {
  const s = scoreSummary(rows);
  const tiles = [
    { label: "Lượt nộp", value: String(s.count) },
    { label: "Điểm trung bình", value: formatScore(s.average) },
    { label: "Cao nhất", value: formatScore(s.max) },
    { label: "Thấp nhất", value: formatScore(s.min) },
    { label: "Đạt (≥ 5)", value: s.count ? `${s.passed}/${s.count}` : "—" },
  ];
  return (
    <div className="space-y-6">
      <h2 className="text-sm font-medium text-ink">Thống kê điểm (thang 10)</h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-line px-4 py-3">
            <dt className="text-xs text-ink-soft">{t.label}</dt>
            <dd className="mt-1 text-xl font-semibold text-ink tabular-nums">{t.value}</dd>
          </div>
        ))}
      </dl>
      <table className="w-full max-w-xl text-sm">
        <thead>
          <tr className="border-b border-line text-left text-ink-soft">
            <th className="py-2 pr-3 font-normal">Xếp loại</th>
            <th className="py-2 pr-3 font-normal">Khoảng điểm</th>
            <th className="py-2 pr-3 text-right font-normal">Số bài</th>
            <th className="py-2 text-right font-normal">Tỉ lệ</th>
          </tr>
        </thead>
        <tbody>
          {s.bands.map((b) => (
            <tr key={b.label} className="border-b border-line last:border-0">
              <td className="py-2 pr-3 text-ink">{b.label}</td>
              <td className="py-2 pr-3 text-ink-soft">{b.range}</td>
              <td className="py-2 pr-3 text-right text-ink tabular-nums">{b.count}</td>
              <td className="py-2 text-right text-ink-soft tabular-nums">{formatScore(b.percent)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankingView({ rows }: { rows: ResultRow[] }) {
  const ranked = rankRows(rows);
  if (ranked.length === 0) return <p className="py-20 text-center text-sm text-ink-soft">Chưa có bài nộp để xếp hạng.</p>;
  return (
    <div className="overflow-x-auto">
      <h2 className="mb-3 text-sm font-medium text-ink">Bảng xếp hạng — điểm cao trước, bằng điểm thì ai làm nhanh hơn đứng trước</h2>
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-ink-soft">
            <th className="py-3 pr-3 font-normal">Hạng</th>
            <th className="py-3 pr-3 font-normal">Họ và tên</th>
            <th className="py-3 pr-3 font-normal">Lớp</th>
            <th className="py-3 pr-3 font-normal">Điểm</th>
            <th className="py-3 font-normal">Thời gian làm</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((r) => (
            <tr key={r.id} className="border-b border-line last:border-0">
              <td className="py-3 pr-3">
                <span
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                    r.rank <= 3 ? "bg-brand-600 text-white" : "bg-muted text-ink-soft",
                  )}
                >
                  {r.rank}
                </span>
              </td>
              <td className="py-3 pr-3 font-medium text-ink">{r.studentName}</td>
              <td className="py-3 pr-3 text-ink-soft">{r.className}</td>
              <td className="py-3 pr-3 font-semibold text-brand-700 tabular-nums dark:text-brand-300">{formatScore(r.score10)}</td>
              <td className="py-3 text-ink-soft">{formatDuration(r.seconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScaleView({ questions, total }: { questions: { id: string; points: number }[]; total: number }) {
  return (
    <div>
      <h2 className="text-sm font-medium text-ink">
        Thang điểm — {questions.length} câu, tổng {formatScore(total)} điểm
      </h2>
      <p className="mt-1 text-xs text-ink-soft">Điểm hiển thị cho học sinh được quy về thang 10. Đổi điểm từng câu trong phần “Nội dung → Sửa”.</p>
      <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2 text-sm">
        {questions.map((q, i) => (
          <li key={q.id} className="flex justify-between rounded-md bg-muted/60 px-3 py-2">
            <span className="text-ink-soft">Câu {i + 1}</span>
            <span className="font-medium text-ink tabular-nums">{formatScore(q.points)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
