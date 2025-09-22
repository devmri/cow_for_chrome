
import {
  StorageKey,
  getLocalObject,
  setLocalObject,
  removeLocal,
  getAnonymousId,
  getLocalValue,
} from "./storage";
export { StorageKey } from "./storage";

export { setLocalKey } from "./storage";

export { getLocalValue } from "./storage";

export function initSentryForExtension(): void {
  // no-op
}

const DEV_OAUTH = {
  AUTHORIZE_URL: "https://claude.ai/oauth/authorize",
  TOKEN_URL: "https://console.anthropic.com/v1/oauth/token",
  SCOPES_STR: "user:profile user:inference",
  CLIENT_ID: "54511e87-7abf-4923-9d84-d6f24532e871",
  REDIRECT_URI:
  // 改成自己的扩展id
    "chrome-extension://cmikgmijoglgopnlbhjjpoipebhlbmoa/oauth_callback.html",
};
const PROD_OAUTH = {
  ...DEV_OAUTH,
  CLIENT_ID: "dae2cad8-15c5-43d2-9046-fcaecc135fa4",
  REDIRECT_URI:
  // 改成自己的扩展id
    "chrome-extension://cmikgmijoglgopnlbhjjpoipebhlbmoa/oauth_callback.html",
};
const KEYMAP = { production: {}, development: {} };
export type EnvConfig = {
  environment: "production" | "development";
  apiBaseUrl: string;
  oauth: typeof DEV_OAUTH;
};

export function getEnvConfig(): EnvConfig {
  const environment: "production" | "development" = "production";
  const keys = KEYMAP[environment];
  const oauth = environment === "production" ? PROD_OAUTH : DEV_OAUTH;
  return {
    environment,
    apiBaseUrl: "https://api.anthropic.com",
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

async function writeTokens(
  payload: { accessToken?: string; refreshToken?: string; expiresAt?: number },
  state?: string
): Promise<void> {
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

export async function getAccessToken(): Promise<string | undefined> {
  const status = await ensureValidAccessToken();
  if (!status.isValid) return undefined;
  return (
    (await getLocalObject<Record<string, string>>([StorageKey.ACCESS_TOKEN]))[
      StorageKey.ACCESS_TOKEN
    ] || undefined
  );
}

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

export async function initStatsig(): Promise<void> {
  // no-op
}

// PKCE 工具
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

async function clearAllButWhitelist(): Promise<void> {
  const preserved = new Set<string>([
    StorageKey.ANONYMOUS_ID,
    StorageKey.UPDATE_AVAILABLE,
  ]);
  const toRemove = (Object.values(StorageKey) as string[]).filter(
    (k) => !preserved.has(k)
  );
  if (toRemove.length) await removeLocal(toRemove);
}

export async function clearStorageForLogout(): Promise<void> {
  await clearAllButWhitelist();
}

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

    let url = "https://claude.ai";
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
