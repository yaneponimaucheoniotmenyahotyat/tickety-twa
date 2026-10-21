import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const CLOSE_MS = 280;
const DRAG_CLOSE_PX = 110;

// Базовая шторка (фильтры, успех оплаты).
// Скролл только в .sheet-scroll: touch-action: pan-y + overscroll-behavior: contain,
// плюс tg.disableVerticalSwipes() в initTelegram — свайп не закрывает Mini App.
// Закрытие жестом — только за ручку/шапку (touch-action: none), чтобы не спорить со скроллом.
export default function BottomSheet({ open, onClose, header, children, footer }) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      setDragY(0);
      return;
    }
    setClosing(true);
    const t = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, CLOSE_MS);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // фон не скроллится под шторкой
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  if (!mounted) return null;

  const dragging = dragStart.current !== null;
  const onPointerDown = (e) => {
    dragStart.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (dragStart.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStart.current));
  };
  const onPointerUp = () => {
    dragStart.current = null;
    if (dragY > DRAG_CLOSE_PX) onClose();
    else setDragY(0);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        aria-label="Закрыть"
        className={`absolute inset-0 animate-fade-in bg-black/40 transition-opacity duration-300 ${
          closing ? 'opacity-0' : ''
        }`}
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        className={`relative flex max-h-[92vh] animate-sheet-in flex-col rounded-t-4xl bg-bg shadow-sheet ${
          dragging ? '' : 'transition-transform duration-300 ease-ios'
        }`}
        style={{ transform: closing ? 'translateY(100%)' : `translateY(${dragY}px)` }}
      >
        <div
          className="shrink-0 cursor-grab touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="flex justify-center pb-1 pt-2">
            <span className="h-1.5 w-9 rounded-chip bg-label-tertiary/40" />
          </div>
          {header && <div className="px-gutter pb-3">{header}</div>}
        </div>
        <div className="sheet-scroll min-h-0 flex-1 px-gutter pb-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-separator bg-bg px-gutter pb-[calc(12px+var(--app-safe-bottom))] pt-3">
            {footer}
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}
