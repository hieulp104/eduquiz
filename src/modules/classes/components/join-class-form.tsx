"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { Alert, Button, Card, CardTitle, Input } from "@/components/ui";
import { joinClassAction, type FormState } from "@/modules/classes/classes.actions";

const initialState: FormState = { error: null };

export function JoinClassForm() {
  const [state, formAction, pending] = useActionState(joinClassAction, initialState);

  return (
    <Card>
      <CardTitle className="mb-3">Vào lớp bằng mã</CardTitle>
      <form action={formAction} className="flex gap-3">
        <Input
          name="joinCode"
          placeholder="Nhập mã 6 ký tự giáo viên gửi"
          maxLength={6}
          required
          aria-label="Mã lớp"
          className="uppercase"
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          <LogIn className="size-4" />
          Vào lớp
        </Button>
      </form>
      {state.error && <Alert variant="danger" className="mt-3">{state.error}</Alert>}
      {state.success && <Alert variant="success" className="mt-3">{state.success}</Alert>}
    </Card>
  );
}
