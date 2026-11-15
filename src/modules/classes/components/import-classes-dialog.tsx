"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, Download, LoaderCircle } from "lucide-react";
import { Alert, Button, Modal } from "@/components/ui";
import { formatSchoolYear } from "@/modules/classes/class-board";
import { importClassesAction } from "@/modules/classes/classes.actions";

type Row = { name: string; schoolYear: string; groupName: string | null };

/** "Tạo danh sách lớp bằng excel": tải mẫu → chọn file → xem trước → tạo lớp. */
export function ImportClassesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- làm mới mỗi lần mở */
    setFile(null);
    setRows(null);
    setWarnings([]);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

  async function read(f: File | undefined) {
    if (!f) return;
    setError(null);
    setReading(true);
    try {
      const body = new FormData();
      body.append("file", f);
      const res = await fetch("/api/classes/import", { method: "POST", body });
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

  function create() {
    if (!rows?.length) return;
    startTransition(async () => {
      const res = await importClassesAction({ rows });
      if (!res.ok) return setError(res.message);
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Tạo danh sách lớp bằng Excel"
      description='Cột "Tên lớp" bắt buộc; "Năm học" bỏ trống = năm học hiện tại; "Nhóm lớp" chưa có sẽ được tạo mới.'
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-24">
            Hủy
          </Button>
          <Button onClick={create} disabled={pending || !rows?.length}>
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            {rows?.length ? `Tạo ${rows.length} lớp` : "Tạo lớp"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col items-center rounded-lg border border-dashed border-line px-4 py-6 text-center">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={reading}
            className="flex flex-col items-center gap-2 text-sm font-medium text-ink hover:text-brand-700"
          >
            {reading ? (
              <LoaderCircle className="size-10 animate-spin text-brand-600" />
            ) : (
              <CloudUpload className="size-10 text-brand-600" strokeWidth={1.75} />
            )}
            {file ? `Đã đọc “${file}” — bấm để chọn file khác` : "Chọn file Excel (.xlsx)"}
          </button>
          <a href="/api/classes/template" className="mt-3 flex items-center gap-1 text-sm text-brand-700 hover:underline dark:text-brand-300">
            <Download className="size-4" /> Tải file mẫu
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
        </div>

        {error && <Alert variant="danger">{error}</Alert>}
        {warnings.length > 0 && (
          <Alert>
            <ul className="list-disc space-y-0.5 pl-5">
              {warnings.slice(0, 8).map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Alert>
        )}

        {rows && rows.length > 0 && (
          <div className="overflow-hidden rounded-md border border-line">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="w-12 px-3 py-2 font-medium">STT</th>
                  <th className="px-3 py-2 font-medium">Tên lớp</th>
                  <th className="px-3 py-2 font-medium">Năm học</th>
                  <th className="px-3 py-2 font-medium">Nhóm lớp</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-3 py-2 text-ink-soft">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 text-ink-soft">{formatSchoolYear(r.schoolYear)}</td>
                    <td className="px-3 py-2 text-ink-soft">{r.groupName ?? "Khác"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
