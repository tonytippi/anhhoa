import { Menu } from "@base-ui/react/menu";
import { ReactNode, useRef } from "react";

export function AnchoredActionMenu({
  label,
  disabled = false,
  onTriggerOpen,
  children,
}: {
  label: string;
  disabled?: boolean;
  onTriggerOpen?: (trigger: HTMLButtonElement) => void;
  children: ReactNode;
}) {
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <Menu.Root
      modal={false}
      onOpenChange={(open) => {
        if (open && trigger.current) onTriggerOpen?.(trigger.current);
      }}
    >
      <Menu.Trigger ref={trigger} type="button" disabled={disabled} aria-label={label}>
        ...
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          side="bottom"
          align="end"
          sideOffset={6}
          positionMethod="fixed"
          collisionPadding={8}
          collisionAvoidance={{ side: "flip", align: "shift", fallbackAxisSide: "none" }}
          className="finance-anchored-action-menu-positioner"
        >
          <Menu.Popup className="finance-anchored-action-menu">{children}</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function AnchoredActionMenuItem({
  children,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Menu.Item className="finance-anchored-action-menu-item" disabled={disabled} onClick={onClick}>
      {children}
    </Menu.Item>
  );
}
