
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

export function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .replace(/\/.*$/, "");
}

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
