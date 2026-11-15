"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Alert, Button, Input } from "@/components/ui";
import { loginAction, type LoginState } from "@/modules/auth/auth.actions";

const initialState: LoginState = { error: null };

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotHint, setShowForgotHint] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <h1 className="pb-2 text-center text-2xl font-bold text-ink">Đăng nhập</h1>

      {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
      {state.error && <Alert variant="danger">{state.error}</Alert>}

      <Input
        name="login"
        aria-label="Số điện thoại, email hoặc username"
        placeholder="Nhập số điện thoại, email hoặc username"
        autoComplete="username"
        autoFocus
        required
        // React 19 tự xóa form sau mỗi lần gửi — key theo state để giữ lại tên đã nhập.
        key={state.login}
        defaultValue={state.login}
      />

      <div className="relative">
        <Input
          name="password"
          type={showPassword ? "text" : "password"}
          aria-label="Mật khẩu"
          placeholder="Mật khẩu"
          autoComplete="current-password"
          required
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-soft hover:text-ink"
        >
          {showPassword ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
        </button>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowForgotHint((v) => !v)}
          className="text-sm text-ink hover:text-brand-700"
        >
          Quên mật khẩu?
        </button>
        {showForgotHint && (
          <p className="mt-1.5 text-sm text-ink-soft">
            Tài khoản do nhà trường cấp. Liên hệ giáo viên chủ nhiệm hoặc quản trị viên để được đặt lại mật khẩu.
          </p>
        )}
      </div>

      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending && <LoaderCircle className="size-4 animate-spin" />}
        Đăng nhập
      </Button>
    </form>
  );
}
