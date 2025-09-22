import React from "react";
import { cn } from "../utils/classNames";

const VARIANT_CLASSNAMES = {
  primary:
    "bg-text-000 text-bg-000 font-base-bold relative overflow-hidden transition-transform will-change-transform ease-[cubic-bezier(0.165,0.85,0.45,1)] duration-150 hover:scale-y-[1.015] hover:scale-x-[1.005] backface-hidden after:absolute after:inset-0 after:bg-[radial-gradient(at_bottom,hsla(var(--bg-000)/20%),hsla(var(--bg-000)/0%))] after:opacity-0 after:transition after:duration-200 after:translate-y-2 hover:after:opacity-100 hover:after:translate-y-0",
  secondary:
    "text-text-000 font-base-bold border-[0.5px] border-border-200 relative overflow-hidden transition duration-100 hover:border-border-300/0 bg-bg-300/0 hover:bg-bg-400 backface-hidden",
  ghost:
    "text-text-300 border-transparent transition font-base tracking-tight duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)] hover:bg-bg-300 aria-checked:bg-bg-400 aria-expanded:bg-bg-400 hover:text-text-100 aria-pressed:text-text-100 aria-checked:text-text-100 aria-expanded:text-text-100",
  danger:
    "bg-danger-200 text-oncolor-100 font-base-bold transition hover:scale-y-[1.015] hover:scale-x-[1.005] hover:opacity-95",
  flat: "bg-accent-main-000 text-oncolor-100 font-base-bold transition-colors hover:bg-accent-main-200",
  unstyled: "",
} as const;

const SIZE_CLASSNAMES = {
  default: "h-9 px-4 py-2 rounded-lg min-w-[5rem] active:scale-[0.985] whitespace-nowrap",
  sm: "h-8 rounded-md px-3 min-w-[4rem] active:scale-[0.985] whitespace-nowrap font-default-bold",
  lg: "h-11 rounded-[0.6rem] px-5 min-w-[6rem] active:scale-[0.985] whitespace-nowrap text-base",
  icon: "h-9 w-9 rounded-md active:scale-95 shrink-0",
  icon_sm: "h-8 w-8 rounded-md active:scale-95",
  icon_lg: "h-11 w-11 rounded-[0.6rem] active:scale-95",
} as const;

export type ButtonVariant = keyof typeof VARIANT_CLASSNAMES;
export type ButtonSize = keyof typeof SIZE_CLASSNAMES;

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  prepend?: React.ReactNode;
  append?: React.ReactNode;
  fullWidth?: boolean;
  type?: "button" | "submit" | "reset";
}

// 原组件名: vS
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "default",
      loading = false,
      prepend,
      append,
      fullWidth = false,
      className,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref
  ) => {
    const paddingModifiers = cn({
      "pl-2 pr-3 gap-1": Boolean(prepend) && size === "default",
      "pl-2.5 pr-3.5 gap-1": Boolean(prepend) && size === "lg",
      "pl-2 pr-2.5 gap-1": Boolean(prepend) && size === "sm",
      "pl-3 pr-2 gap-1": Boolean(append) && size === "default",
      "pl-3.5 pr-2.5 gap-1": Boolean(append) && size === "lg",
      "pl-2.5 pr-2 gap-1": Boolean(append) && size === "sm",
    });

    const composedClassName = cn(
      "inline-flex items-center justify-center relative shrink-0 select-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none focus:outline-none",
      VARIANT_CLASSNAMES[variant],
      SIZE_CLASSNAMES[size],
      (prepend || append) && paddingModifiers,
      fullWidth && "w-full",
      loading && "text-transparent ![text-shadow:_none]",
      className
    );

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={composedClassName}
        {...props}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {prepend}
        {children}
        {append}
      </button>
    );
  }
);

Button.displayName = "Button";
