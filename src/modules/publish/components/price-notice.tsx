import { BadgeDollarSign } from "lucide-react";
import { PRICE_MODE_LABEL, formatPrice, type PriceMode } from "@/modules/publish/publish.types";

/**
 * Thông tin thu phí của đề cho học sinh. Hệ thống CHƯA thu tiền online — chỉ báo giá và mô tả
 * do giáo viên nhập (priceNote đã lọc bằng sanitizeRichText lúc lưu).
 */
export function PriceNotice({ mode, price, note }: { mode: PriceMode; price: number; note: string }) {
  if (mode === "FREE") return null;
  return (
    <div className="rounded-lg border border-line bg-muted px-4 py-3 text-sm text-ink">
      <p className="flex items-center gap-2 font-medium">
        <BadgeDollarSign className="size-4 text-warning-700 dark:text-amber-300" />
        {PRICE_MODE_LABEL[mode]}: {formatPrice(price)}
      </p>
      {note && <div className="rich-content mt-2 text-ink-soft" dangerouslySetInnerHTML={{ __html: note }} />}
      <p className="mt-2 text-xs text-ink-faint">Hệ thống chưa hỗ trợ thanh toán online — vui lòng thanh toán trực tiếp với giáo viên.</p>
    </div>
  );
}
