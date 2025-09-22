import React from "react";
import { cn } from "../utils/classNames";

const BASE_CLASS =
  "bg-bg-000 border border-border-300 hover:border-border-200 transition-colors placeholder:text-text-500 text-text-100 can-focus disabled:cursor-not-allowed disabled:opacity-50 font-base";

const SIZE_CLASSNAMES = {
  default: "h-9 px-3 py-2 rounded-lg",
  sm: "h-8 rounded-md px-3 font-small",
  lg: "h-11 px-3 rounded-[0.6rem]",
} as const;

const ERROR_CLASS =
  "!border-danger-000 hover:!border-danger-000 focus:!border-danger-000";

export type InputSize = keyof typeof SIZE_CLASSNAMES;

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "onChange"> {
  label?: string;
  secondaryLabel?: React.ReactNode;
  size?: InputSize;
  error?: string | boolean;
  prepend?: React.ReactNode;
  append?: React.ReactNode;
  fullWidth?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onValueChange?: (value: string) => void;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      secondaryLabel,
      size = "default",
      error,
      prepend,
      append,
      fullWidth = true,
      className,
      onChange,
      onValueChange,
      id,
      ...props
    },
    forwardedRef
  ) => {
    const fallbackIdRef = React.useRef(
      `input-${Math.random().toString(36).slice(2, 11)}`
    );
    const inputId = id ?? fallbackIdRef.current;
    const internalRef = React.useRef<HTMLInputElement>(null);

    const assignRef = (node: HTMLInputElement | null) => {
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
      }
      internalRef.current = node;
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event);
      onValueChange?.(event.target.value);
    };

    const composedClassName = cn(
      BASE_CLASS,
      SIZE_CLASSNAMES[size],
      error && ERROR_CLASS,
      className
    );

    const shouldWrap = prepend || append;

    return (
      <div className={fullWidth ? "w-full" : "w-auto"}>
        {label && (
          <label
            htmlFor={inputId}
            className="block font-base-sm text-text-200 mb-1"
          >
            {label}
          </label>
        )}

        {shouldWrap ? (
          <div
            className={cn(
              composedClassName,
              "inline-flex cursor-text items-stretch gap-2 can-focus-within",
              fullWidth && "w-full"
            )}
            onClick={() => internalRef.current?.focus()}
          >
            {prepend && <div className="flex items-center">{prepend}</div>}
            <input
              ref={assignRef}
              id={inputId}
              className="w-full placeholder:text-text-500 text-text-100 m-0 bg-transparent p-0 hide-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
              onChange={handleChange}
              {...props}
            />
            {append && (
              <div
                className={cn(
                  "flex items-center",
                  size === "default" && "-mr-2",
                  size === "sm" && "-mr-2",
                  size === "lg" && "-mr-1.5"
                )}
              >
                {append}
              </div>
            )}
          </div>
        ) : (
          <input
            ref={assignRef}
            id={inputId}
            className={composedClassName}
            onChange={handleChange}
            {...props}
          />
        )}

        {typeof error === "string" && error.length > 0 && (
          <p className="mt-1 text-sm text-danger-000">{error}</p>
        )}

        {secondaryLabel && (
          <div className="text-text-400 mt-1 text-sm">{secondaryLabel}</div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
