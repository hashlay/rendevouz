/**
 * swrFetch.ts
 * 
 * Direct Fetch Wrapper (Offline Cache Completely Removed)
 * Always fetches 100% fresh live data directly from the server.
 */

export function invalidateSwrCache(urlPrefix?: string) {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(k => {
      if (k.startsWith('swr_cache_')) {
        localStorage.removeItem(k);
      }
    });
  } catch (_) {}
}

export async function swrFetch<T>(
  url: string,
  options?: RequestInit & { pollInterval?: number },
  onUpdate?: (data: T) => void
): Promise<T> {
  invalidateSwrCache();
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  const freshData: T = await res.json();
  if (onUpdate) onUpdate(freshData);
  return freshData;
}
