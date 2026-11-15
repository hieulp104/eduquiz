"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download, ExternalLink, FolderInput, LoaderCircle, Trash2 } from "lucide-react";
import { Alert, buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";
import { copyContentExamAction, removeContentAction } from "@/modules/content/content.actions";
import { CONTENT_PATH, type ContentKind } from "@/modules/content/content.types";

/** Nút ở cột trái trang chi tiết: Tải về / Mở video · Copy link · Lưu về thư viện (đề) · Gỡ khỏi kho (chủ). */
export function ContentActions({ id, kind, canCopy, isOwner }: { id: string; kind: ContentKind; canCopy: boolean; isOwner: boolean }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const download = `/api/kho-noi-dung/${id}/tai-ve`;

  function copyLink() {
    void navigator.clipboard.writeText(`${location.origin}${CONTENT_PATH}/${id}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function saveToLibrary() {
    setError(null);
    startTransition(async () => {
      const res = await copyContentExamAction({ id });
      if (!res.ok) return setError(res.message);
      router.push(`/de-thi/${res.data.examId}`);
    });
  }

  function remove() {
    if (!confirm("Gỡ nội dung này khỏi kho? (Đề / file gốc của bạn vẫn giữ nguyên.)")) return;
    setError(null);
    startTransition(async () => {
      const res = await removeContentAction({ id });
      if (!res.ok) return setError(res.message);
      router.push(`${CONTENT_PATH}?loai=cua-toi`);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {kind === "VIDEO" ? (
          <a href={download} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "md", "flex-1")}>
            <ExternalLink className="size-4" /> Mở video
          </a>
        ) : (
          <a href={download} className={buttonClass("primary", "md", "flex-1")}>
            <Download className="size-4" /> Tải về
          </a>
        )}
        <button type="button" onClick={copyLink} className={buttonClass("secondary", "md", "px-3")}>
          {copied ? <Check className="size-4 text-success-600" /> : <Copy className="size-4" />}
          {copied ? "Đã chép" : "Copy link"}
        </button>
      </div>
      {kind === "EXAM" && canCopy && (
        <button type="button" disabled={pending} onClick={saveToLibrary} className={buttonClass("secondary", "md", "w-full")}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <FolderInput className="size-4" />}
          Lưu về thư viện đề của tôi
        </button>
      )}
      {isOwner && (
        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className={cn(buttonClass("ghost", "md", "w-full"), "text-danger-600 hover:text-danger-700")}
        >
          <Trash2 className="size-4" /> Gỡ khỏi kho
        </button>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
    </div>
  );
}
