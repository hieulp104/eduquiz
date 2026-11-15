import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Pencil } from "lucide-react";
import { requirePagePermission } from "@/common/guards/page.guard";
import { can } from "@/common/permissions/permissions";
import { PageHeader } from "@/components/patterns/page-header";
import { Alert, buttonClass, Card, RichInline } from "@/components/ui";
import { cn, formatScore } from "@/lib/utils";
import { getExamWithAnswers } from "@/modules/exams/exams.service";
import { AudioClip, QuestionGroupHeader, startsGroup } from "@/modules/exams/components/question-group-header";
import { LEVELS, LEVEL_FROM_DB } from "@/modules/exams/exam-text";

export const metadata: Metadata = { title: "Nội dung đề" };

const LETTERS = "ABCDEFGH";

/** Xem toàn bộ câu hỏi + đáp án đúng, kèm cấu trúc đề (số câu theo nhóm). Chỉ người soạn / Admin. */
export default async function ExamContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("exam.view");
  const exam = await getExamWithAnswers(user, id);
  if (!exam) notFound();

  const canEdit = can(user, "exam.update", { ownerId: exam.teacherId });
  const assigned = exam._count.assignments > 0;
  const totalPoints = exam.questions.reduce((s, q) => s + q.points, 0);
  const groupById = new Map(exam.groups.map((g, i) => [g.id, { ...g, no: i + 1 }]));
  const questions = exam.questions.map((q) => ({ ...q, group: q.groupId ? (groupById.get(q.groupId) ?? null) : null }));
  const structure = exam.groups.map((g, i) => ({
    no: i + 1,
    fixed: g.fixedOrder,
    content: g.content || (g.audioFileId ? "(Bài nghe)" : ""),
    numbers: questions.flatMap((q, qi) => (q.groupId === g.id ? [qi + 1] : [])),
  }));
  const loose = questions.flatMap((q, qi) => (q.groupId ? [] : [qi + 1]));
  const range = (ns: number[]) => (ns.length > 1 && ns.at(-1)! - ns[0] === ns.length - 1 ? `${ns[0]} – ${ns.at(-1)}` : ns.join(", "));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={exam.title}
        description={`${exam.questions.length} câu trắc nghiệm 1 đáp án · ${formatScore(totalPoints)} điểm · ${exam.durationMinutes} phút`}
        actions={
          canEdit &&
          !assigned && (
            <Link href={`/de-thi/${exam.id}/sua`} className={buttonClass("secondary")}>
              <Pencil className="size-4" /> Sửa nội dung
            </Link>
          )
        }
      />

      {assigned && canEdit && <Alert className="mb-4">Đề đã giao cho lớp nên không sửa câu hỏi được nữa.</Alert>}
      {exam.description && <p className="mb-4 text-sm whitespace-pre-wrap text-ink-soft">{exam.description}</p>}

      {(structure.length > 0 || loose.length > 0) && (
        <Card className="mb-6">
          <h2 className="text-sm font-medium text-ink">Cấu trúc đề</h2>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {structure.map((s) => (
                <tr key={s.no} className="border-b border-line last:border-0">
                  <td className="w-20 py-2 pr-3 text-ink-soft">Nhóm {s.no}</td>
                  <td className="max-w-0 truncate py-2 pr-3 text-ink">
                    <RichInline text={s.content.split("\n")[0]} />
                  </td>
                  <td className="w-40 py-2 text-right whitespace-nowrap text-ink-soft">
                    {s.numbers.length} câu · Câu {range(s.numbers)}
                    {s.fixed && <span className="block text-xs">Cố định thứ tự</span>}
                  </td>
                </tr>
              ))}
              {loose.length > 0 && (
                <tr>
                  <td className="py-2 pr-3 text-ink-soft" colSpan={2}>
                    Câu đứng riêng
                  </td>
                  <td className="py-2 text-right text-ink-soft">
                    {loose.length} câu · Câu {range(loose)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      <div className="space-y-3">
        {questions.map((q, qi) => (
          <div key={q.id} className="space-y-3">
            {startsGroup(questions, qi) && <QuestionGroupHeader content={q.group!.content} audioId={q.group!.audioFileId} className="mt-6" />}
            <Card>
              <p className="font-semibold text-ink">
                Câu {qi + 1} <span className="text-sm font-normal text-ink-soft">({formatScore(q.points)} điểm)</span>
                {q.level && (
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-brand-600">{LEVELS[LEVEL_FROM_DB[q.level]]}</span>
                )}
                {q.fixedOptions && <span className="ml-2 text-xs font-normal text-ink-soft">· Cố định đáp án</span>}
              </p>
              {q.audioFileId && <AudioClip id={q.audioFileId} className="mt-2" />}
              {q.content && <RichInline text={q.content} className="mt-1 block text-ink" />}
              <ul className="mt-3 space-y-1.5">
                {q.options.map((o, oi) => (
                  <li
                    key={o.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm",
                      o.isCorrect ? "bg-success-50 font-medium text-success-700" : "text-ink",
                    )}
                  >
                    <span className="font-semibold">{LETTERS[oi]}.</span> <RichInline text={o.content} />
                    {o.isCorrect && <Check className="ml-auto size-4" />}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
