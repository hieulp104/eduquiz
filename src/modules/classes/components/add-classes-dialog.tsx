"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Info, LoaderCircle, Plus } from "lucide-react";
import { Alert, Button, Modal, Select, Textarea } from "@/components/ui";
import { formatSchoolYear, schoolYearOptions, type BoardGroup } from "@/modules/classes/class-board";
import { createClassesAction, createClassGroupAction } from "@/modules/classes/classes.actions";

type Props = {
  open: boolean;
  onClose: () => void;
  groups: BoardGroup[];
  currentYear: string;
  /** Nhóm chọn sẵn khi mở. */
  defaultGroupId?: string | null;
};

/** "Thêm lớp học": mỗi dòng 1 tên lớp, chọn năm học + nhóm lớp. "Lưu" giữ hộp thoại để tạo tiếp. */
export function AddClassesDialog({ open, onClose, groups, currentYear, defaultGroupId = null }: Props) {
  const router = useRouter();
  const [names, setNames] = useState("");
  const [year, setYear] = useState(currentYear);
  const [groupId, setGroupId] = useState<string | null>(defaultGroupId);
  const [extraGroups, setExtraGroups] = useState<BoardGroup[]>([]);
  const [newGroup, setNewGroup] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- làm mới form mỗi lần mở */
    setNames("");
    setGroupId(defaultGroupId);
    setNewGroup(null);
    setMessage(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, defaultGroupId]);

  const allGroups = [...groups, ...extraGroups.filter((g) => !groups.some((x) => x.id === g.id))];
  const count = new Set(names.split("\n").map((l) => l.trim()).filter(Boolean)).size;

  function save(close: boolean) {
    setMessage(null);
    startTransition(async () => {
      const res = await createClassesAction({ names, schoolYear: year, groupId });
      if (!res.ok) return setMessage({ ok: false, text: res.message });
      router.refresh();
      if (close) return onClose();
      setNames("");
      setMessage({ ok: true, text: `Đã tạo ${res.data.count} lớp: ${res.data.names.join(", ")}.` });
    });
  }

  function addGroup() {
    if (!newGroup?.trim()) return;
    startTransition(async () => {
      const res = await createClassGroupAction({ name: newGroup });
      if (!res.ok) return setMessage({ ok: false, text: res.message });
      setExtraGroups((g) => [...g, res.data]);
      setGroupId(res.data.id);
      setNewGroup(null);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Thêm lớp học"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-24">
            Hủy
          </Button>
          <Button onClick={() => save(false)} disabled={pending || count === 0} className="w-24">
            {pending && <LoaderCircle className="size-4 animate-spin" />} Lưu
          </Button>
          <Button
            onClick={() => save(true)}
            disabled={pending || count === 0}
            className="bg-bank-500 hover:bg-bank-600"
          >
            Lưu và đóng
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="class-names" className="mb-1.5 block text-sm font-medium">
            Tên lớp
          </label>
          <Textarea
            id="class-names"
            autoFocus
            rows={3}
            value={names}
            onChange={(e) => setNames(e.target.value)}
            placeholder="Nhập tên lớp"
          />
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-soft">
            <Info className="size-3.5" /> Nhập mỗi tên lớp trên một dòng để thực hiện việc tạo nhiều lớp
            {count > 1 && <b className="ml-1 text-brand-600">({count} lớp)</b>}
          </p>
        </div>

        <div>
          <label htmlFor="class-year" className="mb-1.5 block text-sm font-medium">
            Năm học
          </label>
          <Select id="class-year" value={year} onChange={(e) => setYear(e.target.value)}>
            {schoolYearOptions(currentYear).map((y) => (
              <option key={y} value={y}>
                {formatSchoolYear(y)}
              </option>
            ))}
          </Select>
        </div>

        <fieldset className="overflow-hidden rounded-md border border-line">
          <legend className="sr-only">Chọn nhóm lớp</legend>
          <p className="bg-muted px-4 py-3 text-sm font-medium" aria-hidden>
            Chọn nhóm lớp
          </p>
          <div className="max-h-48 space-y-1 overflow-y-auto px-4 py-3">
            {[{ id: null, name: "Khác" }, ...allGroups].map((g) => (
              <label key={g.id ?? "none"} className="flex cursor-pointer items-center gap-3 rounded px-1 py-1.5 text-sm hover:bg-muted">
                <input
                  type="radio"
                  name="class-group"
                  checked={groupId === g.id}
                  onChange={() => setGroupId(g.id)}
                  className="size-4 accent-brand-600"
                />
                {g.name}
              </label>
            ))}
          </div>
          <div className="px-4 pb-3">
            {newGroup === null ? (
              <button type="button" onClick={() => setNewGroup("")} className="flex items-center gap-1 text-sm text-brand-700 hover:underline dark:text-brand-300">
                <Plus className="size-4" /> Thêm nhóm
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newGroup}
                  maxLength={100}
                  onChange={(e) => setNewGroup(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addGroup();
                    }
                  }}
                  placeholder="Nhập tên nhóm"
                  className="h-9 flex-1 rounded-md border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none"
                />
                <Button size="sm" className="h-9" onClick={addGroup} disabled={pending || !newGroup.trim()}>
                  Thêm
                </Button>
                <Button size="sm" variant="ghost" className="h-9" onClick={() => setNewGroup(null)}>
                  Hủy
                </Button>
              </div>
            )}
          </div>
        </fieldset>

        {message && <Alert variant={message.ok ? "success" : "danger"}>{message.text}</Alert>}
      </div>
    </Modal>
  );
}
