// High-performance client-side memory cache for instant tab transitions (<10ms)
const cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL_MS = 10000; // 10 seconds cache TTL for instant tab switches

export async function fetchWithCache(url: string, headers?: Record<string, string>, forceFresh = false): Promise<any> {
  const now = Date.now();
  if (!forceFresh && cache[url] && (now - cache[url].timestamp < CACHE_TTL_MS)) {
    return cache[url].data;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (cache[url]) return cache[url].data;
    throw new Error(`Failed to fetch ${url}`);
  }

  const data = await res.json();
  cache[url] = { data, timestamp: now };
  return data;
}

export function getCachedData(url: string): any | null {
  return cache[url]?.data || null;
}

export function clearDataCache(): void {
  Object.keys(cache).forEach(key => delete cache[key]);
}
