// 原始文件末尾的 ReactDOM.createRoot 调用

import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./components/App";
import { initSentryForExtension } from "../../lib/sentryService";
import { initializeTelemetry } from "../../lib/telemetry";
import { AppProviders } from "../../providers/AppProvider";
import "../../styles/tailwind.css";

// Initialize Sentry and Telemetry
initSentryForExtension();
initializeTelemetry();

// Get the root element
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element");
}

// Create a root and render the App
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppProviders pageName="Side Panel">
      <App />
    </AppProviders>
  </React.StrictMode>,
);