/*
  等价还原：封装原 SW 依赖的工具与常量
  - 原始导入源（编译产物）: temp/sentryService.js（对应旧导出别名）
  - 接入真实第三方包（Sentry、Statsig），保持接口与时序一致

  导出映射（原始 → 还原后）
  - Ut as S           → StorageKey（从 ./storage 重导出）
  - Mt as a           → getLocalValue（从 ./storage 重导出）
  - s  as b           → getEnvConfig
  - Xt as c           → ensureValidAccessToken
  - Kt as d           → getLocalObject（从 ./storage 重导出）
  - tn as e           → startOAuthFlow
  - Wt as f           → initStatsig
  - Qt as g           → getAccessToken
  - en as h           → clearStorageForLogout
  - Ki as i           → initSentryForExtension
  - Zt as j           → handleOAuthRedirect
  - Nt as s           → setLocalKey（从 ./storage 重导出）
*/

// 第三方包（根据产物痕迹接线真实 SDK）
// 重构前：Sentry 在 $i() 中初始化；此处使用官方浏览器 SDK
import * as Sentry from "@sentry/browser";
// 重构前：Statsig 使用 StatsigClient；此处使用 statsig-js
import { StatsigClient, type StatsigUser } from "statsig-js";
// 存储与键枚举抽离到独立模块
import {
  StorageKey,
  getLocalObject,
  setLocalObject,
  removeLocal,
  getAnonymousId,
  getLocalValue,
} from "./storage";
// 兼容性导出（逐个标注原变量名/导出别名）：
// 重构前变量名: Ut（原导出名 S）
export { StorageKey } from "./storage";
// 重构前变量名: Nt（原导出名 s）
export { setLocalKey } from "./storage";
// 重构前变量名: Mt（原导出名 a）
export { getLocalValue } from "./storage";
// 重构前变量名: Kt（原导出名 d）
export { getLocalObject } from "./storage";
// 说明：setLocalObject / removeLocal 为内部使用；为保持与原始导出集合一致，此处不再从本模块导出

// 重构前变量名: Ki（原导出名 i）
export function initSentryForExtension(): void {
  // DSN 从编译产物还原（与原扩展一致）
  const DSN =
    "https://60bea3ee4ef1022e4035b23ba50f44d0@o1158394.ingest.us.sentry.io/4509876992278529";
  try {
    Sentry.init({
      dsn: DSN,
      // 与产物等价：扩展环境默认禁用（产物通过 Ni 检测扩展并置 enabled=false）
      enabled: typeof chrome !== "undefined" && !!chrome.runtime?.id ? false : undefined,
      // 对齐：使用默认堆栈解析与 Fetch 传输（与产物等价语义）
      stackParser: (Sentry as any).defaultStackParser,
      transport: (Sentry as any).makeFetchTransport,
      // 对齐：移除部分默认集成（产物过滤了 BrowserApiErrors/Breadcrumbs/GlobalHandlers）
      integrations(integrations: any[]) {
        const excluded = new Set([
          "BrowserApiErrors",
          "Breadcrumbs",
          "GlobalHandlers",
        ]);
        return integrations.filter((i) => !excluded.has(i?.name));
      },
      // 与产物 beforeSend 一致：附加扩展上下文
      beforeSend(event) {
        const ctx = event.contexts || {};
        const version = chrome.runtime.getManifest().version;
        event.contexts = {
          ...ctx,
          extension: {
            id: chrome.runtime.id,
            version,
            environment: "production", // 产物中写死 production；非 prod 环境可自行调整
          },
        };
        return event;
      },
    });
  } catch {
    // 初始化失败不阻塞扩展
  }
}

let __statsig__: StatsigClient | null = null;

// ===== 环境配置（还原自编译产物 p()） =====
const DEV_OAUTH = {
  AUTHORIZE_URL: "https://claude.ai/oauth/authorize",
  TOKEN_URL: "https://console.anthropic.com/v1/oauth/token",
  SCOPES_STR: "user:profile user:inference",
  CLIENT_ID: "54511e87-7abf-4923-9d84-d6f24532e871",
  REDIRECT_URI:
    "chrome-extension://aodaaaaehghpnpceiagoejlhplogbfen/oauth_callback.html",
};
const PROD_OAUTH = {
  ...DEV_OAUTH,
  CLIENT_ID: "dae2cad8-15c5-43d2-9046-fcaecc135fa4",
  REDIRECT_URI:
    "chrome-extension://aodaaaaehghpnpceiagoejlhplogbfen/oauth_callback.html",
};
const KEYMAP = {
  production: {
    STATSIG_CLIENT_API_KEY:
      "client-CyitfCoKlr6QZ2BXVfDZ3aDIE2fvWh4DTd4CIegPYQ8",
    SEGMENT_WRITE_KEY: "H7hVDRIBUrlBySLqJ15oAivgqhomdAKT",
  },
  development: {
    STATSIG_CLIENT_API_KEY:
      "client-FFBic9L5QkZYsnRDrIAvTimKS998hznw31H6KPBciH8",
    SEGMENT_WRITE_KEY: "hNex10EGp3coubOXQI1BIElYaZcA1o0u",
  },
};
export type EnvConfig = {
  environment: "production" | "development";
  apiBaseUrl: string;
  statsigClientApiKey: string;
  segmentWriteKey: string;
  oauth: typeof DEV_OAUTH;
};
// 重构前变量名: s（原导出名 b）
export function getEnvConfig(): EnvConfig {
  // 与产物一致：固定为 production
  const environment: "production" | "development" = "production";
  const keys = KEYMAP[environment];
  const oauth = environment === "production" ? PROD_OAUTH : DEV_OAUTH;
  return {
    environment,
    apiBaseUrl: "https://api.anthropic.com",
    statsigClientApiKey: keys.STATSIG_CLIENT_API_KEY,
    segmentWriteKey: keys.SEGMENT_WRITE_KEY,
    oauth,
  };
}

// 自定义 API 基础地址（优先读取本地配置，其次使用环境默认值）
export async function getApiBaseUrl(): Promise<string> {
  try {
    const custom = await getLocalValue<string>(StorageKey.ANTHROPIC_API_URL);
    if (typeof custom === "string") {
      const trimmed = custom.trim();
      if (trimmed) return trimmed;
    }
  } catch {
    // 读取失败时退回默认地址
  }
  return getEnvConfig().apiBaseUrl;
}

function getExtensionVersion(): string {
  try {
    return chrome.runtime.getManifest().version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// ===== 令牌与用户信息（还原 Yt/Jt/Xt/Qt/Vt/Gt 等） =====
async function writeTokens(
  payload: { accessToken?: string; refreshToken?: string; expiresAt?: number },
  state?: string
): Promise<void> {
  // 重构前变量名: Jt（内部）
  await setLocalObject({
    [StorageKey.ACCESS_TOKEN]: payload.accessToken,
    [StorageKey.REFRESH_TOKEN]: payload.refreshToken,
    [StorageKey.TOKEN_EXPIRY]: payload.expiresAt,
    [StorageKey.OAUTH_STATE]: state,
  });
}

async function refreshAccessToken(
  refreshToken: string,
  oauth: typeof DEV_OAUTH
): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  error?: string;
}> {
  try {
    const resp = await fetch(oauth.TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: oauth.CLIENT_ID,
        refresh_token: refreshToken,
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return {
        success: false,
        error: `Token refresh failed: ${resp.status} ${txt}`,
      };
    }
    const json: any = await resp.json();
    if (json.error)
      return { success: false, error: json.error_description || json.error };
    const expiresAt = json.expires_in
      ? Date.now() + json.expires_in * 1000
      : undefined;
    return {
      success: true,
      accessToken: json.access_token,
      refreshToken: json.refresh_token || refreshToken,
      expiresAt,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Network error during token refresh",
    };
  }
}

// 重构前变量名: Xt（原导出名 c）
export async function ensureValidAccessToken(): Promise<{
  isValid: boolean;
  isRefreshed: boolean;
}> {
  try {
    const tokens = await getLocalObject<Record<string, any>>([
      StorageKey.ACCESS_TOKEN,
      StorageKey.REFRESH_TOKEN,
      StorageKey.TOKEN_EXPIRY,
    ]);
    if (!tokens[StorageKey.ACCESS_TOKEN])
      return { isValid: false, isRefreshed: false };
    const now = Date.now();
    const expiry = tokens[StorageKey.TOKEN_EXPIRY] as number | undefined;
    const isValid = !!expiry && now < expiry;
    if (!(!!expiry && now >= expiry - 36e5))
      return { isValid, isRefreshed: false };
    if (!tokens[StorageKey.REFRESH_TOKEN])
      return { isValid, isRefreshed: false };
    const env = getEnvConfig();
    for (let a = 0; a < 3; a++) {
      const t = await refreshAccessToken(
        tokens[StorageKey.REFRESH_TOKEN],
        env.oauth
      );
      if (t.success) {
        await writeTokens(t);
        return { isValid: true, isRefreshed: true };
      }
      if (a === 2) {
        await removeLocal([
          StorageKey.ACCESS_TOKEN,
          StorageKey.REFRESH_TOKEN,
          StorageKey.TOKEN_EXPIRY,
        ]);
        return { isValid, isRefreshed: false };
      }
    }
    return { isValid, isRefreshed: false };
  } catch {
    return { isValid: false, isRefreshed: false };
  }
}

// 重构前变量名: Qt（原导出名 g）
export async function getAccessToken(): Promise<string | undefined> {
  const status = await ensureValidAccessToken();
  if (!status.isValid) return undefined;
  return (
    (await getLocalObject<Record<string, string>>([StorageKey.ACCESS_TOKEN]))[
      StorageKey.ACCESS_TOKEN
    ] || undefined
  );
}

// 重构前变量名: Vt（内部 fetchProfile）
async function fetchProfile(): Promise<any | null> {
  try {
    const token = await getAccessToken();
    if (!token) return null;
    const baseUrl = await getApiBaseUrl();
    const resp = await fetch(`${baseUrl}/api/oauth/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

// 重构前变量名: Ht（内部）
async function buildStatsigUserFromProfile(
  profile: any | null
): Promise<StatsigUser> {
  const anon = await getAnonymousId();
  const version = getExtensionVersion();
  if (profile) {
    return {
      userID: profile.account?.uuid,
      customIDs: {
        anonymousID: anon,
        organizationID: profile.organization?.uuid,
        organizationUUID: profile.organization?.uuid,
        applicationSlug: "claude-browser-use",
      },
      custom: {
        extensionVersion: version,
        isMax: profile.account?.has_claude_max,
        isPro: profile.account?.has_claude_pro,
        orgType: profile.organization?.organization_type,
      },
      privateAttributes: { email: profile.account?.email },
    };
  }
  return {
    customIDs: { anonymousID: anon },
    custom: { extensionVersion: version },
  };
}

// 重构前变量名: Wt（原导出名 f）
export async function initStatsig(): Promise<void> {
  if (__statsig__) return;
  try {
    const mockEnabled = await getLocalValue<boolean>(
      StorageKey.MOCK_STATSIG_ENABLED,
    );
    if (mockEnabled) {
      return;
    }
  } catch {
    // ignore storage read issues
  }
  const env = getEnvConfig();
  try {
    const profile = await fetchProfile();
    const user = await buildStatsigUserFromProfile(profile);
    const tier =
      env.environment === "production" ? "production" : "development";
    __statsig__ = new StatsigClient(env.statsigClientApiKey || "", user, {
      environment: { tier },
    });
    await __statsig__.initializeAsync();
  } catch {
    // 与产物一致：失败时保持当前实例引用
  }
}

// PKCE 工具（与编译产物逻辑等价）
function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64Url(new Uint8Array(digest));
}

// 重构前变量名: tn（原导出名 e）
export async function startOAuthFlow(): Promise<void> {
  const env = getEnvConfig();
  const state = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const codeVerifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const codeChallenge = await sha256Base64Url(codeVerifier);
  await setLocalObject({
    [StorageKey.OAUTH_STATE]: state,
    [StorageKey.CODE_VERIFIER]: codeVerifier,
  });

  const qs = new URLSearchParams({
    client_id: env.oauth.CLIENT_ID,
    response_type: "code",
    scope: env.oauth.SCOPES_STR,
    redirect_uri: env.oauth.REDIRECT_URI,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  const url = `${env.oauth.AUTHORIZE_URL}?${qs.toString()}`;
  chrome.tabs.create({ url });
}

// 重构前变量名: zt（内部），en 调用；清理存储
async function clearAllButWhitelist(): Promise<void> {
  // 与产物等价：仅移除枚举中定义的键，且保留 anonymousId 与 updateAvailable
  const preserved = new Set<string>([
    StorageKey.ANONYMOUS_ID,
    StorageKey.UPDATE_AVAILABLE,
  ]);
  const toRemove = (Object.values(StorageKey) as string[]).filter(
    (k) => !preserved.has(k)
  );
  if (toRemove.length) await removeLocal(toRemove);
}

// 重构前变量名: en（原导出名 h）
export async function clearStorageForLogout(): Promise<void> {
  await clearAllButWhitelist();
}

// 重构前变量名: Zt（原导出名 j）
export async function handleOAuthRedirect(
  redirectUri: string,
  tabId?: number
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const usp = new URLSearchParams(new URL(redirectUri).search);
    const code = usp.get("code");
    const error = usp.get("error");
    const errorDesc = usp.get("error_description");
    const state = usp.get("state") || "";

    if (error) {
      return {
        success: false,
        error: `Authentication failed: ${error}${
          errorDesc ? " - " + errorDesc : ""
        }`,
      };
    }
    if (!code)
      return { success: false, error: "No authorization code received" };

    const codeVerifier =
      (
        await getLocalObject<Record<string, string>>([StorageKey.CODE_VERIFIER])
      )[StorageKey.CODE_VERIFIER] || "";
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: getEnvConfig().oauth.CLIENT_ID,
      code,
      redirect_uri: getEnvConfig().oauth.REDIRECT_URI,
      state,
      code_verifier: codeVerifier,
    });

    const resp = await fetch(getEnvConfig().oauth.TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return {
        success: false,
        error: `Token exchange failed: ${resp.status} ${txt}`,
      };
    }
    const json: any = await resp.json();
    if (json.error) {
      return { success: false, error: json.error_description || json.error };
    }
    const expiresAt = json.expires_in
      ? Date.now() + json.expires_in * 1000
      : undefined;
    await writeTokens(
      {
        accessToken: json.access_token,
        refreshToken: json.refresh_token,
        expiresAt,
      },
      state || undefined
    );

    // 登录后更新 Statsig 用户（与产物一致：拉取 profile 再 updateUser）
    if (__statsig__) {
      try {
        const profile = await fetchProfile();
        const user = await buildStatsigUserFromProfile(profile);
        // 新版 SDK：updateUser（Promise），取代旧的 updateUserAsync
        await __statsig__!.updateUser(user);
      } catch {
        // Statsig 更新失败不影响主流程
      }
    }

    // 读取动态配置 extension_landing_page_url.relative_url，拼接为跳转地址
    let url = "https://claude.ai";
    try {
      // 新版 SDK：getConfig 取代 getDynamicConfig；DynamicConfig 使用 getValue 读取
      const config = __statsig__?.getConfig("extension_landing_page_url");
      const rel = config?.getValue("relative_url", "") ?? "";
      if (rel) url = `https://claude.ai${rel}`;
    } catch {}
    if (tabId)
      await new Promise<void>((resolve) =>
        chrome.tabs.update(tabId, { url }, () => resolve())
      );
    return { success: true, message: "Authentication successful!" };
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || "An unexpected error occurred during authentication",
    };
  }
}
