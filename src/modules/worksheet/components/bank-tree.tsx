"use client";

import { useState } from "react";
import { ChevronRight, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BankTreeNode } from "@/modules/worksheet/worksheet.types";

type Props = {
  nodes: BankTreeNode[];
  /** Bấm vào tên mục → thêm ngẫu nhiên 1 câu trong nhánh. */
  onPick: (node: BankTreeNode) => void;
  /** Mục đang chờ server trả câu hỏi. */
  pendingId: string | null;
};

/** Cây câu hỏi: mũi tên để mở/đóng, bấm tên để thêm câu. */
export function BankTree({ nodes, onPick, pendingId }: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const render = (list: BankTreeNode[], depth: number) => (
    <ul>
      {list.map((n) => {
        const hasChildren = n.children.length > 0;
        const isOpen = open.has(n.id);
        return (
          <li key={n.id}>
            <div
              className="flex items-start gap-1 rounded-md py-2 pr-2 hover:bg-muted"
              style={{ paddingLeft: 12 + depth * 16 }}
            >
              <button
                type="button"
                onClick={() => hasChildren && toggle(n.id)}
                aria-label={hasChildren ? (isOpen ? "Thu gọn" : "Mở rộng") : undefined}
                aria-expanded={hasChildren ? isOpen : undefined}
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded text-ink-soft",
                  hasChildren ? "hover:bg-line" : "invisible",
                )}
              >
                <ChevronRight className={cn("size-4 transition-transform", isOpen && "rotate-90")} />
              </button>
              <button
                type="button"
                disabled={n.count === 0 || pendingId !== null}
                onClick={() => onPick(n)}
                title={n.count > 0 ? "Bấm để thêm ngẫu nhiên 1 câu" : "Mục này chưa có câu hỏi"}
                className="flex-1 text-left text-[15px] leading-snug text-ink enabled:hover:text-brand-700 disabled:cursor-default"
              >
                {n.title} <span className="text-ink-soft">({n.count})</span>
                {pendingId === n.id && <LoaderCircle className="ml-1.5 inline size-3.5 animate-spin text-brand-600" />}
              </button>
            </div>
            {hasChildren && isOpen && render(n.children, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  return render(nodes, 0);
}
