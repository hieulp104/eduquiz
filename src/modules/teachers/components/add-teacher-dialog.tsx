"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudDownload, FileSpreadsheet, LoaderCircle } from "lucide-react";
import { Alert, Button, FormField, Input, Modal } from "@/components/ui";
import { cn } from "@/lib/utils";
import { addTeacherAction, importTeachersAction, updateTeacherAction } from "@/modules/teachers/teachers.actions";
import { ADD_OUTCOME_LABEL, type AddTeacherOutcome, type ManagedTeacherItem } from "@/modules/teachers/teachers.types";

type Row = { name: string; contact: string };
type Tab = "manual" | "excel";

/**
 * "Thêm giáo viên": nhập tay (họ tên + SĐT 10 số / email) hoặc nhập từ file Excel.
 * Truyền `editing` → hộp "Sửa giáo viên" (chỉ phần nhập tay).
 */
export function AddTeacherDialog({
  open,
  onClose,
  onDone,
  editing = null,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
  editing?: ManagedTeacherItem | null;
}) {
  const router = useRouter();
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("manual");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [file, setFile] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [results, setResults] = useState<AddTeacherOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- làm mới mỗi lần mở */
    setTab("manual");
    setName(editing?.name ?? "");
    setContact(editing?.phone ?? editing?.email ?? "");
    setFile(null);
    setRows(null);
    setWarnings([]);
    setResults(null);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, editing]);

  async function read(f: File | undefined) {
    if (!f) return;
    setError(null);
    setResults(null);
    setReading(true);
    try {
      const body = new FormData();
      body.append("file", f);
      const res = await fetch("/api/teachers/import", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? "Không đọc được file.");
      setFile(f.name);
      setRows(json.rows);
      setWarnings(json.warnings ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      if (tab === "manual") {
        const res = editing
          ? await updateTeacherAction({ memberId: editing.id, name, contact })
          : await addTeacherAction({ name, contact });
        if (!res.ok) return setError(res.message);
        router.refresh();
        onDone(editing ? "Đã lưu thông tin giáo viên" : "Thêm giáo viên thành công");
        return onClose();
      }
      if (!rows?.length) return;
      const res = await importTeachersAction({ rows });
      if (!res.ok) return setError(res.message);
      router.refresh();
      const added = res.data.filter((r) => r.status === "added").length;
      if (added === res.data.length) {
        onDone(`Đã thêm ${added} giáo viên`);
        return onClose();
      }
      setResults(res.data);
      setRows(null);
    });
  }

  const canSubmit = tab === "manual" ? Boolean(name.trim() && contact.trim()) : Boolean(rows?.length);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={editing ? "Sửa giáo viên" : "Thêm giáo viên"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-24">
            {results ? "Đóng" : "Hủy"}
          </Button>
          {!results && (
            <Button onClick={submit} disabled={pending || !canSubmit} className="min-w-28">
              {pending && <LoaderCircle className="size-4 animate-spin" />}
              {editing ? "Lưu" : tab === "excel" && rows?.length ? `Thêm ${rows.length} giáo viên` : "Thêm"}
            </Button>
          )}
        </>
      }
    >
      {!editing && (
        <div role="tablist" className="mb-4 flex border-b border-line text-sm">
          {(
            [
              ["manual", "Thêm giáo viên"],
              ["excel", "Nhập từ File Excel"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => {
                setTab(key);
                setError(null);
              }}
              className={cn(
                "-mb-px border-b-2 px-5 py-2.5",
                tab === key ? "border-brand-600 font-medium text-brand-700 dark:text-brand-300" : "border-transparent text-ink-soft hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "manual" ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) submit();
          }}
        >
          <FormField label="Họ và tên" htmlFor={`${uid}-name`}>
            <Input id={`${uid}-name`} name="name" autoFocus value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="VD: Nguyễn Văn A" />
          </FormField>
          <FormField label="Nhập số điện thoại hoặc email" htmlFor={`${uid}-contact`} hint="Số điện thoại gồm 10 chữ số, VD 0912345678.">
            <Input
              id={`${uid}-contact`}
              name="contact"
              value={contact}
              maxLength={200}
              inputMode={/^[ds.+]*$/.test(contact) ? "tel" : "email"}
              onChange={(e) => setContact(e.target.value)}
              placeholder="VD: 0912345678"
            />
          </FormField>
          <button type="submit" hidden />
        </form>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void read(e.dataTransfer.files?.[0]);
            }}
            disabled={reading}
            className={cn(
              "flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-7 text-sm text-ink-soft hover:border-brand-500 hover:text-brand-700",
              dragging ? "border-brand-500 bg-muted" : "border-line",
            )}
          >
            {reading ? (
              <LoaderCircle className="size-8 animate-spin text-brand-600" />
            ) : (
              <FileSpreadsheet className="size-8 text-success-600" strokeWidth={1.5} />
            )}
            {file ? `Đã đọc “${file}” — bấm để chọn file khác` : "Kéo thả file Excel hoặc bấm để chọn file"}
          </button>
          <a
            href="/api/teachers/template"
            className="mx-auto flex w-fit items-center gap-1.5 text-sm text-brand-700 hover:underline dark:text-brand-300"
          >
            <CloudDownload className="size-4" /> Tải file biểu mẫu
          </a>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              void read(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          {warnings.length > 0 && (
            <Alert>
              <ul className="list-disc space-y-0.5 pl-5">
                {warnings.slice(0, 8).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Alert>
          )}

          {(rows?.length || results) && (
            <div className="max-h-72 overflow-auto rounded-md border border-line">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left">
                  <tr>
                    <th className="w-10 px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Họ và tên</th>
                    <th className="px-3 py-2 font-medium">SĐT / email</th>
                    {results && <th className="px-3 py-2 font-medium">Kết quả</th>}
                  </tr>
                </thead>
                <tbody>
                  {(results ?? rows ?? []).map((r: Row & Partial<AddTeacherOutcome>, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-3 py-2 text-ink-soft">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2 text-ink-soft">{r.contact}</td>
                      {r.status && (
                        <td className={cn("px-3 py-2", r.status === "added" ? "text-success-600" : "text-danger-600")}>
                          {r.message ?? ADD_OUTCOME_LABEL[r.status]}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {error && (
        <Alert variant="danger" className="mt-4">
          {error}
        </Alert>
      )}
    </Modal>
  );
}
