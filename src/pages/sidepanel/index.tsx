
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./components/App";
import { AppProviders } from "../../providers/AppProvider";
import "../../styles/tailwind.css";

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
