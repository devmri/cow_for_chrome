import { getAccessToken } from "../../../lib/sentryService";
import { getHostname, normalizeDomain } from "../utils/url";

interface CacheEntry {
  category: string;
  timestamp: number;
}

class DomainCategoryCache {
  private static cache = new Map<string, CacheEntry>();
  private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private static pendingRequests = new Map<string, Promise<string | undefined>>();

  public static async getCategory(
    url: string,
  ): Promise<string | undefined> {
    const normalizedDomain = normalizeDomain(getHostname(url));
    const cached = this.cache.get(normalizedDomain);

    if (cached) {
      if (Date.now() - cached.timestamp <= this.CACHE_TTL_MS) {
        return cached.category;
      }
      this.cache.delete(normalizedDomain);
    }

    const pending = this.pendingRequests.get(normalizedDomain);
    if (pending) {
      return pending;
    }

    const fetchPromise = this.fetchCategoryFromAPI(normalizedDomain);
    this.pendingRequests.set(normalizedDomain, fetchPromise);

    try {
      return await fetchPromise;
    } finally {
      this.pendingRequests.delete(normalizedDomain);
    }
  }

  private static async fetchCategoryFromAPI(
    domain: string,
  ): Promise<string | undefined> {
    const accessToken = await getAccessToken();
    if (accessToken) {
      try {
        const apiUrl = new URL(
          "/api/web/domain_info/browser_extension",
          "https://api.anthropic.com",
        );
        apiUrl.searchParams.append("domain", domain);

        const response = await fetch(apiUrl.toString(), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          return undefined;
        }

        const data = await response.json();
        this.cache.set(domain, {
          category: data.category,
          timestamp: Date.now(),
        });
        return data.category;
      } catch (error) {
        return undefined;
      }
    }
    return undefined;
  }

  public static clearCache(): void {
    this.cache.clear();
  }

  public static evictFromCache(url: string): void {
    const normalizedDomain = normalizeDomain(url);
    this.cache.delete(normalizedDomain);
  }

  public static getCacheSize(): number {
    return this.cache.size;
  }
}

export { DomainCategoryCache };
