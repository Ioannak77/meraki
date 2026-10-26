"use client";

// A list you reorder by dragging a handle (finger or mouse). While you drag, the row moves to
// the place under your finger; letting go saves the new order.

import { useRef, useState } from "react";

export type DragHandle = {
  onPointerDown: (e: React.PointerEvent) => void;
  "aria-label": string;
  className: string;
  style: React.CSSProperties;
};

export function DragList<T extends { id: string }>({
  items,
  onReorder,
  render,
  className = "",
  label,
}: {
  items: T[];
  onReorder: (ids: string[]) => void;
  render: (item: T, handle: DragHandle, dragging: boolean) => React.ReactNode;
  className?: string;
  label: (item: T) => string; // for the handle's screen-reader label
}) {
  const [order, setOrder] = useState<string[] | null>(null); // only while dragging
  const [dragId, setDragId] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());

  const ids = order ?? items.map((i) => i.id);
  const byId = new Map(items.map((i) => [i.id, i]));

  function start(id: string, e: React.PointerEvent) {
    e.preventDefault();
    try {
      // Keep getting the moves even when the finger leaves the handle.
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {}
    setDragId(id);
    setOrder(items.map((i) => i.id));
  }

  function move(e: React.PointerEvent) {
    if (!dragId || !order) return;
    // The row whose middle the finger has passed is where the dragged row goes.
    const y = e.clientY;
    let target = order.indexOf(dragId);
    order.forEach((id, i) => {
      const r = rows.current.get(id)?.getBoundingClientRect();
      if (!r || id === dragId) return;
      const mid = r.top + r.height / 2;
      if (i < order.indexOf(dragId) && y < mid) target = Math.min(target, i);
      if (i > order.indexOf(dragId) && y > mid) target = Math.max(target, i);
    });
    const from = order.indexOf(dragId);
    if (target !== from) {
      const next = [...order];
      next.splice(from, 1);
      next.splice(target, 0, dragId);
      setOrder(next);
    }
  }

  function end() {
    if (order && order.join() !== items.map((i) => i.id).join()) onReorder(order);
    setDragId(null);
    setOrder(null);
  }

  return (
    <ul className={className} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      {ids.map((id) => {
        const item = byId.get(id);
        if (!item) return null;
        const dragging = id === dragId;
        return (
          <li
            key={id}
            ref={(el) => {
              if (el) rows.current.set(id, el);
              else rows.current.delete(id);
            }}
            className={`transition-shadow ${dragging ? "relative z-10 rounded-2xl bg-card shadow-lg" : ""}`}
          >
            {render(
              item,
              {
                onPointerDown: (e) => start(id, e),
                "aria-label": `Drag to move ${label(item)}`,
                className: "shrink-0 cursor-grab touch-none select-none px-2 py-2 text-lg leading-none text-muted active:cursor-grabbing",
                style: { touchAction: "none" },
              },
              dragging,
            )}
          </li>
        );
      })}
    </ul>
  );
}
