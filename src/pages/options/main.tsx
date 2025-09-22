// 入口：挂载 Options 页面
import React from "react";
// 全局样式入口：启用 Tailwind
import "../../styles/tailwind.css";
import { createRoot } from "react-dom/client";
import { AppProviders } from "../../providers/AppProvider";
import { OptionsPage } from "./OptionsPage";

// 等价还原：严格保持编译产物中的渲染结构（StrictMode + Provider + 页面）
const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <AppProviders pageName="Options">
        <OptionsPage />
      </AppProviders>
    </React.StrictMode>
  );
}
