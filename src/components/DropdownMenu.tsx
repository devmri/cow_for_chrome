import React from "react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { MoreVertical } from "lucide-react";
import { cn } from "../utils/classNames";

interface DropdownMenuProps {
  trigger?: React.ReactNode;
  children: React.ReactNode;
  matchTriggerWidth?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  unstyledTrigger?: boolean;
}

export function DropdownMenu({
  trigger,
  children,
  matchTriggerWidth = false,
  open,
  onOpenChange,
  className,
  unstyledTrigger = false,
}: DropdownMenuProps) {
  const triggerNode = trigger ? (
    unstyledTrigger ? (
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
    ) : (
      <DropdownTriggerWrapper>{trigger}</DropdownTriggerWrapper>
    )
  ) : (
    <DropdownTriggerWrapper />
  );

  return (
    <Dropdown.Root open={open} onOpenChange={onOpenChange}>
      {triggerNode}
      <Dropdown.Portal>
        <Dropdown.Content
          sideOffset={4}
          style={matchTriggerWidth ? { width: "var(--radix-dropdown-menu-trigger-width)" } : undefined}
          className={cn(
            "z-50 bg-bg-000 border-[0.5px] border-border-300 rounded-xl shadow-lg p-1.5 min-w-40",
            "animate-in fade-in-0 zoom-in-95",
            className
          )}
        >
          {children}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

function DropdownTriggerWrapper({ children }: { children?: React.ReactNode }) {
  return (
    <Dropdown.Trigger asChild>
      <button
        type="button"
        className="opacity-0 group-hover:opacity-100 p-1 text-text-300 hover:bg-bg-100 rounded transition-all"
      >
        {children ?? <MoreVertical size={16} />}
      </button>
    </Dropdown.Trigger>
  );
}

interface DropdownMenuItemProps extends Dropdown.DropdownMenuItemProps {
  icon?: React.ReactNode;
  danger?: boolean;
  className?: string;
}

export const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({ children, icon, danger, disabled, className, ...props }, ref) => (
    <Dropdown.Item
      ref={ref}
      disabled={disabled}
      className={cn(
        "font-base py-1.5 px-2 rounded-lg cursor-pointer select-none",
        "whitespace-nowrap overflow-hidden text-ellipsis text-sm outline-none",
        "data-[highlighted]:bg-bg-200 data-[highlighted]:text-text-000",
        "text-text-300",
        danger && "!text-danger-000 data-[highlighted]:bg-danger-900",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2 py-0.5">
        {icon}
        <span>{children}</span>
      </div>
    </Dropdown.Item>
  )
);

DropdownMenuItem.displayName = "DropdownMenuItem";

export function DropdownMenuSeparator() {
  return <Dropdown.Separator className="h-px bg-border-200 my-1" />;
}
