import { RichInline } from "@/components/ui";
import { cn } from "@/lib/utils";

type WithGroup = { group?: { id: string; content: string } | null };

/** Câu `index` là câu đầu tiên của nhóm → cần in lời dẫn / đoạn văn của nhóm phía trên nó. */
export function startsGroup<T extends WithGroup>(questions: T[], index: number) {
  const g = questions[index].group;
  return Boolean(g && questions[index - 1]?.group?.id !== g.id);
}

/** Trình phát file nghe của câu / nhóm (file qua /api/files — kiểm quyền ở đó). */
export function AudioClip({ id, className }: { id: string; className?: string }) {
  return <audio controls preload="none" src={`/api/files/${id}`} className={cn("h-10 w-full max-w-md", className)} />;
}

/** Lời dẫn / đoạn văn chung của nhóm câu (dùng ở trang làm bài, kết quả, xem nội dung đề). */
export function QuestionGroupHeader({
  content,
  audioId,
  className,
}: {
  content: string;
  audioId?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2 rounded-xl border-l-4 border-brand-500 bg-muted px-5 py-4", className)}>
      {audioId && <AudioClip id={audioId} />}
      {content && <RichInline text={content} className="block text-[15px] leading-relaxed text-ink" />}
    </div>
  );
}
