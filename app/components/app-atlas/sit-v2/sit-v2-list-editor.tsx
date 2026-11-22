"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type DragEvent,
} from "react";
import { TbGripVertical } from "react-icons/tb";

export type ListEditorKind = "steps" | "bullets";

/** Parse stored cell text into editor items. */
export function parseListItems(raw: string, kind: ListEditorKind): string[] {
  const text = (raw || "").replace(/\r\n/g, "\n").trim();
  if (!text) return [""];
  if (kind === "steps") {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [""];
    return lines.map((l) => l.replace(/^\d+[.)]\s*/, "").replace(/^[-*•]\s*/, ""));
  }
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [""];
  return lines.map((l) => l.replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, ""));
}

/** Serialize editor items back to stored format. */
export function serializeListItems(items: string[], kind: ListEditorKind): string {
  const cleaned = items.map((i) => i.replace(/\s+$/g, "")).filter((i) => i.trim().length > 0);
  if (!cleaned.length) return "";
  if (kind === "steps") {
    return cleaned.map((t, i) => `${i + 1}. ${t}`).join("\n");
  }
  return cleaned.map((t) => (t.startsWith("- ") ? t : `- ${t}`)).join("\n");
}

export function SitV2ListEditor({
  kind,
  initialValue,
  placeholders = [],
  onSave,
  onCancel,
}: {
  kind: ListEditorKind;
  initialValue: string;
  placeholders?: string[];
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [items, setItems] = useState(() => parseListItems(initialValue, kind));
  const [focusIdx, setFocusIdx] = useState(0);
  const [acQuery, setAcQuery] = useState<{ idx: number; start: number; q: string } | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    inputRefs.current[focusIdx]?.focus();
  }, [focusIdx]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onSaveRef.current(serializeListItems(itemsRef.current, kind));
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [kind]);

  const suggestions = useMemo(() => {
    if (!acQuery) return [];
    const q = acQuery.q.toLowerCase();
    return placeholders.filter((p) => !q || p.toLowerCase().includes(q)).slice(0, 8);
  }, [acQuery, placeholders]);

  const updateItem = (idx: number, value: string, caret?: number) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
    if (caret != null) {
      const before = value.slice(0, caret);
      const m = before.match(/\{\{([a-zA-Z0-9_]*)$/);
      if (m) {
        setAcQuery({ idx, start: caret - m[0].length, q: m[1] || "" });
      } else {
        setAcQuery(null);
      }
    }
  };

  const insertPlaceholder = (ph: string) => {
    if (!acQuery) return;
    const { idx, start } = acQuery;
    const cur = items[idx] || "";
    const el = inputRefs.current[idx];
    const caret = el?.selectionStart ?? cur.length;
    const next = `${cur.slice(0, start)}{{${ph}}}${cur.slice(caret)}`;
    updateItem(idx, next);
    setAcQuery(null);
    requestAnimationFrame(() => {
      const pos = start + ph.length + 4;
      el?.setSelectionRange(pos, pos);
      el?.focus();
    });
  };

  const onKeyDown = (idx: number, e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (acQuery) {
        setAcQuery(null);
        return;
      }
      onCancel();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onSave(serializeListItems(items, kind));
      return;
    }
    if (acQuery && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") && suggestions.length) {
      if (e.key === "Enter") {
        e.preventDefault();
        insertPlaceholder(suggestions[0]!);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      setItems((prev) => {
        const next = [...prev];
        next.splice(idx + 1, 0, "");
        return next;
      });
      setFocusIdx(idx + 1);
      setAcQuery(null);
      return;
    }
    if (e.key === "Backspace") {
      const el = e.currentTarget;
      if (el.selectionStart === 0 && el.selectionEnd === 0 && !(items[idx] || "").length) {
        e.preventDefault();
        if (items.length <= 1) return;
        setItems((prev) => prev.filter((_, i) => i !== idx));
        setFocusIdx(Math.max(0, idx - 1));
      }
    }
  };

  const onDragStart = (idx: number) => setDragFrom(idx);
  const onDrop = (idx: number) => {
    if (dragFrom == null || dragFrom === idx) {
      setDragFrom(null);
      return;
    }
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragFrom, 1);
      next.splice(idx, 0, moved!);
      return next;
    });
    setDragFrom(null);
    setFocusIdx(idx);
  };

  return (
    <div
      ref={panelRef}
      className="relative z-10 min-w-[240px] rounded-[8px] border border-[#8664F2] bg-white p-2 shadow-lg dark:bg-[#141414]"
      data-testid="sit-list-editor"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <div className="mb-1 flex items-center justify-between text-[12px] leading-snug text-[#6b7280]">
        <span>
          {kind === "steps"
            ? "Shift+Enter ,  line break · Ctrl+Enter ,  save · Esc ,  cancel"
            : "Enter ,  next item · Esc ,  cancel"}
        </span>
        <span>Ctrl+Enter save · Esc cancel</span>
      </div>
      <ul className="space-y-1">
        {items.map((item, idx) => (
          <li
            key={idx}
            className="flex items-start gap-1"
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragOver={(e: DragEvent) => e.preventDefault()}
            onDrop={() => onDrop(idx)}
          >
            <button
              type="button"
              className="mt-1 cursor-grab text-[#9ca3af] hover:text-[#6b7280]"
              title="Drag to reorder"
              tabIndex={-1}
              aria-label="Drag handle"
            >
              <TbGripVertical size={14} />
            </button>
            <span className="mt-1 w-5 shrink-0 text-right font-mono text-[11px] text-[#6b7280]">
              {kind === "steps" ? `${idx + 1}.` : "•"}
            </span>
            <textarea
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              rows={Math.min(4, Math.max(1, item.split("\n").length))}
              className="min-h-[28px] flex-1 resize-y rounded border border-[#e2e6ef] bg-white px-1.5 py-1 text-[12px] font-[inherit] outline-none focus:border-[#8664F2] dark:border-[#2a2a2a] dark:bg-[#101010]"
              value={item}
              onChange={(e) => updateItem(idx, e.target.value, e.target.selectionStart ?? undefined)}
              onKeyDown={(e) => onKeyDown(idx, e)}
              onClick={(e) => {
                const t = e.currentTarget;
                updateItem(idx, t.value, t.selectionStart ?? undefined);
              }}
              data-testid={`sit-list-item-${idx}`}
            />
          </li>
        ))}
      </ul>
      {acQuery && suggestions.length > 0 && (
        <div
          className="absolute left-8 z-20 mt-1 max-h-40 w-48 overflow-auto rounded-[6px] border border-[#e2e6ef] bg-white py-1 text-[11px] shadow-md dark:border-[#2a2a2a] dark:bg-[#151515]"
          data-testid="sit-placeholder-ac"
        >
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="block w-full px-2 py-1 text-left font-mono hover:bg-[#f3f0ff]"
              onMouseDown={(e) => {
                e.preventDefault();
                insertPlaceholder(s);
              }}
            >
              {`{{${s}}}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
