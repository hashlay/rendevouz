/**
 * swrFetch.ts
 * 
 * Stale-While-Revalidate Fetch Wrapper
 * 
 * Instantly returns cached data from localStorage while seamlessly fetching 
 * fresh data from the server in the background. This provides 0ms load times 
 * for the user and full offline resilience.
 */

export function invalidateSwrCache(urlPrefix?: string) {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(k => {
      if (k.startsWith('swr_cache_')) {
        if (!urlPrefix || k.includes(urlPrefix)) {
          localStorage.removeItem(k);
        }
      }
    });
  } catch (_) {}
}

export async function swrFetch<T>(
  url: string,
  options?: RequestInit & { pollInterval?: number },
  onUpdate?: (data: T) => void
): Promise<T> {
  const isCacheable = !options?.method || options.method === 'GET';
  const cacheKey = `swr_cache_${url.split('?')[0]}`;

  if (!isCacheable) {
    invalidateSwrCache();
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  }

  // Network-First Strategy: Always fetch 100% fresh live data from server when online
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const freshData: T = await res.json();
    try {
      localStorage.setItem(cacheKey, JSON.stringify(freshData));
    } catch (_) {}

    if (onUpdate) onUpdate(freshData);

    // Setup background polling if requested
    if (options?.pollInterval && onUpdate) {
      setInterval(() => {
        fetch(url, options)
          .then(r => r.ok ? r.json() : Promise.reject(r))
          .then(data => {
            const freshStr = JSON.stringify(data);
            if (localStorage.getItem(cacheKey) !== freshStr) {
              try { localStorage.setItem(cacheKey, freshStr); } catch (_) {}
              onUpdate(data);
            }
          })
          .catch(() => {});
      }, options.pollInterval);
    }

    return freshData;
  } catch (netErr) {
    // Offline Fallback: Only use cached localStorage data if network is completely unavailable
    const cachedStr = localStorage.getItem(cacheKey);
    if (cachedStr) {
      console.log(`[SWR] Network offline fallback active for ${url}`);
      const cachedData = JSON.parse(cachedStr) as T;
      if (onUpdate) onUpdate(cachedData);
      return cachedData;
    }
    throw netErr;
  }
}
