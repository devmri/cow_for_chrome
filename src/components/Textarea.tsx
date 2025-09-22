import React from "react";
import { cn } from "../utils/classNames";

const BASE_CLASS =
  "bg-bg-000 border border-border-300 p-3 leading-5 rounded-[0.6rem] transition-colors hover:border-border-200 read-only:hover:border-border-300 placeholder:text-text-500 text-text-100 can-focus disabled:cursor-not-allowed disabled:opacity-50 read-only:opacity-50 whitespace-pre-wrap resize-none font-base";

const ERROR_CLASS =
  "!border-danger-000 hover:!border-danger-000 focus:!border-danger-000";

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  label?: string;
  error?: string | boolean;
  fullWidth?: boolean;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  onValueChange?: (value: string) => void;
  minRows?: number;
}

// 原组件名: wS
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      fullWidth = true,
      className,
      onChange,
      onValueChange,
      rows,
      minRows,
      value,
      id,
      ...props
    },
    ref
  ) => {
    const fallbackIdRef = React.useRef(
      `textarea-${Math.random().toString(36).slice(2, 11)}`
    );
    const textareaId = id ?? fallbackIdRef.current;

    const appliedRows = (minRows ?? rows) || undefined;
    const shouldAutoSize = rows === undefined;

    const composedClassName = cn(BASE_CLASS, error && ERROR_CLASS, className);

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(event);
      onValueChange?.(event.target.value);
    };

    const ghostContent =
      typeof value === "string" ? value : Array.isArray(value) ? value.join("\n") : value ?? "";

    return (
      <div className={cn("group relative", fullWidth && "w-full")}>
        {label && (
          <label
            htmlFor={textareaId}
            className="block font-base-sm text-text-200 mb-1"
          >
            {label}
          </label>
        )}
        <div className="grid">
          {shouldAutoSize && (
            <div
              aria-hidden="true"
              className={cn(
                composedClassName,
                "pointer-events-none invisible row-start-1 row-end-2 col-start-1 col-end-2"
              )}
            >
              {ghostContent}
              {" "}
            </div>
          )}
          <textarea
            ref={ref}
            id={textareaId}
            className={cn(
              composedClassName,
              "row-start-1 row-end-2 col-start-1 col-end-2"
            )}
            rows={appliedRows}
            value={value}
            onChange={handleChange}
            data-1p-ignore
            {...props}
          />
        </div>
        {typeof error === "string" && error.length > 0 && (
          <p className="mt-1 text-sm text-danger-000">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
