"use client";

import { useSyncExternalStore, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

const noop = () => () => {};

/** Địa chỉ trang web hiện tại (http://máy:cổng) — chỉ có ở trình duyệt. */
function useOrigin() {
  return useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  return {
    copied,
    copy: async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        window.prompt("Chép nội dung này:", text);
        return;
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    },
  };
}

/** Link làm bài đầy đủ + nút "Sao chép". */
export function CopyLinkBox({ path }: { path: string }) {
  const origin = useOrigin();
  const { copied, copy } = useCopy();
  const url = origin + path;
  return (
    <div className="flex items-stretch">
      <a
        href={path}
        className="flex min-w-0 flex-1 items-center rounded-l-md bg-muted px-3 text-sm text-brand-700 hover:underline dark:text-brand-300"
      >
        <span className="truncate">{url}</span>
      </a>
      <button
        type="button"
        onClick={() => copy(url)}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-r-md border border-brand-600 px-4 text-sm font-medium text-brand-700 hover:bg-muted dark:border-brand-400 dark:text-brand-300"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Đã chép" : "Sao chép"}
      </button>
    </div>
  );
}

/** Mã nhúng iframe để đặt đề lên website của giáo viên. */
export function EmbedCodeBox({ path, title }: { path: string; title: string }) {
  const origin = useOrigin();
  const { copied, copy } = useCopy();
  const safeTitle = title.replace(/[<>"&]/g, " ");
  const code = `<iframe width="100%" height="900" src="${origin}${path}" title="${safeTitle}" frameborder="0" allowfullscreen></iframe>`;
  return (
    <div>
      <pre className="min-h-32 rounded-md border border-line p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-ink">{code}</pre>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => copy(code)}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-sm text-ink-soft hover:bg-muted hover:text-ink",
          )}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Đã chép" : "Sao chép mã nhúng"}
        </button>
      </div>
    </div>
  );
}
