"use client";

import { useId, useState } from "react";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 text-[var(--muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

type Props = {
  title: string;
  defaultOpen?: boolean;
  /** Gecontroleerde modus (bv. “Open alle tools” vanaf de actiebalk). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  /** Compacte preview wanneer dicht (max ~2 regels). */
  preview?: string;
  className?: string;
};

export function CollapsibleSection({
  title,
  defaultOpen = false,
  open: openControlled,
  onOpenChange,
  children,
  preview,
  className = "",
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = openControlled !== undefined;
  const open = isControlled ? openControlled : uncontrolledOpen;

  const setOpen = (v: boolean) => {
    if (!isControlled) setUncontrolledOpen(v);
    onOpenChange?.(v);
  };

  const id = useId();
  const panelId = `${id}-panel`;

  return (
    <div
      className={`overflow-hidden rounded-xl border border-gray-200 bg-[var(--card-bg)] shadow-sm dark:border-[var(--card-border)] ${className}`}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[var(--card-bg-hover)]"
      >
        <span className="text-sm font-medium text-[var(--text)]">{title}</span>
        <Chevron open={open} />
      </button>
      {!open && preview ? (
        <p className="line-clamp-2 border-t border-gray-100 px-4 pb-3 pt-0 text-xs leading-relaxed text-[var(--muted)] dark:border-[var(--border)]">
          {preview}
        </p>
      ) : null}
      <div
        id={panelId}
        role="region"
        aria-label={title}
        hidden={!open}
        className={open ? "border-t border-gray-100 dark:border-[var(--border)]" : ""}
      >
        {open ? <div className="px-4 py-3 text-sm leading-relaxed text-[var(--muted)]">{children}</div> : null}
      </div>
    </div>
  );
}
