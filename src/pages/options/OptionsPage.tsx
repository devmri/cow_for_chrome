import React, { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { User, LogOut, Sparkles } from "lucide-react";

import { useCurrentAccount } from "../../providers/CurrentAccountProvider";
import { useAnalytics } from "../../providers/AnalyticsProvider";
import {
  getLocalObject,
  setLocalKey,
  setLocalObject,
  StorageKey,
  removeLocal,
} from "../../lib/storage";
import { startOAuthFlow } from "../../lib/sentryService";
import LoginCta from "../../components/LoginCta";
import { PermissionsTab } from "./PermissionsTab";
import { ModelPromptConfig } from "./ModelPromptConfig";
import { ScheduledTasksTab } from "./ScheduledTasksTab";
import { ShortcutsTab } from "./ShortcutsTab";
import { TestDataTab } from "./TestDataTab";

import { cn } from "../../utils/classNames";

export type OptionsTab =
  | "api"
  | "model"
  | "permissions"
  | "prompts"
  | "scheduled"
  | "testdata";

// 导航按钮（重构前变量名: ar）
function NavItem({
  children,
  isActive,
  onClick,
}: {
  children: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "block w-full text-left whitespace-nowrap transition-all ease-in-out active:scale-95",
        "font-base rounded-lg px-3 py-3",
        isActive
          ? "bg-accent-main-200 text-oncolor-100 font-medium shadow-sm"
          : "text-text-200 hover:bg-bg-200 hover:text-text-100"
      )}
    >
      {children}
    </button>
  );
}

// 主容器（重构前变量名: rr）
function Container({
  children,
  className,
  narrow,
}: {
  children: React.ReactNode;
  className?: string;
  narrow?: boolean;
}) {
  return (
    <main
      className={cn(
        "mx-auto mt-4 w-full flex-1 px-4 md:pl-8 lg:mt-6",
        narrow ? "max-w-4xl" : "max-w-7xl",
        className
      )}
    >
      {children}
    </main>
  );
}

// 头部（重构前变量名: or）
function PageHeader({
  children,
  className,
  contentClassName,
  sticky,
  fixed,
  mdTitle,
  large,
  narrow,
}: {
  children?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  sticky?: boolean;
  fixed?: boolean;
  mdTitle?: string;
  large?: boolean;
  narrow?: boolean;
}) {
  const ariaHidden = !children && !mdTitle;
  const isLarge = !!large;
  return (
    <header
      className={cn(
        "flex w-full bg-gradient-to-r from-accent-main-900/70 via-accent-secondary-200/10 to-transparent border-b border-border-200/60",
        sticky && "sticky top-0 z-50",
        fixed && "fixed top-0 z-50",
        "h-12",
        isLarge &&
          [
            "mx-auto md:h-24 md:items-end",
            narrow ? "max-w-4xl" : "max-w-7xl",
          ].join(" "),
        className
      )}
      aria-hidden={ariaHidden}
    >
      <div
        className={cn(
          "flex w-full items-center justify-between gap-4",
          "pl-11 lg:pl-8",
          contentClassName,
          isLarge ? "px-4 md:pl-8" : "pr-3"
        )}
      >
        {mdTitle ? (
          <Fragment>
            <h1
              className={cn(
                "text-text-200 flex items-center gap-2 text-center max-md:hidden min-w-0",
                "font-heading",
                isLarge ? "text-2xl" : "text-lg"
              )}
            >
              <span className="truncate">{mdTitle}</span>
            </h1>
            <div />
            {children}
          </Fragment>
        ) : (
          children
        )}
      </div>
    </header>
  );
}

// API Key 配置（重构前变量名: er）
function ApiConfig({
  apiKey,
  apiUrl,
  setApiKey,
  setApiUrl,
  onSave,
  saved,
}: {
  apiKey: string;
  apiUrl: string;
  setApiKey: (v: string) => void;
  setApiUrl: (v: string) => void;
  onSave: () => Promise<void> | void;
  saved: boolean;
}) {
  return (
    <div className="max-w-md">
      <h2 className="font-xl-bold text-text-100 mb-4">
        API configuration
      </h2>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="apiKey"
            className="font-label block mb-2 text-text-200"
          >
            Anthropic API Key
          </label>
          <input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Anthropic API key"
            className="w-full px-3 py-2 border border-border-200 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-main-200 bg-bg-000 text-text-100 font-base"
          />
          <p className="mt-2 font-caption text-text-300">
            Get your API key from{" "}
            <a
              href="https://console.anthropic.com/account/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-main-200 hover:underline"
            >
              console.anthropic.com
            </a>
          </p>
        </div>
        <div>
          <label
            htmlFor="apiUrl"
            className="font-label block mb-2 text-text-200"
          >
            自定义 API Base URL（可选）
          </label>
          <input
            id="apiUrl"
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="例如：https://api.anthropic.com"
            className="w-full px-3 py-2 border border-border-200 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-main-200 bg-bg-000 text-text-100 font-base"
          />
          <p className="mt-2 font-caption text-text-300">
            留空将使用默认的 Anthropic 接口地址。
          </p>
        </div>
        <button
          type="button"
          onClick={onSave}
          className="w-full bg-accent-main-200 text-oncolor-100 py-2 px-4 rounded-md hover:bg-accent-main-100 focus:outline-none focus:ring-2 focus:ring-accent-main-200 font-button-lg"
        >
          保存 API 配置
        </button>
        {saved && (
          <div className="font-base-sm text-text-200">
            Settings saved successfully!
          </div>
        )}
      </div>
    </div>
  );
}

// Telemetry controls removed

// 主页面（重构前变量名: sr）
export function OptionsPage() {
  const { userProfile, isAuthenticated } = useCurrentAccount();
  const { resetAnalytics } = useAnalytics();
  // Gates removed: default values
  const scheduledGate = true;
  const showEmailGate = true;
  const defaultDebugGate = false;
  const allowApiKeyGate = true;
  const allowEditSystemPromptGate = true;

  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [debugMode, setDebugMode] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<OptionsTab>("permissions");
  const [isMockedAuth, setMockedAuth] = useState(false);
  const [isMockedStatsig, setMockedStatsig] = useState(false); // legacy; will be removed

  useEffect(() => {
    getLocalObject<Record<string, any>>([
      StorageKey.ANTHROPIC_API_KEY,
      StorageKey.ANTHROPIC_API_URL,
      StorageKey.SELECTED_MODEL,
      StorageKey.SYSTEM_PROMPT,
      StorageKey.DEBUG_MODE,
      StorageKey.MOCK_AUTH_ENABLED,
      StorageKey.MOCK_STATSIG_ENABLED,
    ]).then((store) => {
      if (store[StorageKey.ANTHROPIC_API_KEY])
        setApiKey(store[StorageKey.ANTHROPIC_API_KEY]);
      if (store[StorageKey.ANTHROPIC_API_URL])
        setApiUrl(store[StorageKey.ANTHROPIC_API_URL]);
      if (store[StorageKey.SELECTED_MODEL])
        setSelectedModel(store[StorageKey.SELECTED_MODEL]);
      if (store[StorageKey.SYSTEM_PROMPT])
        setSystemPrompt(store[StorageKey.SYSTEM_PROMPT]);
      if (store[StorageKey.DEBUG_MODE] !== undefined)
        setDebugMode(!!store[StorageKey.DEBUG_MODE]);
      else setDebugMode(!!defaultDebugGate);
      if (store[StorageKey.MOCK_AUTH_ENABLED] !== undefined)
        setMockedAuth(!!store[StorageKey.MOCK_AUTH_ENABLED]);
      if (store[StorageKey.MOCK_STATSIG_ENABLED] !== undefined)
        setMockedStatsig(!!store[StorageKey.MOCK_STATSIG_ENABLED]);
    });
  }, [defaultDebugGate]);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;
    const syncMockFlags = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== "local") return;
      if (StorageKey.MOCK_AUTH_ENABLED in changes) {
        setMockedAuth(!!changes[StorageKey.MOCK_AUTH_ENABLED].newValue);
      }
      if (StorageKey.MOCK_STATSIG_ENABLED in changes) {
        setMockedStatsig(!!changes[StorageKey.MOCK_STATSIG_ENABLED].newValue);
      }
    };
    chrome.storage.onChanged.addListener(syncMockFlags);
    return () => chrome.storage.onChanged.removeListener(syncMockFlags);
  }, []);

  useEffect(() => {
    const hash = window.location.hash.slice(1) as OptionsTab;
    const validTabs: OptionsTab[] = [
      "api",
      "model",
      "permissions",
      "prompts",
      "scheduled",
      "testdata",
    ];
    setActiveTab(validTabs.includes(hash) ? hash : "permissions");
  }, []);

  useEffect(() => {
    setAvailableModels([
      "claude-sonnet-4-20250514",
      "claude-3-5-sonnet-latest",
      "claude-3-haiku-20240307",
    ]);
  }, []);

  useEffect(() => {
    setLocalKey(StorageKey.SCHEDULED_TASKS_ENABLED, scheduledGate);
  }, [scheduledGate]);

  const switchTab = useCallback((tab: OptionsTab) => {
    setActiveTab(tab);
    window.location.hash = tab;
  }, []);

  const showContent = isAuthenticated || !!apiKey || isMockedAuth;

  const navItems = useMemo(
    () =>
      [
        {
          key: "testdata" as OptionsTab,
          label: "For test",
          visible: allowApiKeyGate || isMockedAuth,
        },
        {
          key: "api" as OptionsTab,
          label: "API",
          visible: allowApiKeyGate || isMockedAuth,
        },
        {
          key: "model" as OptionsTab,
          label: "Model",
          visible: allowApiKeyGate || isMockedAuth,
        },
        {
          key: "prompts" as OptionsTab,
          label: "Prompts",
          visible: true,
        },
        {
          key: "permissions" as OptionsTab,
          label: "Permissions",
          visible: true,
        },
        {
          key: "scheduled" as OptionsTab,
          label: "Scheduled tasks",
          visible: scheduledGate || isMockedAuth,
        },
      ].filter((item) => item.visible),
    [allowApiKeyGate, isMockedAuth, scheduledGate]
  );

  return (
    <Fragment>
      <PageHeader
        large
        // 重构前变量名: or（编译产物条件：isAuthenticated || apiKey）
        mdTitle={showContent ? "Cow for Chrome settings" : undefined}
        sticky
      >
        {isAuthenticated && userProfile && (
          <div className="flex items-center gap-2 px-3 py-2 bg-bg-000 border border-border-200 rounded-lg">
            <User className="w-4 h-4 text-text-300" />
            <span className="font-base-sm text-text-200">
              {userProfile.account.email}
            </span>
          </div>
        )}
        {!isAuthenticated && apiKey && allowApiKeyGate && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-bg-000 border border-border-200 rounded-lg">
              <User className="w-4 h-4 text-text-300" />
              <span className="font-base-sm text-text-200">API Key Mode</span>
            </div>
            <button
              type="button"
              className="px-3 py-2 bg-accent-main-100 text-oncolor-100 rounded-lg font-base-sm hover:bg-accent-main-200 transition-colors"
              onClick={async () => {
                try {
                  await startOAuthFlow();
                } catch {
                  // 忽略异常
                }
              }}
            >
              Login
            </button>
          </div>
        )}
        {((!isAuthenticated && !apiKey && isMockedAuth) || isMockedStatsig) && (
          <div className="flex flex-wrap items-center gap-3 px-3 py-2 bg-bg-000 border border-border-200 rounded-lg">
            <div className="flex flex-wrap items-center gap-3">
              {!isAuthenticated && !apiKey && isMockedAuth && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-text-300" />
                  <span className="font-base-sm text-text-200">模拟登录模式</span>
                </div>
              )}
              {isMockedStatsig && (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-text-300" />
                  <span className="font-base-sm text-text-200">Statsig 特性模拟已启用</span>
                </div>
              )}
            </div>
            <button
              type="button"
              className="px-3 py-1.5 rounded-md bg-accent-main-100 text-oncolor-100 font-base-sm hover:bg-accent-main-200 transition-colors"
              onClick={async () => {
                try {
                  await removeLocal([
                    StorageKey.MOCK_AUTH_ENABLED,
                    StorageKey.MOCK_STATSIG_ENABLED,
                  ]);
                } finally {
                  setMockedAuth(false);
                  setMockedStatsig(false);
                }
              }}
            >
              清除模拟数据
            </button>
          </div>
        )}
      </PageHeader>

      <Container>
        <h1 className="font-heading text-text-200 mb-4 flex items-center gap-1.5 text-center md:hidden">
          Settings
        </h1>

        {showContent ? (
          <>
            <div className="grid md:grid-cols-[220px_minmax(0px,_1fr)] gap-x-8 w-full max-w-6xl my-4 md:my-8">
              <nav className="w-full overflow-x-auto -m-2 p-2 self-start md:sticky md:top-4 relative z-10 mb-4 md:mb-0">
                <ul className="flex gap-1 md:flex-col mb-0">
                  {navItems.map((item) => (
                    <li key={item.key}>
                      <NavItem
                      isActive={activeTab === item.key}
                      onClick={() => switchTab(item.key)}
                    >
                      {item.label}
                    </NavItem>
                  </li>
                ))}
              </ul>

              {isAuthenticated && (
                <div className="mt-8 pt-8 border-t border-border-200">
                  <button
                    onClick={async () => {
                      try {
                        await chrome.runtime.sendMessage({ type: "logout" });
                        await resetAnalytics();
                        window.location.reload();
                      } catch {
                        alert("Failed to logout. Please try again.");
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-3 text-danger-000 hover:bg-danger-000/10 rounded-lg transition-all font-base"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}
            </nav>

            <div className="space-y-6">
              {activeTab === "api" && (
                <ApiConfig
                  apiKey={apiKey}
                  apiUrl={apiUrl}
                  setApiKey={setApiKey}
                  setApiUrl={setApiUrl}
                  saved={saved}
                  onSave={async () => {
                    const trimmedUrl = apiUrl.trim();
                    await setLocalObject({
                      [StorageKey.ANTHROPIC_API_KEY]: apiKey,
                      ...(trimmedUrl
                        ? { [StorageKey.ANTHROPIC_API_URL]: trimmedUrl }
                        : {}),
                    });
                    if (!trimmedUrl) {
                      await removeLocal([StorageKey.ANTHROPIC_API_URL]);
                    }
                    setSaved(true);
                    setTimeout(() => setSaved(false), 2000);
                  }}
                />
              )}

              {activeTab === "model" && (
                <ModelPromptConfig
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                  availableModels={availableModels}
                  loadingModels={false}
                  modelsError={undefined}
                  systemPrompt={systemPrompt}
                  setSystemPrompt={setSystemPrompt}
                  debugMode={debugMode}
                  setDebugMode={setDebugMode}
                  onModelSave={async () => {
                    await setLocalKey(StorageKey.SELECTED_MODEL, selectedModel);
                    setSaved(true);
                    setTimeout(() => setSaved(false), 2000);
                  }}
                  onPromptSave={async () => {
                    await setLocalKey(StorageKey.SYSTEM_PROMPT, systemPrompt);
                    setSaved(true);
                    setTimeout(() => setSaved(false), 2000);
                  }}
                  onResetPrompt={() => setSystemPrompt("")}
                  saved={saved}
                  setSaved={setSaved}
                  allowEditSystemPrompt={allowEditSystemPromptGate}
                />
              )}

              {activeTab === "permissions" && <PermissionsTab />}

              {activeTab === "prompts" && <ShortcutsTab />}

              {activeTab === "scheduled" && scheduledGate && (
                <ScheduledTasksTab />
              )}

              {activeTab === "testdata" && (allowApiKeyGate || isMockedAuth) && (
                <TestDataTab />
              )}
            </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <LoginCta />
            <button
              type="button"
              onClick={async () => {
                try {
                  await setLocalObject({
                    [StorageKey.MOCK_AUTH_ENABLED]: true,
                  });
                } finally {
                  setMockedAuth(true);
                }
              }}
              className="mt-6 px-4 py-2 rounded-lg bg-accent-main-200 text-oncolor-100 font-button-lg hover:bg-accent-main-100 transition-colors"
            >
              一键开启模拟模式
            </button>
            
          </div>
        )}
      </Container>
    </Fragment>
  );
}
