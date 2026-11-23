/**
 * R10-02: shared popover placement — prefer below + left-aligned;
 * flip above when no room below; shift left when no room on the right;
 * clamp into the viewport with a max-height for inner scroll.
 */
export type PopoverPlace = {
  top: number;
  left: number;
  minWidth: number;
  maxHeight: number;
};

export function placePopover(opts: {
  trigger: DOMRect;
  popWidth: number;
  popHeight: number;
  viewportW?: number;
  viewportH?: number;
  gap?: number;
  pad?: number;
}): PopoverPlace {
  const gap = opts.gap ?? 4;
  const pad = opts.pad ?? 8;
  const vw = opts.viewportW ?? (typeof window !== "undefined" ? window.innerWidth : 1280);
  const vh = opts.viewportH ?? (typeof window !== "undefined" ? window.innerHeight : 900);
  const minWidth = Math.max(opts.trigger.width, opts.popWidth, 140);
  const maxHeight = Math.max(120, Math.min(opts.popHeight || 224, vh - pad * 2));

  let top = opts.trigger.bottom + gap;
  if (top + maxHeight > vh - pad) {
    const above = opts.trigger.top - gap - maxHeight;
    if (above >= pad) top = above;
    else top = Math.max(pad, vh - pad - maxHeight);
  }

  let left = opts.trigger.left;
  if (left + minWidth > vw - pad) {
    left = Math.max(pad, vw - pad - minWidth);
  }
  if (left < pad) left = pad;

  return { top, left, minWidth, maxHeight };
}
