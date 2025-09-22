/*
  存储层封装（Chrome storage.local 的 Promise/类型化封装）
  - 提供统一的键枚举与常用读写接口
  - 对外只暴露语义化 API，隐藏回调式原始接口
*/

// 存储键枚举（与编译产物保持一致）
export enum StorageKey {
  // 认证相关
  ACCESS_TOKEN = 'accessToken',
  REFRESH_TOKEN = 'refreshToken',
  TOKEN_EXPIRY = 'tokenExpiry',
  OAUTH_STATE = 'oauthState',
  CODE_VERIFIER = 'codeVerifier',
  // 其他设置（与编译产物对齐）
  ANTHROPIC_API_KEY = 'anthropicApiKey',
  ANTHROPIC_API_URL = 'anthropicApiUrl',
  TELEMETRY_DISABLED = 'telemetryDisabled',
  MOCK_AUTH_ENABLED = 'mockAuthEnabled',
  MOCK_STATSIG_ENABLED = 'mockStatsigEnabled',
  SELECTED_MODEL = 'selectedModel',
  SYSTEM_PROMPT = 'systemPrompt',
  DEBUG_MODE = 'debugMode',
  SHOW_TRACE_IDS = 'showTraceIds',
  BROWSER_CONTROL_PERMISSION_ACCEPTED = 'browserControlPermissionAccepted',
  PERMISSION_STORAGE = 'permissionStorage',
  LAST_SKIP_PERMISSIONS_PREFERENCE = 'lastSkipPermissionsPreference',
  ANONYMOUS_ID = 'anonymousId',
  TEST_DATA_MESSAGES = 'test_data_messages',
  SCHEDULED_TASKS = 'scheduledTasks',
  SCHEDULED_TASKS_ENABLED = 'scheduledTasksEnabled',
  SCHEDULED_TASKS_PRELOADED = 'scheduledTasksPreloaded',
  TEST_SCHEDULED_TASK = 'testScheduledTask',
  TASK_RUN_LOGS = 'taskRunLogs',
  TASK_RUN_STATS = 'taskRunStats',
  SCHEDULED_TASK_LOGS = 'scheduledTaskLogs',
  SCHEDULED_TASK_STATS = 'scheduledTaskStats',
  TARGET_TAB_ID = 'targetTabId',
  UPDATE_AVAILABLE = 'updateAvailable',
  TIP_DISPLAY_COUNTS = 'tipDisplayCounts',
  SAVED_PROMPTS = 'savedPrompts',
  SAVED_PROMPT_CATEGORIES = 'savedPromptCategories',
}

// 侧边栏特有键（未在 SentryService 枚举中声明的键）
export const SidePanelStorageKey = {
  SKIP_ALL_PERMISSIONS: 'skipAllPermissions',
  SKIP_ALL_PERMISSIONS_CLICKED: 'skipAllPermissionsClicked',
} as const;

export type SidePanelStorageKey = (typeof SidePanelStorageKey)[keyof typeof SidePanelStorageKey];
export type AnyStorageKey = StorageKey | SidePanelStorageKey;

// 内部：回调式 API → Promise 封装
const localGet = <T = any>(keys: string | string[] | null | Record<string, any>): Promise<T> =>
  new Promise((resolve) => chrome.storage.local.get(keys as any, (res) => resolve(res as any)))
const localSet = (items: Record<string, any>): Promise<void> =>
  new Promise((resolve) => chrome.storage.local.set(items, () => resolve()))
const localRemove = (keys: string | string[]): Promise<void> =>
  new Promise((resolve) => chrome.storage.local.remove(keys as any, () => resolve()))

// 写入单键
export async function setLocalKey<T = any>(key: AnyStorageKey, value: T): Promise<void> {
  await localSet({ [key]: value })
}

// 读取单键值
export async function getLocalValue<T = any>(key: AnyStorageKey): Promise<T | undefined> {
  const obj = await localGet<Record<string, T>>([key])
  return obj[key]
}

// 读取多个键/全部项（传 null）
export async function getLocalObject<T = any>(
  keys: string | string[] | null | Record<string, any>,
): Promise<T> {
  return await localGet<T>(keys)
}

// 批量写入对象
export async function setLocalObject(items: Record<string, any>): Promise<void> {
  await localSet(items)
}

// 移除一项或多项
export async function removeLocal(keys: string | string[]): Promise<void> {
  await localRemove(keys)
}

// 匿名 ID：读取或生成，并持久化
export async function getAnonymousId(): Promise<string> {
  const cur = (await getLocalObject<Record<string, any>>([StorageKey.ANONYMOUS_ID]))[
    StorageKey.ANONYMOUS_ID
  ]
  if (cur) return cur
  const v = crypto.randomUUID()
  await setLocalObject({ [StorageKey.ANONYMOUS_ID]: v })
  return v
}
