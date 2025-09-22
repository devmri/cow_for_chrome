import { useCallback, useEffect, useState } from "react";
import { getLocalValue, StorageKey } from "../lib/storage";
import { ensureValidAccessToken, getAccessToken } from "../lib/sentryService";

export interface UseAuthTokensResult {
  authToken?: string;
  needsOAuth: boolean;
  isLoading: boolean;
  anthropicApiKey?: string;
  anthropicApiUrl?: string;
  refreshTokenIfNeeded: () => Promise<void>;
}

/**
 * 读取/监听认证令牌与 Anthropic API Key 的 Hook，逻辑与编译产物等价。
 * 重构前变量名: Jc（useAuthTokens）
 */
export function useAuthTokens(): UseAuthTokensResult {
  const [needsOAuth, setNeedsOAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);
  const [anthropicApiKey, setAnthropicApiKey] = useState<string | undefined>(
    undefined
  );
  const [anthropicApiUrl, setAnthropicApiUrl] = useState<string | undefined>(
    undefined,
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const [token, apiKey, apiUrl] = await Promise.all([
      getAccessToken(),
      getLocalValue<string>(StorageKey.ANTHROPIC_API_KEY),
      getLocalValue<string>(StorageKey.ANTHROPIC_API_URL),
    ]);
    setNeedsOAuth(token === undefined);
    setAuthToken(token);
    setAnthropicApiKey(apiKey || undefined);
    setAnthropicApiUrl(apiUrl?.trim() ? apiUrl.trim() : undefined);
    setIsLoading(false);
  }, []);

  const refreshTokenIfNeeded = useCallback(async () => {
    const { isRefreshed } = await ensureValidAccessToken();
    if (isRefreshed) {
      const token = await getAccessToken();
      setAuthToken(token);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === "local") {
        const keys = [
          StorageKey.ACCESS_TOKEN,
          StorageKey.REFRESH_TOKEN,
          StorageKey.TOKEN_EXPIRY,
          StorageKey.ANTHROPIC_API_KEY,
          StorageKey.ANTHROPIC_API_URL,
        ];
        if (keys.some((k) => k in changes)) refresh();
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [refresh]);

  return {
    authToken,
    needsOAuth,
    isLoading,
    anthropicApiKey,
    anthropicApiUrl,
    refreshTokenIfNeeded,
  };
}
