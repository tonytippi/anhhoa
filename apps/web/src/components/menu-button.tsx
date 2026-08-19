export function MenuButton({ isDesktop, isOpen, onClick, trigger }: { isDesktop: boolean; isOpen: boolean; onClick: () => void; trigger: React.RefObject<HTMLButtonElement | null> }): React.JSX.Element {
  return <button className="menu-button" type="button" ref={trigger} onClick={onClick} aria-label="Mở điều hướng quản trị" aria-expanded={isOpen} aria-controls={isOpen ? 'mobile-navigation-dialog' : undefined} tabIndex={isDesktop ? -1 : undefined}><span aria-hidden="true">☰</span></button>;
}
