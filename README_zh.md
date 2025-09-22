# Cow for Chrome 浏览器扩展

**📖 Documentation**: [English](README.md) | [中文](README_zh.md)

## 项目简介
- 基于 React 19、TypeScript、Vite 搭建的 Claude 浏览器扩展还原版，在任何页面侧边栏内提供对话能力。
- 工程代码全部集中在 `cow_chrome/` 目录，包含后台 Service Worker、侧边栏 UI、Options 设置页与多类内容脚本。

## 核心特性
- 侧边栏聊天：支持 Slash 命令、消息压缩、模型切换、快捷键唤起、滚动定位与提示保存。
- 权限治理：借助 `permissions.ts` 与 Statsig 开关管理站点权限、跳过策略及调试模式。
- 可观测性：整合 Sentry、Segment、Statsig 与 OpenTelemetry Trace Header，追踪关键事件与链路。
- 计划任务：`scheduledTasks.ts` 支持计划执行、独立窗口运行与运行日志持久化，可在 Options 页配置。
- 内容脚本：提供可访问性树采集、Agent 可视化指示器以及与侧边栏的消息桥接。

## 架构总览
- `src/manifest.ts`：通过 `@crxjs/vite-plugin` 生成 MV3 Manifest，统一入口、权限与 CSP。
- `src/background/service-worker.ts`：负责扩展生命周期、Sentry/Statsig 初始化、Declarative Net Request 规则与计划任务调度。
- `src/pages/sidepanel/`：React 单页应用，`components/App.tsx` 与 `hooks/useChat.ts` 处理核心会话与工具逻辑。
- `src/pages/options/`：Options 页面拆分多个 Tab，涵盖 API Key、模型提示词、权限、计划任务与测试数据管理。
- `src/content-scripts/`：注入目标页面的辅助脚本，用于可访问性、Agent 指示器与消息传递。
- `src/lib/`：封装存储、权限、Sentry/Statsig/OAuth、调度、Telemetry、CDP 通信等基础能力。

## 目录结构
```text
cow_chrome/
├─ src/
│  ├─ background/            # MV3 Service Worker 逻辑
│  ├─ components/            # 多页面共享的 UI 组件
│  ├─ content-scripts/       # 注入页面的脚本
│  ├─ hooks/                 # 复用逻辑钩子
│  ├─ lib/                   # 存储、权限、Sentry 等基础设施
│  ├─ pages/
│  │  ├─ options/            # Options 页面与子模块
│  │  └─ sidepanel/          # 侧边栏 React 应用
│  ├─ providers/             # Analytics / Account / React Query 上下文
│  ├─ styles/                # Tailwind 构建输出与全局样式
│  └─ utils/                 # 工具函数
├─ dist/                     # Vite 构建产物
├─ node_modules/
├─ package.json
├─ pnpm-lock.yaml
├─ tailwind.config.ts
├─ tsconfig.json
└─ vite.config.ts
```

## 开发流程
1. 安装依赖：推荐 Node.js ≥ 18，执行 `pnpm install`。
2. 首次构建：运行 `pnpm build` 生成 `dist/`，便于 Chrome 加载入口文件。
3. 本地调试：执行 `pnpm dev` 启动 Vite HMR，在 `chrome://extensions` 启用开发者模式并选择 `Load unpacked` 指向 `cow_chrome/dist`。
4. 产物构建：`pnpm build` 输出生产包到 `dist/`。
5. 压缩打包：`pnpm zip` 生成 `dist.zip` 方便分发或上架。

## 关键模块说明
- `src/lib/sentryService.ts`：封装 OAuth、令牌刷新、Sentry/Statsig 初始化与 API 基础配置，导出 `StorageKey` 等常量。
- `src/lib/permissions.ts`：Promise 化的权限管理器，支持站点维度授权、跳过模式与状态持久化。
- `src/pages/sidepanel/hooks/useChat.ts`：核心会话状态机，负责 Anthropic SDK 调用、工具权限流、消息压缩与 Telemetry span。
- `src/providers/`：`AppProvider` 组合 React Query、账户与分析上下文；`AnalyticsProvider` 统一上报 Segment/Statsig 事件。
- `src/lib/storage.ts`：`chrome.storage.local` 的统一包装，定义所有 StorageKey 并提供增删改查接口。

## 配置与环境
- `getEnvConfig()` 默认返回 production 配置（Anthropic、Statsig、Segment），如需切换环境可在本地重写。
- 自定义 API Base URL、系统提示词等持久化在 `chrome.storage.local` 对应键（参见 `StorageKey` 枚举），可通过 Options 页面或脚本调整。
- Telemetry 报告受 `telemetryDisabled` 存储键控制，同时受 Statsig 配置影响。

## 测试与质量
- 仓库目前未附带自动化测试，建议优先为权限、计划任务等关键逻辑补充 Jest/Playwright 测试。
- 提交前运行 `pnpm build` 捕获 TypeScript 与打包问题，并在 Chrome Beta/Stable 双通道进行冒烟验证。

## 故障排查
- Statsig/Segment 初始化失败：确认 `chrome.runtime.id` 与预期证书匹配，可在 Options 页启用 Mock 模式定位问题。
- OAuth 异常：检查 `oauth_callback.html` 是否可访问，并验证 `StorageKey.CODE_VERIFIER` 与 `StorageKey.OAUTH_STATE` 是否正确写入。
- 内容脚本无效：确保目标页面 URL 在 Manifest 匹配范围内，必要时在 `chrome://extensions` → Inspect views 查看日志。

## 参考资料
- Chrome MV3 文档：https://developer.chrome.com/docs/extensions/
- Vite 文档：https://vitejs.dev/
- Anthropic SDK 指南：https://docs.anthropic.com/claude/docs

