"use client";

// Small building blocks shared by the money screens.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "../icons";
import { NewChip } from "../NewChip";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-card p-5 ${className}`}>{children}</section>;
}

export function CardTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold">{children}</h2>
      {action}
    </div>
  );
}

/** Slides up from the bottom on phones (drag it down to close), centred on iPad. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const drag = useRef<{ id: number; startY: number; startTime: number; dy: number } | null>(null);

  // Closing by tap or swipe slides away first (200ms, the same as the exit in globals.css).
  const dismiss = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  // Phones and iPads: no jumping into the first field. Focusing it while the sheet is still sliding
  // up from below the screen makes iPhone scroll everything to reach it as the keyboard opens, so the
  // sheet opened scrolled down. You tap the field you want instead. (Runs after the field's autoFocus.)
  const [pageY] = useState(() => (typeof window === "undefined" ? 0 : window.scrollY));
  useLayoutEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const el = panel.current;
    if (el && document.activeElement instanceof HTMLElement && el.contains(document.activeElement)) document.activeElement.blur();
    if (el) el.scrollTop = 0;
    if (window.scrollY !== pageY) window.scrollTo(0, pageY);
  }, [pageY]);

  // Escape closes at once: keyboard actions never animate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Drag down by the top of the sheet (phones only). Upwards it barely moves, with growing resistance.
  function onPointerDown(e: React.PointerEvent) {
    if (drag.current || closing || window.matchMedia("(min-width: 768px)").matches) return; // one finger only
    if ((e.target as Element).closest("button")) return; // the close button stays a button
    drag.current = { id: e.pointerId, startY: e.clientY, startTime: performance.now(), dy: 0 };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (panel.current) panel.current.style.transition = "none";
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !panel.current) return;
    const raw = e.clientY - d.startY;
    d.dy = raw >= 0 ? raw : -Math.sqrt(-raw) * 2;
    panel.current.style.transform = `translateY(${d.dy}px)`;
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !panel.current) return;
    drag.current = null;
    const el = panel.current;
    const velocity = d.dy / Math.max(1, performance.now() - d.startTime); // px per ms
    // Hand back to the stylesheet: it snaps back, or slides away from where your finger left it.
    el.style.transition = "";
    el.style.transform = "";
    if (d.dy > el.offsetHeight * 0.3 || (d.dy > 10 && velocity > 0.11)) dismiss();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center" data-closing={closing || undefined}>
      <div className="sheet-backdrop absolute inset-0 bg-black/40" onClick={dismiss} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-panel pb-safe relative max-h-[92dvh] w-full overflow-y-auto overflow-x-hidden overscroll-contain rounded-t-3xl bg-card px-5 shadow-xl md:max-w-lg md:rounded-3xl md:pb-6"
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="sticky top-0 z-10 -mx-5 mb-2 touch-none bg-card px-5 pt-2 md:static md:touch-auto md:pt-5"
        >
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line md:hidden" aria-hidden />
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-lg font-bold">{title}</h2>
            <button type="button" onClick={dismiss} aria-label="Close" className="p-1 text-muted">
              <Icon.close className="size-6" />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 mt-5 text-sm font-semibold text-muted first:mt-0">{children}</p>;
}

export const inputClass =
  "w-full rounded-2xl border border-line bg-cream px-4 py-3.5 text-base outline-none focus:border-sage";

/** Euro amount field. Accepts "12,50" or "12.50". */
export function MoneyInput({
  value,
  onChange,
  placeholder = "0.00",
  autoFocus,
  label,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
  label?: string;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">€</span>
      <input
        inputMode="decimal"
        autoFocus={autoFocus}
        aria-label={label}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value.replace(",", "."));
          onChange(e.target.value.trim() === "" || !Number.isFinite(n) ? null : n);
        }}
        className={`${inputClass} pl-9`}
      />
    </div>
  );
}

/** Pass `onCreate` to add a "+ New" chip that makes a new option and selects it. */
export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  onCreate,
  createPlaceholder,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  onCreate?: (name: string) => T;
  createPlaceholder?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-full px-3.5 py-2 text-sm transition-[color,background-color,border-color,transform] ${
            value === o.id ? "bg-ink text-cream" : "bg-cream text-ink/80"
          }`}
        >
          {o.label}
        </button>
      ))}
      {onCreate && <NewChip onAdd={(name) => onChange(onCreate(name))} placeholder={createPlaceholder} />}
    </div>
  );
}

export function Bar({ value, max, color = "var(--color-sage)" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = max > 0 && value > max;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-line">
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%`, background: over ? "var(--color-peach)" : color }}
      />
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="mt-6 w-full rounded-2xl bg-sage-dark py-4 text-base font-bold text-white disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function DangerButton({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      className={`mt-3 w-full rounded-2xl py-3 text-sm font-semibold ${armed ? "bg-rose text-white" : "text-muted"}`}
    >
      {armed ? "Tap again to delete" : label}
    </button>
  );
}

export function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-9 shrink-0 place-items-center rounded-full bg-sage-dark text-white"
    >
      <Icon.plus className="size-5" />
    </button>
  );
}
