import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Modal focus contract shared by dialogs and bottom sheets (components/
 * DIALOG.md, BOTTOM_SHEET.md): move focus inside on open, keep Tab cycling
 * inside, Escape dismisses, and focus returns to the invoking control on
 * close. `initialFocus` picks the element that receives focus first.
 */
export function useModalFocus(
  open: boolean,
  container: RefObject<HTMLElement>,
  onDismiss: () => void,
  initialFocus?: RefObject<HTMLElement>,
) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = () => [...(container.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    (initialFocus?.current ?? focusables()[0])?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismissRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!container.current?.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const keepInside = (e: FocusEvent) => {
      if (e.target instanceof Node && !container.current?.contains(e.target)) {
        (initialFocus?.current ?? focusables()[0])?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', keepInside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', keepInside);
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open, container, initialFocus]);
}
