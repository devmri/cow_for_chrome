import React, { createContext, useContext, useMemo, ReactNode } from "react";

interface AnalyticsContextType {
  analytics: null;
  resetAnalytics: () => Promise<void>;
}

const AnalyticsContext = createContext<AnalyticsContextType | null>(null);

export function useAnalytics(): AnalyticsContextType {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error("useAnalytics must be used within an AnalyticsProvider");
  return ctx;
}

export const AnalyticsProvider = ({ children }: { children: ReactNode; pageName: string }) => {
  const value = useMemo<AnalyticsContextType>(() => ({ analytics: null, resetAnalytics: async () => {} }), []);
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
};

