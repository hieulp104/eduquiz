"use client";

import { FormField, Input } from "@/components/ui";
// Import trực tiếp (không qua barrel) — Tiptap nặng.
import { RichTextEditor } from "@/components/ui/forms/rich-text-editor";
import { PRICE_MODE_LABEL, type PriceMode } from "@/modules/publish/publish.types";

export type PricingValue = { priceMode: PriceMode; price: number; priceNote: string };

const MODES = Object.keys(PRICE_MODE_LABEL) as PriceMode[];

const groupDigits = (n: number) => (n > 0 ? new Intl.NumberFormat("vi-VN").format(n) : "");

/** "Cấu hình giá": miễn phí / thu phí khi tham gia thi / thu phí khi xem giải thích + giá + mô tả. */
export function PricingFields({
  value,
  onChange,
  name = "price-mode",
}: {
  value: PricingValue;
  onChange: (patch: Partial<PricingValue>) => void;
  /** Tên nhóm radio — khác nhau nếu 1 trang có 2 form. */
  name?: string;
}) {
  const paid = value.priceMode !== "FREE";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
        <p className="mr-auto text-sm font-medium text-ink">Cấu hình giá</p>
        {MODES.map((m) => (
          <label key={m} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              name={name}
              checked={value.priceMode === m}
              onChange={() => onChange({ priceMode: m })}
              className="size-4 accent-brand-600"
            />
            {PRICE_MODE_LABEL[m]}
          </label>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-ink-soft">
        Đặt giá cho đề để học sinh biết mức phí trước khi tham gia thi hoặc xem giải thích.{" "}
        <span className="text-danger-600">
          Lưu ý: hệ thống hiện chỉ hiển thị giá và mô tả cho học sinh, chưa thu tiền online — giáo viên tự thu phí trực tiếp.
        </span>
      </p>

      {paid && (
        <>
          <FormField label="Nhập giá tiền (VND)" htmlFor={`${name}-amount`}>
            <Input
              id={`${name}-amount`}
              inputMode="numeric"
              value={groupDigits(value.price)}
              placeholder="VD: 50.000"
              onChange={(e) => onChange({ price: Number(e.target.value.replace(/\D/g, "").slice(0, 9)) })}
            />
          </FormField>
          <FormField label="Nhập mô tả">
            <RichTextEditor
              defaultValue={value.priceNote}
              onChange={(html) => onChange({ priceNote: html })}
              placeholder="Quyền lợi khi tham gia, cách thanh toán, thông tin liên hệ…"
            />
          </FormField>
        </>
      )}
    </div>
  );
}
