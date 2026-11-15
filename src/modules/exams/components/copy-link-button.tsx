"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/** Chép link (đường dẫn trong app → link đầy đủ). Không có `path` thì nút mờ, hiện lý do khi rê chuột. */
export function CopyLinkButton({
  path,
  disabledReason,
  label = "Copy link",
  className,
}: {
  path: string | null;
  disabledReason?: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!path) return;
    const url = new URL(path, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Chép link này:", url);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!path}
      title={path ? undefined : disabledReason}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border border-brand-600 px-3 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-line disabled:text-ink-faint disabled:hover:bg-transparent dark:border-brand-400 dark:text-brand-300 dark:hover:bg-brand-900/30",
        className,
      )}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Đã chép" : label}
    </button>
  );
}
