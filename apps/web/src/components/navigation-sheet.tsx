import { Dialog } from '@base-ui/react/dialog';
import { Sidebar } from './sidebar';
import type { Admin } from '../app/api/auth';

export function NavigationSheet({ admin, onClose }: { admin: Admin; onClose: () => void; trigger: React.RefObject<HTMLButtonElement | null> }): React.JSX.Element {
  return <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Backdrop className="sheet-backdrop" />
      <Dialog.Popup id="mobile-navigation-dialog" className="sidebar-sheet" aria-label="Điều hướng quản trị" initialFocus={() => document.querySelector<HTMLAnchorElement>('#mobile-navigation-dialog a')}>
        <Sidebar admin={admin} onNavigate={onClose} />
        <Dialog.Close className="sheet-close" aria-label="Đóng điều hướng">×</Dialog.Close>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
