import { useEffect, useRef } from 'react';
import { Sidebar } from './sidebar';

const focusableSelector = 'a[href], button:not([disabled])';

export function NavigationSheet({ onClose, trigger }: { onClose: () => void; trigger: React.RefObject<HTMLButtonElement | null> }): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const triggerButton = trigger.current;
    dialog?.querySelector<HTMLElement>(focusableSelector)?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); triggerButton?.focus(); };
  }, [onClose, trigger]);

  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="sidebar-sheet" id="mobile-navigation-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-label="Điều hướng quản trị"><Sidebar onNavigate={onClose} /><button type="button" className="sheet-close" onClick={onClose} aria-label="Đóng điều hướng">×</button></div></div>;
}
