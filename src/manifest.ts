// 说明：此 Manifest 基于原始扩展的配置等价还原，
// - 路径改为指向 src 下的源码入口，由 @crxjs/vite-plugin 负责编译与重写
// - 为避免与现网扩展完全重名产生混淆，这里略作标注（Research Skeleton）

// 在开发模式下需要允许 Vite HMR 的 WebSocket 连接（ws://localhost:*）
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
  // 侧边栏默认页面（与编译产物等价，并允许从工具栏打开）
  side_panel: {
    default_path: "src/sidepanel.html",
  },
  // 与原始扩展保持一致，便于研究同一扩展 ID 行为（如产生冲突可暂时删除）
  // key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjU1XnLPoasGVmZU42K3h6S+sQhkogfcoLPbIcrWH5Oo8QoInBIugkew/7cWaEFySyQrkaEBe1fjeS/rlAqd3r778dKcTvDZcXmj0VVX0Fi1i8tnkarurceGKGdVxfkL7e30nwfgwoPxj3H8OQbsbxFcBWGVtcFekmdpiyaxwz6o4yXIWColfAxh9K2yToOZkoAS5GvgGvTexiCh1gYy++eFdk6C61mcFsyDdoGQtduhGEaX0zZ9uAW1jX4JTPmHV3kEFrZu/WVBl7Obw+Jk/osoHMdmghVNy6SCB8/6mcgmxkP9buPrNUZgYP6n0x5dqEJ2Ecww/lb1Zd4nQf4XGOwIDAQAB",
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
