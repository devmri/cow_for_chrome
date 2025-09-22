// 原始函数: Iy (基于Radix UI Tooltip的封装)

import React from "react";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipPortal,
  TooltipContent,
  TooltipContentProps,
} from "@radix-ui/react-tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../../utils/classNames";

type TooltipStyle = "default" | "citation" | "inputMenu" | "sampleImage";

interface TooltipProps {
  children: React.ReactElement;
  tooltipContent: React.ReactNode;
  contentStyle?: TooltipStyle;
  side?: TooltipContentProps["side"];
  sideOffset?: TooltipContentProps["sideOffset"];
  align?: TooltipContentProps["align"];
  className?: string;
  delayDuration?: number;
  open?: boolean;
}

/**
 * A customizable tooltip component built on top of Radix UI.
 * @original Iy
 */
export function CustomTooltip({
  children,
  tooltipContent,
  contentStyle = "default",
  side = "top",
  sideOffset,
  align,
  className,
  delayDuration = 200,
  ...props
}: TooltipProps) {
  const TooltipComponent = STYLES[contentStyle];

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip {...props}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipPortal>
            <TooltipComponent
                className={cn(className, !tooltipContent && "hidden")}
                sideOffset={sideOffset ?? 5}
                side={side}
                align={align}
            >
                {tooltipContent}
            </TooltipComponent>
        </TooltipPortal>
      </Tooltip>
    </TooltipProvider>
  );
}

const DefaultTooltip = ({
  children,
  className,
  ...props
}: TooltipContentProps) => (
  <TooltipContent
    {...props}
    className={cn(
      "px-2",
      "py-1",
      "font-small",
      "leading-tight",
      "rounded-md",
      "shadow-md",
      "text-oncolor-100",
      "bg-always-black/80",
      "backdrop-blur",
      "break-words",
      "z-50",
      "max-w-[13rem]",
      "[*:disabled_&]:hidden",
      className,
    )}
  >
    {children}
  </TooltipContent>
);

const CitationTooltip = ({
  children,
  className,
  ...props
}: TooltipContentProps) => (
  <TooltipContent
    {...props}
    className={cn("max-w-[337px]", "z-50", "[*:disabled_&]:hidden", className)}
  >
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="p-1 font-styrene text-text-200 bg-bg-100 break-words border-[0.5px] border-border-300/25 max-h-[300px] shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] rounded-lg overflow-y-auto"
    >
      {children}
    </motion.div>
  </TooltipContent>
);

const InputMenuTooltip = ({
  children,
  className,
  ...props
}: TooltipContentProps) => (
  <TooltipContent
    {...props}
    className={cn(
      "p-1",
      "font-styrene",
      "font-bold",
      "text-xs",
      "rounded-lg",
      "shadow-md",
      "text-oncolor-100",
      "bg-always-black/80",
      "backdrop-blur",
      "break-words",
      "z-50",
      "max-w-[13rem]",
      "[*:disabled_&]:hidden",
      className,
    )}
  >
    {children}
  </TooltipContent>
);


const SampleImageTooltip = ({
  children,
  className,
  ...props
}: TooltipContentProps) => (
  <TooltipContent
    {...props}
    className={cn(
      "p-1",
      "font-styrene",
      "text-sm",
      "border-border-300",
      "border-[0.5px]",
      "rounded-lg",
      "shadow-[0_4px_20px_0_rgba(0,0,0,0.04)]",
      "text-text-100",
      "bg-bg-100",
      "break-words",
      "z-50",
      "max-w-[13rem]",
      "[*:disabled_&]:hidden",
      className,
    )}
  >
    {children}
  </TooltipContent>
);


const STYLES: Record<TooltipStyle, React.FC<TooltipContentProps>> = {
  default: DefaultTooltip,
  citation: CitationTooltip,
  inputMenu: InputMenuTooltip,
  sampleImage: SampleImageTooltip,
};