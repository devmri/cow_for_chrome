import React from "react";
import { cn } from "../utils/classNames";

const SIZE_TO_VECTOR: Record<number, number> = {};

export interface IconProps {
  size?: number;
  vectorSizeOverride?: number;
  className?: string;
  alt?: string;
  viewBox?: string;
  children: React.ReactNode;
}

export function Icon({
  size = 20,
  vectorSizeOverride,
  className,
  alt,
  viewBox = "0 0 20 20",
  children,
}: IconProps) {
  const vectorSize = vectorSizeOverride ?? SIZE_TO_VECTOR[size] ?? size;

  const svgElement = (
    <svg
      width={vectorSize}
      height={vectorSize}
      viewBox={viewBox}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-label={alt}
      aria-hidden={!alt}
    >
      {children}
    </svg>
  );

  if (vectorSizeOverride) {
    return svgElement;
  }

  return (
    <div
      className={cn("flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {svgElement}
    </div>
  );
}
