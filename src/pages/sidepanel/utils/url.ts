// 原始函数: td, nd, rd

/**
 * Extracts the hostname from a URL string.
 * @original td
 * @param url The URL string.
 * @returns The hostname, or an empty string if the URL is invalid.
 */
export function getHostname(url: string): string {
  if (!url.startsWith("http")) {
    url = `https://${url}`;
  }
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Normalizes a domain by converting to lowercase and removing protocol and path.
 * @original nd
 * @param domain The domain string.
 * @returns The normalized domain.
 */
export function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .replace(/\/.*$/, "");
}

/**
 * Checks if the domain has changed during an action and returns an error if so.
 * @original rd
 * @param tabId The ID of the tab.
 * @param originalUrl The URL at the start of the action.
 * @param actionName The name of the action being performed.
 * @returns An error object if the domain changed, otherwise null.
 */
export async function checkDomainChange(
  tabId: number,
  originalUrl: string | undefined,
  actionName: string,
): Promise<{ error: string } | null> {
  if (!originalUrl) {
    return null;
  }
  const currentTab = await chrome.tabs.get(tabId);
  if (!currentTab.url) {
    return { error: "Unable to verify current URL for security check" };
  }

  const originalHostname = getHostname(originalUrl);
  const currentHostname = getHostname(currentTab.url);

  if (originalHostname !== currentHostname) {
    return {
      error: `Security check failed: Domain changed from ${originalHostname} to ${currentHostname} during ${actionName}`,
    };
  }
  return null;
}
