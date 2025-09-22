import React from 'react'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <div className="relative group inline-flex">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-[6px] opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <div className="rounded-[8px] bg-text-100 px-2 py-1 text-[11px] font-styrene text-bg-100 shadow-md whitespace-nowrap">
          {content}
        </div>
        <div className="mx-auto h-2 w-2 rotate-45 bg-text-100" />
      </div>
    </div>
  )
}

