// original var: Yc, _c, bc
import React, { ReactNode, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { CurrentAccountProvider } from "./CurrentAccountProvider";
import { AnalyticsProvider } from "./AnalyticsProvider";

// 注：原始代码中的 _c 和 bc 是 QueryClientProvider 的一个简化实现。
// 在现代项目中，我们直接使用库提供的官方组件。
// 这里保留了原始逻辑，并将其重命名。
// original var: bc
// const QueryClientContext = React.createContext<QueryClient | undefined>(undefined);
// original var: _c
// const ReactQueryProvider = ({ client, children }: { client: QueryClient, children: ReactNode }) => {
//   useEffect(() => {
//     client.mount();
//     return () => {
//       client.unmount();
//     };
//   }, [client]);
//   return <QueryClientContext.Provider value={client}>{children}</QueryClientContext.Provider>
// }
// 现代实践是直接使用 <QueryClientProvider client={queryClient}>

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
