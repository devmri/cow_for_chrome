
import { getAccessToken, getEnvConfig } from './sentryService'

type Category = 'category0' | 'category1' | 'category2' | 'category3' | undefined

function normalizeNetloc(input: string): string {
  try {
    const u = new URL(input.startsWith('http') ? input : `https://${input}`)
    return u.hostname.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '')
  } catch {
    return ''
  }
}

class DomainCategoryService {
  private cache = new Map<string, { category: Category; ts: number }>()
  private pending = new Map<string, Promise<Category | undefined>>()
  private readonly TTL = 5 * 60 * 1000 // 5min

  async getCategory(url: string): Promise<Category> {
    const netloc = normalizeNetloc(url)
    if (!netloc) return undefined
    const cached = this.cache.get(netloc)
    if (cached) {
      if (Date.now() - cached.ts <= this.TTL) return cached.category
      this.cache.delete(netloc)
    }
    const p = this.pending.get(netloc)
    if (p) return p
    const task = this.fetchCategoryFromAPI(netloc)
    this.pending.set(netloc, task)
    try {
      return await task
    } finally {
      this.pending.delete(netloc)
    }
  }

  private async fetchCategoryFromAPI(netloc: string): Promise<Category> {
    try {
      const token = await getAccessToken()
      if (!token) return undefined
      const base = 'https://api.anthropic.com'
      const url = new URL('/api/web/domain_info/browser_extension', base)
      url.searchParams.set('domain', netloc)
      const resp = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!resp.ok) return undefined
      const json = (await resp.json()) as { category?: Category }
      const cat = json.category
      this.cache.set(netloc, { category: cat, ts: Date.now() })
      return cat
    } catch {
      return undefined
    }
  }

  clearCache() {
    this.cache.clear()
  }
  evictFromCache(netloc: string) {
    this.cache.delete(normalizeNetloc(netloc))
  }
  getCacheSize() {
    return this.cache.size
  }
}

export const domainCategory = new DomainCategoryService()

