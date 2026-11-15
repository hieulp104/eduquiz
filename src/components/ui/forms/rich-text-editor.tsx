"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Placeholder } from "@tiptap/extensions";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Highlighter,
  Italic,
  Maximize,
  Minimize,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Màu tô nổi bật — hiển thị dạng ô màu trong menu. */
const HIGHLIGHT_COLORS = [
  { label: "Vàng", value: "#fef08a" },
  { label: "Xanh lá", value: "#bbf7d0" },
  { label: "Xanh dương", value: "#bfdbfe" },
  { label: "Hồng", value: "#fbcfe8" },
  { label: "Cam", value: "#fed7aa" },
];

type Props = {
  /** HTML ban đầu (chỉ đọc lúc tạo editor). */
  defaultValue?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

/**
 * Trình soạn thảo văn bản (Tiptap). Trả HTML qua onChange — server PHẢI lọc lại
 * (homework.sanitize.ts) trước khi lưu, không tin HTML từ client.
 */
export function RichTextEditor({ defaultValue = "", onChange, placeholder, className }: Props) {
  const [fullscreen, setFullscreen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false, code: false, codeBlock: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: defaultValue,
    immediatelyRender: false, // tránh lệch HTML giữa server và client (SSR)
    editorProps: {
      attributes: { class: "rich-content min-h-full px-4 py-3 outline-none" },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Esc để thoát chế độ toàn màn hình.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFullscreen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-line bg-surface",
        fullscreen ? "fixed inset-4 z-50 shadow-2xl" : "h-[250px]",
        className,
      )}
    >
      <Toolbar editor={editor} fullscreen={fullscreen} onToggleFullscreen={() => setFullscreen((v) => !v)} />
      <EditorContent editor={editor} className="flex-1 overflow-y-auto text-ink [&>div]:h-full" />
    </div>
  );
}

function Toolbar({
  editor,
  fullscreen,
  onToggleFullscreen,
}: {
  editor: Editor | null;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            highlight: editor.isActive("highlight"),
            align: (["left", "center", "right", "justify"] as const).find((a) =>
              editor.isActive({ textAlign: a }),
            ),
          }
        : null,
  });

  const run = (fn: (e: Editor) => void) => () => editor && fn(editor);

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 py-2">
      <ToolButton icon={Bold} label="In đậm" active={state?.bold} onClick={run((e) => e.chain().focus().toggleBold().run())} />
      <ToolButton icon={Italic} label="In nghiêng" active={state?.italic} onClick={run((e) => e.chain().focus().toggleItalic().run())} />
      <HighlightMenu editor={editor} active={state?.highlight} />

      <span className="mx-2 h-5 w-px bg-line" aria-hidden />

      <ToolButton icon={AlignLeft} label="Căn trái" active={state?.align === "left"} onClick={run((e) => e.chain().focus().setTextAlign("left").run())} />
      <ToolButton icon={AlignCenter} label="Căn giữa" active={state?.align === "center"} onClick={run((e) => e.chain().focus().setTextAlign("center").run())} />
      <ToolButton icon={AlignRight} label="Căn phải" active={state?.align === "right"} onClick={run((e) => e.chain().focus().setTextAlign("right").run())} />
      <ToolButton icon={AlignJustify} label="Căn đều" active={state?.align === "justify"} onClick={run((e) => e.chain().focus().setTextAlign("justify").run())} />

      <span className="mx-2 h-5 w-px bg-line" aria-hidden />

      <ToolButton
        icon={fullscreen ? Minimize : Maximize}
        label={fullscreen ? "Thu nhỏ" : "Toàn màn hình"}
        onClick={onToggleFullscreen}
      />
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-ink transition-colors hover:bg-muted",
        active && "bg-brand-50 text-brand-700 dark:bg-muted dark:text-brand-300",
      )}
    >
      <Icon className="size-[18px]" strokeWidth={2.25} />
    </button>
  );
}

function HighlightMenu({ editor, active }: { editor: Editor | null; active?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="Tô màu nổi bật"
        aria-label="Tô màu nổi bật"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-8 items-center gap-0.5 rounded-md px-1.5 text-ink hover:bg-muted",
          active && "bg-brand-50 text-brand-700 dark:bg-muted dark:text-brand-300",
        )}
      >
        <Highlighter className="size-[18px]" strokeWidth={2.25} />
        <ChevronDown className="size-3.5 text-ink-soft" />
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 flex items-center gap-1.5 rounded-lg border border-line bg-surface p-2 shadow-lg">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              aria-label={`Tô màu ${c.label}`}
              onClick={() => {
                editor?.chain().focus().toggleHighlight({ color: c.value }).run();
                setOpen(false);
              }}
              className="size-6 rounded-full ring-1 ring-line hover:scale-110"
              style={{ backgroundColor: c.value }}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              editor?.chain().focus().unsetHighlight().run();
              setOpen(false);
            }}
            className="ml-1 rounded-md px-2 py-1 text-xs text-ink-soft hover:bg-muted"
          >
            Bỏ màu
          </button>
        </div>
      )}
    </div>
  );
}
