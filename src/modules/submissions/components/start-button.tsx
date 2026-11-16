"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronRight, CircleAlert } from "lucide-react";
import { Alert, Button, FormField, Input } from "@/components/ui";
import { startGuestAction, startSubmissionAction } from "@/modules/submissions/submissions.actions";

type Props = {
  /** Học sinh đã đăng nhập: bài giao sẽ làm. */
  assignmentId?: string;
  /** Khách chưa đăng nhập: mã đề trong link /thi/<mã> (tạo tài khoản ẩn danh khi xác nhận). */
  guestCode?: string;
  /** Đề có mật khẩu → hỏi trước khi bắt đầu (server kiểm tra lại). */
  needPassword?: boolean;
  /** Hỏi họ tên / lớp / STT (khách và tài khoản ẩn danh). */
  askInfo?: boolean;
  defaultName?: string;
  label?: string;
};

/**
 * Nút "Bắt đầu thi". Cần mật khẩu hoặc thông tin người làm thì mở hộp "nhập thêm thông tin" trước;
 * không cần gì thì vào làm bài luôn.
 */
export function StartButton({ assignmentId, guestCode, needPassword = false, askInfo = false, defaultName = "", label = "Bắt đầu thi" }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(defaultName);
  const [className, setClassName] = useState("");
  const [number, setNumber] = useState("");
  const needDialog = needPassword || askInfo;

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  function start() {
    setError(null);
    startTransition(async () => {
      // Thành công thì action chuyển sang trang làm bài — chỉ quay về đây khi lỗi.
      const info = askInfo ? { fullName, className, number } : {};
      const res = guestCode
        ? await startGuestAction({ code: guestCode, password, fullName, className, number })
        : await startSubmissionAction({ assignmentId, password, ...info });
      if (res && !res.ok) setError(res.message);
    });
  }

  const ready = (!needPassword || password.length > 0) && (!askInfo || fullName.trim().length > 0);

  return (
    <>
      {error && !open && <Alert variant="danger">{error}</Alert>}
      <Button className="h-11 w-full text-[15px]" disabled={pending} onClick={() => (needDialog ? setOpen(true) : start())}>
        {pending && !needDialog ? "Đang mở đề..." : label}
        <ChevronRight className="size-4" />
      </Button>

      {needDialog && (
        <dialog
          ref={dialogRef}
          onClose={() => setOpen(false)}
          className="m-auto w-[calc(100%-2rem)] max-w-[750px] rounded-lg border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start();
            }}
          >
            <div className="border-b border-line px-4 py-3.5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <CircleAlert className="size-5 text-warning-700 dark:text-amber-300" />
                Vui lòng nhập thêm thông tin để bắt đầu bài thi
              </h2>
              <p className="mt-1.5 text-xs text-ink-soft">Những thông tin này sẽ giúp giáo viên định danh và chấm điểm cho bạn</p>
            </div>

            <div className="space-y-4 px-4 py-4">
              {error && <Alert variant="danger">{error}</Alert>}
              {needPassword && (
                <FormField label="Mật khẩu bài thi" htmlFor="exam-password">
                  <Input
                    id="exam-password"
                    type="password"
                    autoComplete="off"
                    autoFocus
                    value={password}
                    maxLength={50}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <p className="mt-1.5 text-xs text-danger-600 italic">
                    Nếu bạn chưa có Mật khẩu của bài thi. Vui lòng liên hệ giáo viên của bạn!
                  </p>
                </FormField>
              )}
              {askInfo && (
                <>
                  <FormField label="Họ và tên" htmlFor="taker-name">
                    <Input
                      id="taker-name"
                      autoComplete="name"
                      autoFocus={!needPassword}
                      value={fullName}
                      maxLength={80}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </FormField>
                  <FormField label="Lớp" htmlFor="taker-class">
                    <Input id="taker-class" value={className} maxLength={30} onChange={(e) => setClassName(e.target.value)} />
                  </FormField>
                  <FormField label="STT" htmlFor="taker-number">
                    <Input id="taker-number" inputMode="numeric" value={number} maxLength={10} onChange={(e) => setNumber(e.target.value)} />
                  </FormField>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
              <Button type="button" variant="secondary" className="min-w-28" onClick={() => setOpen(false)} disabled={pending}>
                Hủy
              </Button>
              <Button type="submit" className="min-w-28" disabled={pending || !ready}>
                {pending ? "Đang mở đề..." : "Xác nhận"}
              </Button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
