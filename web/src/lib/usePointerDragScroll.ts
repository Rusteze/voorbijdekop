"use client";

import { type RefObject, useEffect, useRef } from "react";

const DRAG_THRESHOLD_PX = 4;

/**
 * Horizontaal slepen met de muis (klik vasthouden) in een overflow-x container.
 * Touch blijft normaal scrollen + snap; alleen pointerType "mouse".
 */
export function usePointerDragScroll(ref: RefObject<HTMLElement | null>) {
  const state = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startScroll: 0,
    moved: false
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onPointerMove = (e: PointerEvent) => {
      const s = state.current;
      if (!s.active || e.pointerId !== s.pointerId || e.pointerType !== "mouse") return;
      const dx = e.clientX - s.startX;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX) {
        s.moved = true;
        el.style.cursor = "grabbing";
        el.scrollLeft = s.startScroll - dx;
      }
    };

    const endDrag = (e: PointerEvent) => {
      const s = state.current;
      if (!s.active || e.pointerId !== s.pointerId) return;
      s.active = false;
      el.style.cursor = "";
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);

      if (s.moved) {
        const blockClick = (ev: MouseEvent) => {
          ev.preventDefault();
          ev.stopImmediatePropagation();
        };
        document.addEventListener("click", blockClick, { capture: true, once: true });
      }
      s.moved = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if (el.scrollWidth <= el.clientWidth + 1) return;

      state.current = {
        active: true,
        pointerId: e.pointerId,
        startX: e.clientX,
        startScroll: el.scrollLeft,
        moved: false
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    };

    el.addEventListener("pointerdown", onPointerDown);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [ref]);
}
