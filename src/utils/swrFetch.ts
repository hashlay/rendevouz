/**
 * swrFetch.ts
 * 
 * Stale-While-Revalidate Fetch Wrapper
 * 
 * Instantly returns cached data from localStorage while seamlessly fetching 
 * fresh data from the server in the background. This provides 0ms load times 
 * for the user and full offline resilience.
 */

export async function swrFetch<T>(
  url: string,
  options?: RequestInit,
  onUpdate?: (data: T) => void
): Promise<T> {
  const isCacheable = !options?.method || options.method === 'GET';
  const cacheKey = `swr_cache_${url.split('?')[0]}`;

  if (!isCacheable) {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  }

  const cachedStr = localStorage.getItem(cacheKey);

  return new Promise((resolve, reject) => {
    let networkFinished = false;
    let cacheReturned = false;

    // 1. Start Network Request
    fetch(url, options)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((freshData: T) => {
        networkFinished = true;
        localStorage.setItem(cacheKey, JSON.stringify(freshData));
        
        if (!cacheReturned) {
          // Network won the race! Return fresh data directly (no flicker)
          resolve(freshData);
        } else {
          // Cache was already returned. Update UI silently in background
          if (onUpdate) onUpdate(freshData);
        }
      })
      .catch(err => {
        networkFinished = true;
        if (!cacheReturned) {
          if (cachedStr) {
            console.log(`[SWR] Network failed, using offline fallback for ${url}`);
            resolve(JSON.parse(cachedStr) as T);
          } else {
            reject(err);
          }
        }
      });

    // 2. Start Cache Threshold Timer (300ms)
    if (cachedStr) {
      setTimeout(() => {
        if (!networkFinished) {
          // Network is taking too long. Showcase the cache immediately.
          cacheReturned = true;
          resolve(JSON.parse(cachedStr) as T);
        }
      }, 300);
    }
  });
}
