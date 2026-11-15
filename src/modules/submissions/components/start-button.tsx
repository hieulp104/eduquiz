"use client";

import { useState, useTransition } from "react";
import { Play } from "lucide-react";
import { Alert, Button, FormField, Input } from "@/components/ui";
import { startSubmissionAction } from "@/modules/submissions/submissions.actions";

type Props = {
  assignmentId: string;
  /** Đề có mật khẩu → hỏi trước khi bắt đầu (server kiểm tra lại). */
  needPassword?: boolean;
  label?: string;
};

export function StartButton({ assignmentId, needPassword = false, label = "Bắt đầu làm bài" }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      // Thành công thì action redirect — chỉ quay về đây khi lỗi.
      const res = await startSubmissionAction({ assignmentId, password });
      if (!res.ok) setError(res.message);
    });
  }

  return (
    <form onSubmit={start} className="space-y-3">
      {error && <Alert variant="danger">{error}</Alert>}
      {needPassword && (
        <FormField label="Mật khẩu đề thi" htmlFor="exam-password">
          <Input
            id="exam-password"
            type="password"
            autoComplete="off"
            value={password}
            maxLength={50}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu giáo viên cung cấp"
            required
          />
        </FormField>
      )}
      <Button type="submit" disabled={pending}>
        <Play className="size-4" />
        {pending ? "Đang mở đề..." : label}
      </Button>
    </form>
  );
}
