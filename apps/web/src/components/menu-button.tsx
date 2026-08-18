export function MenuButton({ isOpen, onClick, trigger }: { isOpen: boolean; onClick: () => void; trigger: React.RefObject<HTMLButtonElement | null> }): React.JSX.Element {
  return <button className="menu-button" type="button" ref={trigger} onClick={onClick} aria-label="Mở điều hướng quản trị" aria-expanded={isOpen} aria-controls="mobile-navigation-dialog"><span aria-hidden="true">☰</span></button>;
}
