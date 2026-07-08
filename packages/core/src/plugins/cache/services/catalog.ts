/**
 * URL Catalog — tracks cache-eligible API requests for smart pre-warming.
 * Per-isolate, in-memory. Resets on isolate eviction. Bounded to MAX_CATALOG_SIZE.
 */

const MAX_CATALOG_SIZE = 500

export interface CatalogEntry {
  cacheKey: string
  collection: string | null
  path: string
  queryString: string
  hits: number
  misses: number
  staleServes: number
  lastSeen: number
  firstSeen: number
}

const catalog = new Map<string, CatalogEntry>()

export function recordCatalogRequest(opts: {
  cacheKey: string
  collection: string | null
  path: string
  queryString: string
  source: 'memory' | 'kv' | 'miss' | 'swr'
}): void {
  const { cacheKey, collection, path, queryString, source } = opts
  const now = Date.now()
  const existing = catalog.get(cacheKey)
  if (existing) {
    if (source === 'miss') existing.misses++
    else if (source === 'swr') existing.staleServes++
    else existing.hits++
    existing.lastSeen = now
    return
  }
  // Evict oldest entry when at capacity
  if (catalog.size >= MAX_CATALOG_SIZE) {
    let oldestKey = ''
    let oldestSeen = Infinity
    for (const [k, e] of catalog.entries()) {
      if (e.lastSeen < oldestSeen) { oldestSeen = e.lastSeen; oldestKey = k }
    }
    if (oldestKey) catalog.delete(oldestKey)
  }
  catalog.set(cacheKey, {
    cacheKey,
    collection,
    path,
    queryString,
    hits: source !== 'miss' && source !== 'swr' ? 1 : 0,
    misses: source === 'miss' ? 1 : 0,
    staleServes: source === 'swr' ? 1 : 0,
    lastSeen: now,
    firstSeen: now,
  })
}

export function getCatalog(opts?: {
  collection?: string
  sortBy?: 'hits' | 'requests' | 'misses'
  limit?: number
}): CatalogEntry[] {
  let entries = Array.from(catalog.values())
  if (opts?.collection) entries = entries.filter(e => e.collection === opts.collection)
  const sortBy = opts?.sortBy ?? 'requests'
  entries.sort((a, b) => {
    if (sortBy === 'hits') return b.hits - a.hits
    if (sortBy === 'misses') return b.misses - a.misses
    return (b.hits + b.misses + b.staleServes) - (a.hits + a.misses + a.staleServes)
  })
  return entries.slice(0, opts?.limit ?? 100)
}

export function getCatalogStats() {
  const entries = Array.from(catalog.values())
  return {
    totalEntries: entries.length,
    totalHits: entries.reduce((s, e) => s + e.hits, 0),
    totalMisses: entries.reduce((s, e) => s + e.misses, 0),
    totalStale: entries.reduce((s, e) => s + e.staleServes, 0),
    collections: [...new Set(entries.map(e => e.collection).filter((c): c is string => c !== null))],
  }
}

export function clearCatalog(): void {
  catalog.clear()
}
