// 原始函数: Vy

import React, { useRef, useEffect } from "react";
import { TypingIndicatorSvg } from "../../../components/icons";

/**
 * An animated typing indicator.
 * @original Vy
 */
export function TypingIndicator() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animation: Animation | undefined;
    if (ref.current && typeof ref.current.animate === "function") {
      const dotCount = 9; // Based on the SVG
      const frameDuration = 90; // ms
      const keyframes = Array.from({ length: dotCount }, (_, i) => ({
        transform: `translateY(-${i * (100 / dotCount)}%)`,
      }));

      animation = ref.current.animate(keyframes, {
        duration: frameDuration * keyframes.length,
        iterations: Infinity,
        easing: `steps(${keyframes.length}, jump-none)`,
      });
    }
    return () => {
      animation?.cancel();
    };
  }, []);

  return (
    <div
      className="inline-block w-8 select-none overflow-hidden"
      style={{ aspectRatio: 1, color: "var(--color-accent-brand)" }}
    >
      <div
        ref={ref}
        className="[&>svg]:block [&>svg]:w-full [&>svg]:fill-current"
      >
        <TypingIndicatorSvg />
      </div>
    </div>
  );
}