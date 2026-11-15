import { cn } from "@/lib/utils";
import { toRuns } from "@/lib/inline-format";

/**
 * Hiển thị nội dung câu hỏi có <b> <i> <u> (lib/inline-format.ts) — render bằng React, không chèn HTML.
 * Giữ xuống dòng (whitespace-pre-wrap). Dùng được ở cả server lẫn client component.
 */
export function RichInline({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {toRuns(text).map((r, i) =>
        r.b || r.i || r.u ? (
          <span
            key={i}
            className={cn(r.b && "font-bold", r.i && "italic", r.u && "underline decoration-1 underline-offset-[3px]")}
          >
            {r.text}
          </span>
        ) : (
          r.text
        ),
      )}
    </span>
  );
}
