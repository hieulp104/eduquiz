"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Alert, Button, FormField, Input, Modal, Select } from "@/components/ui";
import { GRADES, gradeLabel, subjectsForGrade, SUBJECTS } from "@/common/enums";
import { createBankAction, updateBankAction } from "@/modules/banks/banks.actions";
import { BANKS_PATH, type BankBookOption, type BankCard } from "@/modules/banks/banks.types";

export type BankDraft = Pick<BankCard, "id" | "name" | "grade" | "subject" | "bookId">;

/** "Tạo ngân hàng câu hỏi mới" / sửa: Tên · Khối học · Môn học · Sách (lọc theo khối + môn). */
export function BankDialog({
  open,
  onClose,
  books,
  editing = null,
}: {
  open: boolean;
  onClose: () => void;
  books: BankBookOption[];
  editing?: BankDraft | null;
}) {
  const router = useRouter();
  const uid = useId();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [bookId, setBookId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- làm mới mỗi lần mở */
    setName(editing?.name ?? "");
    setGrade(editing?.grade != null ? String(editing.grade) : "");
    setSubject(editing?.subject ?? "");
    setBookId(editing?.bookId ?? "");
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, editing]);

  const subjects = grade === "" ? [...SUBJECTS] : subjectsForGrade(Number(grade));
  const bookChoices = books.filter((b) => (grade === "" || b.grade === Number(grade)) && (!subject || b.subject === subject));

  function submit() {
    setError(null);
    const data = { name, grade: grade === "" ? null : Number(grade), subject, bookId: bookId || null };
    startTransition(async () => {
      if (editing) {
        const res = await updateBankAction({ id: editing.id, ...data });
        if (!res.ok) return setError(res.message);
        onClose();
        return router.refresh();
      }
      const res = await createBankAction(data);
      if (!res.ok) return setError(res.message);
      router.push(`${BANKS_PATH}/${res.data.id}`);
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Sửa ngân hàng câu hỏi" : "Tạo ngân hàng câu hỏi mới"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-24">
            Hủy
          </Button>
          <Button onClick={submit} disabled={pending} className="w-28">
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            Lưu
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <FormField label="Tên" htmlFor={`${uid}-name`}>
          <Input id={`${uid}-name`} autoFocus value={name} maxLength={150} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên" />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Khối học" htmlFor={`${uid}-grade`}>
            <Select
              id={`${uid}-grade`}
              value={grade}
              onChange={(e) => {
                setGrade(e.target.value);
                setBookId("");
              }}
            >
              <option value="">— Chọn khối —</option>
              {[...GRADES, 0].map((g) => (
                <option key={g} value={g}>
                  {gradeLabel(g)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Môn học" htmlFor={`${uid}-subject`}>
            <Select
              id={`${uid}-subject`}
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setBookId("");
              }}
            >
              <option value="">— Chọn môn —</option>
              {[...new Set([...subjects, ...(subject ? [subject] : [])])].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField
          label="Sách"
          htmlFor={`${uid}-book`}
          hint={bookChoices.length ? "Chọn sách để tạo nhanh cấu trúc chương / bài theo sách." : "Chưa có mục lục sách cho khối / môn này — tự thêm cấu trúc sau."}
        >
          <Select id={`${uid}-book`} value={bookId} onChange={(e) => setBookId(e.target.value)}>
            <option value="">Không theo sách</option>
            {bookChoices.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </Select>
        </FormField>
        {error && <Alert variant="danger">{error}</Alert>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
