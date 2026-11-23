"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { FIELD_CLASS } from "./input";
import { Select } from "./select";

/**
 * Ô ngày giờ 24h — thay cho <input type="datetime-local">.
 *
 * Ô gốc của trình duyệt hiện giờ theo ngôn ngữ máy (12h kèm "SA/CH" trên máy tiếng Việt) và
 * không ép được sang 24h. Ở đây tách 3 ô riêng: ngày (bấm là mở lịch) · giờ 0–23 · phút 0–59.
 * Giá trị vào/ra GIỐNG HỆT datetime-local: "YYYY-MM-DDTHH:mm" (giờ VN), "" = bỏ trống →
 * dùng tiếp parseVnDateTimeLocal / toVnDateTimeLocal như cũ.
 *
 * Dùng kiểu controlled (value + onChange) hoặc trong <form> (name + defaultValue → input ẩn).
 */

export const DATETIME_MIN = "2000-01-01T00:00";
export const DATETIME_MAX = "2099-12-31T23:59";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = Array.from({ length: 60 }, (_, m) => m);
const pad = (n: number) => String(n).padStart(2, "0");

type Props = {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Có name → kèm <input type="hidden"> để gửi theo form. */
  name?: string;
  /** Nhãn cho trình đọc màn hình ("Bắt đầu", "Hạn nộp"...). */
  label: string;
  /** Giờ gán sẵn khi vừa chọn ngày mà chưa chọn giờ. */
  defaultTime?: string;
  min?: string;
  max?: string;
  invalid?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
};

export function DateTimeField({
  value,
  defaultValue = "",
  onChange,
  name,
  label,
  defaultTime = "07:00",
  min = DATETIME_MIN,
  max = DATETIME_MAX,
  invalid,
  required,
  id,
  className,
}: Props) {
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;

  const date = current.slice(0, 10);
  const [hh, mm] = (current.slice(11, 16) || defaultTime)
    .split(":")
    .map(Number);

  function emit(next: string) {
    if (value === undefined) setInner(next);
    onChange?.(next);
  }
  function update(part: { date?: string; h?: number; m?: number }) {
    const d = part.date ?? date;
    if (!d) return emit("");
    emit(`${d}T${pad(part.h ?? hh)}:${pad(part.m ?? mm)}`);
  }

  const invalidClass =
    invalid &&
    "border-danger-600 focus:border-danger-600 focus:ring-danger-600/20";

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_6.5rem_6.5rem] gap-2",
        className,
      )}
    >
      <div className="relative">
        <CalendarDays
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft"
          aria-hidden
        />
        <input
          id={id}
          type="date"
          aria-label={`${label}: ngày`}
          aria-invalid={invalid || undefined}
          required={required}
          value={date}
          min={min.slice(0, 10)}
          max={max.slice(0, 10)}
          onChange={(e) => update({ date: e.target.value })}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker();
            } catch {
              /* trình duyệt cũ không có showPicker — vẫn gõ tay được */
            }
          }}
          className={cn(
            FIELD_CLASS,
            "h-10 cursor-pointer pl-9 [&::-webkit-calendar-picker-indicator]:hidden",
            !date && "text-ink-faint",
            invalidClass,
          )}
        />
      </div>
      <Select
        aria-label={`${label}: giờ`}
        value={hh}
        disabled={!date}
        onChange={(e) => update({ h: Number(e.target.value) })}
        className={cn(
          "tabular-nums disabled:cursor-not-allowed disabled:text-ink-faint",
          invalidClass,
        )}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {pad(h)} giờ
          </option>
        ))}
      </Select>
      <Select
        aria-label={`${label}: phút`}
        value={mm}
        disabled={!date}
        onChange={(e) => update({ m: Number(e.target.value) })}
        className={cn(
          "tabular-nums disabled:cursor-not-allowed disabled:text-ink-faint",
          invalidClass,
        )}
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {pad(m)} phút
          </option>
        ))}
      </Select>
      {name && <input type="hidden" name={name} value={current} />}
    </div>
  );
}
