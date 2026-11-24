"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Send } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  CardTitle,
  DateTimeField,
  FormField,
  Select,
} from "@/components/ui";
import {
  createAssignmentAction,
  type AssignFormState,
} from "@/modules/assignments/assignments.actions";

const initialState: AssignFormState = { error: null };

type Props = {
  classId: string;
  exams: { id: string; title: string }[];
  /** Giá trị mặc định cho ô thời gian (giờ VN), tính ở server để tránh lệch hydration. */
  defaultOpenAt: string;
  defaultDueAt: string;
};

export function AssignExamForm({
  classId,
  exams,
  defaultOpenAt,
  defaultDueAt,
}: Props) {
  const [state, formAction, pending] = useActionState(
    createAssignmentAction,
    initialState,
  );

  if (exams.length === 0) {
    return (
      <Card>
        <CardTitle className="mb-2">Giao bài</CardTitle>
        <p className="text-sm text-ink-soft">
          Bạn chưa có đề nào.{" "}
          <Link
            href="/de-thi/tao-moi"
            className="font-medium text-brand-700 hover:underline"
          >
            Soạn đề đầu tiên
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle className="mb-3">Giao bài</CardTitle>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="classId" value={classId} />
        <FormField label="Đề thi" htmlFor="examId">
          <Select id="examId" name="examId" required>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Mở đề lúc" htmlFor="openAt">
            <DateTimeField
              id="openAt"
              name="openAt"
              label="Mở đề lúc"
              defaultValue={defaultOpenAt}
              required
            />
          </FormField>
          <FormField label="Hạn nộp" htmlFor="dueAt">
            <DateTimeField
              id="dueAt"
              name="dueAt"
              label="Hạn nộp"
              defaultValue={defaultDueAt}
              defaultTime="23:59"
              required
            />
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="showAnswer"
            defaultChecked
            className="size-4 accent-brand-600"
          />
          Cho học sinh xem đáp án sau khi nộp
        </label>
        {state.error && <Alert variant="danger">{state.error}</Alert>}
        {state.success && <Alert variant="success">{state.success}</Alert>}
        <Button type="submit" disabled={pending}>
          <Send className="size-4" /> Giao bài
        </Button>
      </form>
    </Card>
  );
}
