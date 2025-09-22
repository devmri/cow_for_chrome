// 等价还原自 assets/service-worker.ts-DPbLNy8i.js
// 注意：仅还原业务逻辑，第三方/打包器辅助代码不重建

import {
  // 重构前变量名: tn（原导出名 e）
  startOAuthFlow,
  // 重构前变量名: Nt（原导出名 s）
  setLocalKey,
  // 重构前变量名: Ut（原导出名 S）
  StorageKey,
  // 重构前变量名: en（原导出名 h）
  clearStorageForLogout,
  // 重构前变量名: Zt（原导出名 j）
  handleOAuthRedirect,
  getApiBaseUrl,
} from "../lib/sentryService";

// 重构前变量名: c
// 作用：为 API 请求追加自定义 User-Agent（基于 declarativeNetRequest 会话规则）
async function setupApiUserAgentHeader(): Promise<void> {
  const apiBaseUrl = await getApiBaseUrl();
  const userAgent = `${`claude-browser-extension/${chrome.runtime.getManifest().version} (external)`} ${navigator.userAgent} `; // 末尾空格与产物保持一致

  const rules: chrome.declarativeNetRequest.Rule[] = [
    {
      id: 1,
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        requestHeaders: [
          {
            header: "User-Agent",
            operation: chrome.declarativeNetRequest.HeaderOperation.SET,
            value: userAgent,
          },
        ],
      },
      condition: {
        urlFilter: `${apiBaseUrl}/*`,
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
          chrome.declarativeNetRequest.ResourceType.OTHER,
        ],
      },
    },
  ];

  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [1],
    addRules: rules,
  });
}


// 重构前变量名: d
// 作用：打开当前 Tab 的侧边栏页面
async function openSidePanelForTab(tabId: number): Promise<void> {
  const panelPath = `src/sidepanel.html?tabId=${encodeURIComponent(tabId)}`;

  chrome.sidePanel.setOptions({
    tabId,
    path: panelPath,
    enabled: true,
  });

  chrome.sidePanel.open({ tabId });
}


// 重构前变量名: m
// 作用：让内容脚本隐藏 Agent 高亮/指示器
async function hideAgentIndicators(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "HIDE_AGENT_INDICATORS" });
  } catch {
    // 忽略：在没有注入内容脚本时会抛错
  }
}

// 重构前变量名: u
// 作用：点击按钮/快捷键切换打开侧边栏
async function handleOpenSidePanel(tab: chrome.tabs.Tab): Promise<void> {
  const tabId = tab.id;
  if (tabId) await openSidePanelForTab(tabId);
}

// 重构前变量名: h
// 作用：执行计划任务（创建目标标签页 + 弹出独立侧边栏窗口 + 等待加载后下发执行指令）
async function executeScheduledTask(
  task: {
    id?: string;
    name?: string;
    prompt?: string;
    url?: string;
    skipPermissions?: boolean;
  },
  runLogId?: string,
): Promise<void> {
  const windowSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  const createdTab = await chrome.tabs.create({
    url: task.url || "about:blank",
    active: true,
  });
  if (!createdTab.id) throw new Error("Failed to create tab for scheduled task");

  await setLocalKey(StorageKey.TARGET_TAB_ID, createdTab.id);

  const popupUrl = chrome.runtime.getURL(
    `sidepanel.html?mode=window&sessionId=${windowSessionId}${task.skipPermissions ? "&skipPermissions=true" : ""}`,
  );
  await chrome.windows.create({
    url: popupUrl,
    type: "popup",
    width: 500,
    height: 768,
    left: 100,
    top: 100,
    focused: true,
  });

  // 轮询等待标签页加载完成后再发送执行指令
  await new Promise<void>((resolve) => {
    const check = async () => {
      try {
        const tab = await chrome.tabs.get(createdTab.id!);
        if (tab.status === "complete") {
          setTimeout(() => {
            chrome.runtime.sendMessage({
              type: "EXECUTE_SCHEDULED_PROMPT",
              prompt: task.prompt,
              taskName: task.name,
              runLogId,
              windowSessionId,
            });
            resolve();
          }, 2000);
        } else {
          setTimeout(check, 500);
        }
      } catch {
        // 标签页可能被关闭，直接结束
        resolve();
      }
    };
    setTimeout(check, 1000);
  });
}

// onInstalled：清理更新标记、更新 UA 规则，首次安装触发 OAuth 授权
chrome.runtime.onInstalled.addListener(async (details) => {
  chrome.storage.local.remove(["updateAvailable"]);
  await setupApiUserAgentHeader();
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    startOAuthFlow();
  }
});

// onStartup：更新 UA 规则
chrome.runtime.onStartup.addListener(async () => {
  await setupApiUserAgentHeader();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (StorageKey.ANTHROPIC_API_URL in changes) {
    void setupApiUserAgentHeader();
  }
});

// 工具栏图标点击：打开侧边栏
chrome.action.onClicked.addListener(handleOpenSidePanel);

// 快捷键：toggle-side-panel → 打开当前活动标签页的侧边栏
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-side-panel") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab) void handleOpenSidePanel(tab);
    });
  }
});

// 更新可用：写入本地标记
chrome.runtime.onUpdateAvailable.addListener(() => {
  setLocalKey(StorageKey.UPDATE_AVAILABLE, true);
});

// 内部消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === "open_side_panel") {
      const tabId: number | undefined = message.tabId || sender.tab?.id;
      if (!tabId) {
        sendResponse({ success: false });
        return;
      }
      await openSidePanelForTab(tabId);
      if (message.prompt) {
        // 最多重试 3 次，等待侧边栏准备完成
        const tryPopulate = async (attempt = 0): Promise<void> => {
          try {
            await new Promise<void>((resolve, reject) => {
              chrome.runtime.sendMessage(
                { type: "POPULATE_INPUT_TEXT", prompt: message.prompt },
                () => {
                  // 与编译产物一致：通过 lastError 判断失败
                  if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                  } else {
                    resolve();
                  }
                },
              );
            });
          } catch {
            if (attempt < 3) {
              await new Promise((r) => setTimeout(r, 500));
              await tryPopulate(attempt + 1);
            }
          }
        };
        await tryPopulate();
      }
      sendResponse({ success: true });
      return;
    }

    if (message.type === "resize_window") {
      try {
        const cur = await chrome.windows.getCurrent();
        const width = Math.min(cur.width || 1366, 1366);
        const height = Math.min(cur.height || 768, 768);
        if (cur.id) await chrome.windows.update(cur.id, { width, height });
        sendResponse({ success: true });
      } catch (err: any) {
        sendResponse({ success: false, error: err?.message });
      }
      return;
    }

    if (message.type === "side_panel_closed") {
      const { tabId } = message as { tabId: number };
      await hideAgentIndicators(tabId);
      sendResponse({ success: true });
      return;
    }

    if (message.type === "logout") {
      try {
        await clearStorageForLogout();
        sendResponse({ success: true });
      } catch {
        // 与产物一致：忽略错误
      }
      return;
    }

    if (message.type === "EXECUTE_SCHEDULED_TASK") {
      try {
        const { task, runLogId } = message as { task: any; runLogId?: string };
        await executeScheduledTask(task, runLogId);
        sendResponse({ success: true });
      } catch (err: any) {
        sendResponse({ success: false, error: err?.message });
      }
      return;
    }
  })();
  // 告诉 Chrome 保持 sendResponse 渠道（异步回应）
  return true;
});

// 标签页关闭：隐藏相关指示器
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await hideAgentIndicators(tabId);
});

// 定时器任务：名称以 task_ 开头
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith("task_")) {
    try {
      const taskId = alarm.name.replace(/^task_|_day\d+$/g, "");
      const stored = await chrome.storage.local.get(["scheduledTasks"]);
      const task = (stored.scheduledTasks || []).find((t: any) => t.id === taskId);
      if (task && (task.enabled || taskId === "test-anthropic-news")) {
        const runLogId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        try {
          await executeScheduledTask(task, runLogId);
        } catch {
          // 执行失败静默
        }
      }
    } catch {
      // 静默忽略
    }
  }
});

// 外部消息（externally_connectable）
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === "oauth_redirect") {
      const result = await handleOAuthRedirect(message.redirect_uri, sender?.tab?.id);
      sendResponse(result);
      return;
    }
    if (message.type === "ping") {
      sendResponse({ success: true, exists: true });
      return;
    }
    if (message.type === "onboarding_task") {
      chrome.runtime.sendMessage({
        type: "POPULATE_INPUT_TEXT",
        prompt: message.payload?.prompt,
      });
      sendResponse({ success: true });
      return;
    }
  })();
  return true;
});
