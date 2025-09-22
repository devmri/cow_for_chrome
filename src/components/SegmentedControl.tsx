import React, { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../utils/classNames";

export interface SegmentedOption {
  key: string;
  label: React.ReactNode;
  ariaLabel?: string;
}

interface SegmentedControlProps {
  options: SegmentedOption[];
  value?: string;
  initialKey?: string;
  onSelect?: (key: string) => void;
  itemClassName?: string;
  testId?: string;
}

export function SegmentedControl({
  options,
  value,
  initialKey,
  onSelect,
  itemClassName,
  testId,
}: SegmentedControlProps) {
  const [selected, setSelected] = useState<string | undefined>(value ?? initialKey);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (value !== undefined) setSelected(value);
  }, [value]);

  useEffect(() => {
    const highlight = highlightRef.current;
    const mask = highlight?.parentElement;
    if (!highlight || !mask) return;

    const styles = window.getComputedStyle(mask);
    const paddingLeft = parseFloat(styles.paddingLeft);
    const borderRadius = parseFloat(styles.borderRadius);
    const insetRadius = Math.max(0, borderRadius - paddingLeft);
    const active = selected ? optionRefs.current.get(selected) : undefined;

    if (active) {
      const containerWidth = highlight.offsetWidth;
      if (containerWidth > 0) {
        const left = ((active.offsetLeft - paddingLeft) / containerWidth) * 100;
        const right = 100 - ((active.offsetLeft + active.offsetWidth - paddingLeft) / containerWidth) * 100;
        highlight.style.clipPath = `inset(0 ${right > 0 ? right : 0}% 0 ${left <= 100 ? left : 100}% round ${insetRadius}px)`;
        if (!hasAnimated) {
          requestAnimationFrame(() => setHasAnimated(true));
        }
      }
    } else {
      highlight.style.clipPath = `rect(0% ${2 * insetRadius}px 100% 0% round ${insetRadius}px)`;
    }
  }, [selected, hasAnimated, options]);

  const baseItemClass = useMemo(
    () =>
      cn(
        "flex items-center justify-center h-[28px] min-w-7 gap-1.5 px-3 rounded-lg cursor-pointer",
        "relative z-10 text-text-500 hover:text-text-300 transition-colors duration-[250ms]"
      ),
    []
  );

  const handleSelect = (key: string) => {
    setSelected(key);
    onSelect?.(key);
  };

  return (
    <div className="group/segmented-control relative inline-flex w-fit h-8 text-sm font-medium bg-bg-300 p-0.5 rounded-[.625rem]">
      {options.map((option) => (
        <button
          key={option.key}
          ref={(el) => {
            if (el) optionRefs.current.set(option.key, el);
            else optionRefs.current.delete(option.key);
          }}
          onClick={() => handleSelect(option.key)}
          className={cn(baseItemClass, selected === option.key && "!text-text-100", itemClassName)}
          aria-label={option.ariaLabel}
          data-testid={testId ? `${testId}-${option.key}` : undefined}
          type="button"
        >
          {option.label}
        </button>
      ))}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 p-0.5 rounded-[.625rem] transition-[opacity] duration-[250ms]",
          !selected && "opacity-0"
        )}
      >
        <div
          ref={highlightRef}
          className={cn("flex bg-bg-000", hasAnimated && "transition-[clip-path] duration-[250ms] ease")}
          style={{ clipPath: "rect(0% 0% 100% 0%)" }}
        >
          {options.map((option) => (
            <div key={option.key} className={cn(baseItemClass, "text-text-100", itemClassName)}>
              {option.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
