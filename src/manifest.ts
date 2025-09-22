const isDev =
  process.env.NODE_ENV === 'development' ||
  process.env.MODE === 'development' ||
  process.env.VITE === 'development'

const devConnectSrc = isDev
  ? ' http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*'
  : ''

const manifest: chrome.runtime.ManifestV3 = {
  update_url: "https://clients2.google.com/service/update2/crx",
  manifest_version: 3,
  name: "Cow for Chrome",
  version: "1.0.28",
  description: "Meet Cow for Chrome",
  icons: {
    "128": "icon-128.png",
  },
  background: {
    service_worker: "src/background/service-worker-loader.ts",
    type: "module",
  },
  action: {
    default_title: "Open Claude",
  },
  options_page: "src/options.html",
  permissions: [
    "sidePanel",
    "storage",
    "activeTab",
    "scripting",
    "debugger",
    "tabGroups",
    "tabs",
    "alarms",
    "notifications",
    "system.display",
    "webNavigation",
    "declarativeNetRequest",
  ],
  host_permissions: ["<all_urls>"],
  content_scripts: [
    {
      js: ["src/content-scripts/content-script.ts"],
      matches: ["https://claude.ai/*", "https://*.claude.ai/*"],
      run_at: "document_end",
    },
    {
      js: ["src/content-scripts/accessibility-tree.ts"],
      matches: ["<all_urls>"],
      run_at: "document_start",
      all_frames: true,
    },
    {
      js: ["src/content-scripts/agent-visual-indicator.ts"],
      matches: ["<all_urls>"],
      run_at: "document_idle",
      all_frames: false,
    },
  ],
  externally_connectable: {
    matches: ["https://claude.ai/*", "https://*.claude.ai/*"],
  },
  commands: {
    "toggle-side-panel": {
      suggested_key: {
        default: "Ctrl+E",
        mac: "Command+E",
      },
      description: "Toggle Claude side panel",
    },
  },
  side_panel: {
    default_path: "src/sidepanel.html",
  },
  content_security_policy: {
    // 开发模式拼接 ws://localhost:* 以允许 Vite HMR；打包模式不包含这些例外
    extension_pages:
      ("script-src 'self'; object-src 'self'; connect-src 'self' https://api.anthropic.com https://claude.ai https://console.anthropic.com" +
        devConnectSrc +
        "; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"),
  },
  web_accessible_resources: [
    {
      matches: ["https://*.claude.ai/*", "https://claude.ai/*"],
      resources: ["src/content-scripts/content-script.ts"],
      use_dynamic_url: false,
    },
    {
      matches: ["<all_urls>"],
      resources: [
        "src/content-scripts/accessibility-tree.ts",
        "src/content-scripts/agent-visual-indicator.ts",
      ],
      use_dynamic_url: false,
    },
  ],
};

export default manifest;
