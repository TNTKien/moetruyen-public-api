const POOL_CACHE_TTL_MS = 4 * 60 * 1000;
const POOL_CACHE_MAX_ENTRIES = 200;

interface PoolCacheEntry {
  ids: number[];
  expiresAt: number;
}

const poolCache = new Map<string, PoolCacheEntry>();
const inflightLoaders = new Map<string, Promise<number[]>>();

export const readRecommendationPool = (cacheKey: string): number[] | null => {
  const entry = poolCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    poolCache.delete(cacheKey);
    return null;
  }
  return entry.ids;
};

export const writeRecommendationPool = (cacheKey: string, ids: number[]): void => {
  trimCache();
  poolCache.set(cacheKey, { ids, expiresAt: Date.now() + POOL_CACHE_TTL_MS });
};

export const getOrLoadPool = async (cacheKey: string, loader: () => Promise<number[]>): Promise<number[]> => {
  const cached = readRecommendationPool(cacheKey);
  if (cached) return cached;

  const inflight = inflightLoaders.get(cacheKey);
  if (inflight) return inflight;

  const promise = loader().then((ids) => {
    writeRecommendationPool(cacheKey, ids);
    return ids;
  });

  inflightLoaders.set(cacheKey, promise);

  try {
    return await promise;
  } finally {
    if (inflightLoaders.get(cacheKey) === promise) {
      inflightLoaders.delete(cacheKey);
    }
  }
};

const trimCache = (): void => {
  if (poolCache.size <= POOL_CACHE_MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of poolCache.entries()) {
    if (now > entry.expiresAt) poolCache.delete(key);
    if (poolCache.size <= POOL_CACHE_MAX_ENTRIES) return;
  }
  for (const key of poolCache.keys()) {
    poolCache.delete(key);
    if (poolCache.size <= POOL_CACHE_MAX_ENTRIES) return;
  }
};
