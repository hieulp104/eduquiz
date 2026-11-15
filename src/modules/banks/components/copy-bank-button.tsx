"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, LoaderCircle } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { copyBankAction } from "@/modules/banks/banks.actions";
import { BANKS_PATH } from "@/modules/banks/banks.types";

/** "Copy ngân hàng": nhân bản cấu trúc + câu hỏi rồi mở bản sao. */
export function CopyBankButton({ bankId }: { bankId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Tạo bản sao ngân hàng này (cả cấu trúc và câu hỏi)?")) return;
        startTransition(async () => {
          const res = await copyBankAction({ id: bankId });
          if (!res.ok) return alert(res.message);
          router.push(`${BANKS_PATH}/${res.data.id}`);
        });
      }}
      className={buttonClass("secondary", "md", "border-brand-500 text-brand-700 dark:text-brand-300")}
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Copy className="size-4" />} Copy ngân hàng
    </button>
  );
}
