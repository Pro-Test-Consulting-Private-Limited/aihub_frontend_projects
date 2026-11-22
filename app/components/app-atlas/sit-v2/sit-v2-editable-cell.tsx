"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

export type CellCoord = { rowId: string; field: string };

type Props = {
  rowId: string;
  field: string;
  value: string;
  canEdit: boolean;
  selected: boolean;
  editing: boolean;
  multiline?: boolean;
  className?: string;
  display?: ReactNode;
  /** When set, used instead of the default input/textarea while editing. */
  renderEditor?: (api: {
    value: string;
    commit: (next: string) => void;
    cancel: () => void;
  }) => ReactNode;
  onSelect: (coord: CellCoord | null) => void;
  onStartEdit: (coord: CellCoord) => void;
  onCancelEdit: () => void;
  onCommit: (rowId: string, field: string, value: string) => void;
  onMove: (dir: "tab" | "shift-tab" | "up" | "down" | "left" | "right") => void;
};

export function SitV2EditableCell({
  rowId,
  field,
  value,
  canEdit,
  selected,
  editing,
  multiline,
  className,
  display,
  renderEditor,
  onSelect,
  onStartEdit,
  onCancelEdit,
  onCommit,
  onMove,
}: Props) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        if (inputRef.current && "select" in inputRef.current) {
          inputRef.current.select();
        }
      });
    }
  }, [editing, value]);

  const commit = () => {
    onCommit(rowId, field, draft);
  };

  const onKeyDownDisplay = (e: KeyboardEvent) => {
    if (!canEdit) return;
    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      onStartEdit({ rowId, field });
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      onMove(e.shiftKey ? "shift-tab" : "tab");
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onMove("up");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onMove("down");
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onMove("left");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onMove("right");
    }
  };

  const onKeyDownEdit = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setDraft(value);
      onCancelEdit();
      onSelect(null);
      return;
    }
    if (e.key === "Enter") {
      if (multiline && e.shiftKey) {
        return; // allow line break
      }
      e.preventDefault();
      commit();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      commit();
      onMove(e.shiftKey ? "shift-tab" : "tab");
    }
  };

  const editingShell =
    "px-1 py-1 align-top bg-[#f3f0ff]/60 ring-2 ring-inset ring-[#8664F2] dark:bg-[#1a1428]/40";

  if (editing && canEdit) {
    if (renderEditor) {
      return (
        <td
          className={`${editingShell} ${className || ""}`}
          data-sit-cell={`${rowId}:${field}`}
          data-selected="0"
          data-editing="1"
        >
          {renderEditor({
            value,
            commit: (next) => onCommit(rowId, field, next),
            cancel: onCancelEdit,
          })}
        </td>
      );
    }
    const shared =
      "w-full rounded border border-[#8664F2] bg-white p-1 text-[12px] font-[inherit] outline-none dark:bg-[#141414]";
    if (multiline) {
      return (
        <td
          className={`${editingShell} ${className || ""}`}
          data-sit-cell={`${rowId}:${field}`}
          data-selected="0"
          data-editing="1"
        >
          <textarea
            ref={inputRef as RefObject<HTMLTextAreaElement>}
            className={`${shared} min-h-[72px]`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDownEdit}
            onBlur={commit}
            data-testid={`sit-cell-editor-${field}`}
          />
        </td>
      );
    }
    return (
      <td
        className={`${editingShell} ${className || ""}`}
        data-sit-cell={`${rowId}:${field}`}
        data-selected="0"
        data-editing="1"
      >
        <input
          ref={inputRef as RefObject<HTMLInputElement>}
          className={shared}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDownEdit}
          onBlur={commit}
          data-testid={`sit-cell-editor-${field}`}
        />
      </td>
    );
  }

  return (
    <td
      className={`cursor-default px-2 py-2 align-top outline-none ${
        selected
          ? "bg-[#f3f0ff]/50 ring-1 ring-inset ring-[#8664F2]/50 dark:bg-[#1a1428]/30"
          : ""
      } ${className || ""}`}
      tabIndex={0}
      data-sit-cell={`${rowId}:${field}`}
      data-selected={selected ? "1" : "0"}
      data-editing="0"
      onClick={(e) => {
        e.stopPropagation();
        onSelect({ rowId, field });
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!canEdit) return;
        onStartEdit({ rowId, field });
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onCancelEdit();
          onSelect(null);
          (e.currentTarget as HTMLElement).blur();
          return;
        }
        onKeyDownDisplay(e);
      }}
      onFocus={() => onSelect({ rowId, field })}
    >
      {display ?? (
        <span className={`whitespace-pre-wrap ${value ? "" : "text-[#9ca3af]"}`}>
          {value || "Add value"}
        </span>
      )}
    </td>
  );
}
