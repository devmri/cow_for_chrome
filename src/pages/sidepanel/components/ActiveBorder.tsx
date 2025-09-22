// 原始函数: ax 和 ix

import React, { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DashedBorderProps {
  strokeColor: string;
  strokeWidth?: number;
  dashLength?: number;
  gapLength?: number;
  borderRadius?: number;
}

/**
 * Renders an animated dashed border inside a container.
 * @original ix
 */
function DashedBorder({
  strokeColor,
  strokeWidth = 2,
  dashLength = 10,
  gapLength = 10,
  borderRadius = 16,
}: DashedBorderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const { width, height } = size;
  const rx = Math.min(borderRadius, Math.min(width, height) / 2);
  const perimeter = 2 * (width + height - 4 * rx) + 2 * Math.PI * rx;
  const dashPatternLength = dashLength + gapLength;
  const numDashes = Math.round(perimeter / dashPatternLength);
  const adjustedDashPatternLength = perimeter / numDashes;
  const adjustedDashLength = (dashLength / dashPatternLength) * adjustedDashPatternLength;
  const adjustedGapLength = adjustedDashPatternLength - adjustedDashLength;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 41 }}
    >
      {size.width > 0 && size.height > 0 && (
        <svg
          width={size.width}
          height={size.height}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={width - strokeWidth}
            height={height - strokeWidth}
            rx={rx}
            ry={rx}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${adjustedDashLength} ${adjustedGapLength}`}
            strokeDashoffset={adjustedDashLength / 2}
            pathLength={perimeter}
          />
        </svg>
      )}
    </div>
  );
}

/**
 * Displays an active state border animation.
 * @original ax
 */
export function ActiveBorder({ isActive }: { isActive: boolean }) {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="absolute inset-0 pointer-events-none z-40"
        >
          <div
            className="absolute inset-0"
            style={{
              border: "2px solid #F7CE46",
              borderRadius: "16px",
              boxSizing: "border-box",
            }}
          />
          <DashedBorder
            strokeColor="#31290E"
            strokeWidth={2}
            dashLength={9}
            gapLength={9}
            borderRadius={16}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}