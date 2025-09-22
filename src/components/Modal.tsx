import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import { cn } from "../utils/classNames";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

if (typeof document !== "undefined" && !document.getElementById("options-modal-keyframes")) {
  const style = document.createElement("style");
  style.id = "options-modal-keyframes";
  style.textContent = `@keyframes zoom {from {opacity: 0; transform: scale(0.95);} to {opacity: 1; transform: scale(1);}}@keyframes fade {from {opacity: 0;} to {opacity: 1;}}`;
  document.head.appendChild(style);
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  modalSize?: ModalSize;
  hasCloseButton?: boolean;
  closeOnEscapeKeydown?: boolean;
  closeOnClickOutside?: boolean;
  className?: string;
  fullWidth?: boolean;
  fullHeight?: boolean;
}

/**
 * 弹窗组件（重构前变量名: Se）
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  modalSize = "md",
  hasCloseButton = true,
  closeOnEscapeKeydown = true,
  closeOnClickOutside = true,
  className,
  fullWidth = true,
  fullHeight = false,
}: ModalProps) {
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      lastFocusedRef.current = document.activeElement as HTMLElement | null;
    } else {
      const timer = setTimeout(() => {
        setVisible(false);
        const fallback = lastFocusedRef.current;
        fallback?.focus?.();
        lastFocusedRef.current = null;
      }, 125);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !closeOnEscapeKeydown) return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [isOpen, onClose, closeOnEscapeKeydown]);

  useEffect(() => {
    if (!isOpen || !closeOnClickOutside) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", handleMouseDown);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isOpen, onClose, closeOnClickOutside]);

  if (!visible) return null;

  const sizeClass =
    {
      sm: "max-w-sm",
      md: "max-w-md",
      lg: "max-w-lg",
      xl: "max-w-3xl",
      "2xl": "max-w-5xl",
      "3xl": "max-w-6xl",
    }[modalSize] || "max-w-md";

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 grid items-center justify-items-center overflow-y-auto p-4 md:p-10",
        isOpen ? "animate-[fade_250ms_ease-in_forwards]" : "animate-[fade_125ms_ease-out_reverse_forwards]"
      )}
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)", backdropFilter: "brightness(0.75)" }}
    >
      <div
        ref={containerRef}
        className={cn(
          "flex flex-col focus:outline-none relative text-text-100 text-left shadow-xl",
          "border-[0.5px] border-border-300 rounded-2xl p-4 md:p-6 bg-bg-000 min-w-0",
          sizeClass,
          fullWidth && "w-full",
          fullHeight && "h-full",
          isOpen ? "animate-[zoom_250ms_ease-in_forwards]" : "animate-[zoom_125ms_ease-out_reverse_forwards]",
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        {(title || hasCloseButton) && (
          <div className={cn("flex items-center gap-4", title ? "justify-between" : "justify-end")}
          >
            {title && (
              <h2 className="font-xl-bold text-text-100 flex w-full min-w-0 items-center leading-6 break-words">
                <span className="[overflow-wrap:anywhere]">{title}</span>
              </h2>
            )}
            {hasCloseButton && (
              <Button
                size="icon_sm"
                variant="ghost"
                className="!text-text-500 hover:!text-text-400 -mx-2"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={16} />
              </Button>
            )}
          </div>
        )}
        {subtitle && <p className="text-text-300 mb-2 text-sm">{subtitle}</p>}
        <div className={cn("min-h-full", (title || subtitle) && "mt-4", fullHeight && "flex-1")}>{children}</div>
      </div>
    </div>
  );
}

interface ModalFooterProps {
  children: React.ReactNode;
  layout?: "left" | "center" | "right" | "between";
  className?: string;
}

export function ModalFooter({ children, layout = "right", className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        "mt-4 flex flex-col gap-2",
        layout === "left" && "sm:flex-row",
        layout === "center" && "justify-center sm:flex-row",
        layout === "right" && "sm:flex-row justify-end",
        layout === "between" && "justify-between sm:flex-row",
        className
      )}
    >
      {children}
    </div>
  );
}
