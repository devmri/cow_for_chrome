# Cow for Chrome

**📖 Documentation**: [English](README.md) | [中文](README_zh.md)

# Cow for Chrome Extension

## Overview
- Restored version of the Claude browser extension built with React 19, TypeScript, and Vite, enabling Claude conversations inside a Chrome side panel on any webpage.
- All source code lives under `cow_chrome/`, including the background service worker, side panel UI, options page, and multiple content scripts.

## Key Features
- Side panel chat experience with slash commands, message compaction, model switching, keyboard shortcuts, auto-scroll handling, and prompt saving workflows.
- Permission governance powered by `permissions.ts` and Statsig gates to manage site-level access, skip flows, and debug modes.
- Observability stack integrating Sentry, Segment, Statsig, and OpenTelemetry trace headers for end-to-end diagnostics.
- Scheduled tasks via `scheduledTasks.ts`, supporting dedicated popup windows, execution logs, and configuration from the options page.
- Content scripts delivering accessibility tree capture, agent visual indicators, and a messaging bridge between pages and the side panel.

## Architecture
- `src/manifest.ts`: Generates the MV3 manifest through `@crxjs/vite-plugin`, defining entries, permissions, and CSP rules.
- `src/background/service-worker.ts`: Manages extension lifecycle, Sentry/Statsig bootstrap, declarative net request rules, and scheduled task orchestration.
- `src/pages/sidepanel/`: React SPA with `components/App.tsx` and `hooks/useChat.ts` handling conversation flow, tool orchestration, and telemetry.
- `src/pages/options/`: Modular options UI covering API keys, model prompts, permissions, scheduled tasks, and test data tabs.
- `src/content-scripts/`: Injected scripts for accessibility data, agent indicators, and message relays to the side panel.
- `src/lib/`: Infrastructure layer wrapping storage, permissions, Sentry/Statsig/OAuth utilities, scheduler helpers, telemetry modules, and CDP communication.

## Directory Layout
```text
cow_chrome/
├─ src/
│  ├─ background/            # MV3 service worker logic
│  ├─ components/            # Shared UI components
│  ├─ content-scripts/       # Injected scripts
│  ├─ hooks/                 # Reusable hooks
│  ├─ lib/                   # Storage, permissions, Sentry, and other infrastructure
│  ├─ pages/
│  │  ├─ options/            # Options page modules
│  │  └─ sidepanel/          # Side panel React app
│  ├─ providers/             # Analytics / Account / React Query contexts
│  ├─ styles/                # Tailwind output and global styles
│  └─ utils/                 # Utility helpers
├─ dist/                     # Vite build artifacts
├─ node_modules/
├─ package.json
├─ pnpm-lock.yaml
├─ tailwind.config.ts
├─ tsconfig.json
└─ vite.config.ts
```

## Development Workflow
1. Install dependencies with Node.js ≥ 18: `pnpm install`.
2. Run `pnpm build` once to emit `dist/` so Chrome can load the extension entries.
3. Start local debugging via `pnpm dev`; enable Developer Mode in `chrome://extensions` and load `cow_chrome/dist` as an unpacked extension.
4. Build production assets with `pnpm build`, outputting to `dist/`.
5. Package for distribution using `pnpm zip`, which creates `dist.zip`.

## Notable Modules
- `src/lib/sentryService.ts`: Handles OAuth, token refresh, Sentry/Statsig initialization, and exposes helpers such as `StorageKey` and API base URL utilities.
- `src/lib/permissions.ts`: Promise-based permission manager for site-level grants, skip modes, and durable state.
- `src/pages/sidepanel/hooks/useChat.ts`: Conversation state machine orchestrating Anthropic SDK calls, tool authorization, compaction flow, and telemetry spans.
- `src/providers/`: `AppProvider` wires React Query, account, and analytics contexts; `AnalyticsProvider` unifies Segment/Statsig event emission.
- `src/lib/storage.ts`: Typed wrapper over `chrome.storage.local`, defining all storage keys and CRUD helpers.

## Configuration & Environment
- `getEnvConfig()` defaults to the production setup for Anthropic, Statsig, and Segment; override locally if another environment is required.
- Custom API base URLs and system prompts persist in `chrome.storage.local` keys (see `StorageKey` enum) and can be adjusted via the options UI or scripts.
- Telemetry reporting is governed by the `telemetryDisabled` storage key and further controlled through Statsig feature gates.

## Testing & Quality
- No automated test suite is bundled; consider adding Jest or Playwright coverage for high-value flows such as permissions and scheduled tasks.
- Run `pnpm build` before commits to catch TypeScript or bundling regressions, and smoke test against both Chrome Beta and Stable channels.

## Troubleshooting
- Statsig or Segment initialization issues: verify `chrome.runtime.id` matches the expected certificate; toggle mock modes in the options page when debugging.
- OAuth failures: ensure `oauth_callback.html` is reachable and inspect `StorageKey.CODE_VERIFIER` plus `StorageKey.OAUTH_STATE` for persisted values.
- Content scripts not executing: confirm the target URL matches manifest patterns and inspect logs via `chrome://extensions` → Inspect views.

## References
- Chrome MV3 documentation: https://developer.chrome.com/docs/extensions/
- Vite documentation: https://vitejs.dev/
- Anthropic SDK guides: https://docs.anthropic.com/claude/docs

