import React, { ReactNode, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { CurrentAccountProvider } from "./CurrentAccountProvider";
import { AnalyticsProvider } from "./AnalyticsProvider";


interface AppProvidersProps {
  children: ReactNode;
  pageName: string;
}

// original var: Yc
export const AppProviders = ({ children, pageName }: AppProvidersProps) => (
  <QueryClientProvider client={queryClient}>
    <CurrentAccountProvider>
      <AnalyticsProvider pageName={pageName}>{children}</AnalyticsProvider>
    </CurrentAccountProvider>
  </QueryClientProvider>
);
