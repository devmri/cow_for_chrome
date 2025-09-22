import React from "react";

interface CompactingStatusProps {
  isDarkMode: boolean;
}

export function CompactingStatus({ isDarkMode }: CompactingStatusProps) {
  const gradient = isDarkMode
    ? "linear-gradient(90deg, #faf9f5 0%, #faf9f5 35%, #808080 50%, #faf9f5 65%, #faf9f5 100%)"
    : "linear-gradient(90deg, #141413 0%, #141413 35%, #888888 50%, #141413 65%, #141413 100%)";

  return (
    <span
      className="mt-6 mb-6 text-[12px] italic font-claude-response relative inline-block"
      style={{
        color: "transparent",
        background: gradient,
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        animation: "shimmerSweep 2.25s ease-in-out infinite",
      }}
    >
      <style>{`
        @keyframes shimmerSweep {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      Compacting...
    </span>
  );
}
