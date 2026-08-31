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
  // Only cache GET requests
  const isCacheable = !options?.method || options.method === 'GET';
  
  // Clean URL to use as cache key (remove timestamp query params used for cache busting)
  const cacheKey = `swr_cache_${url.split('?')[0]}`;

  if (isCacheable) {
    const cachedStr = localStorage.getItem(cacheKey);
    if (cachedStr) {
      try {
        const cachedData = JSON.parse(cachedStr) as T;
        
        // Return cached data immediately, but still fetch in the background if onUpdate is provided
        if (onUpdate) {
          // Background fetch to revalidate
          fetch(url, options)
            .then(res => {
              if (res.ok) return res.json();
              throw new Error('Network response was not ok');
            })
            .then((freshData: T) => {
              // Update cache
              localStorage.setItem(cacheKey, JSON.stringify(freshData));
              // Update UI with fresh data
              onUpdate(freshData);
            })
            .catch(err => {
              console.warn(`[SWR] Background revalidate failed for ${url}:`, err);
            });
          
          return cachedData;
        }
      } catch (e) {
        console.warn(`[SWR] Failed to parse cache for ${url}`);
      }
    }
  }

  // Normal fetch if no cache or not cacheable
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const freshData = await res.json() as T;
    
    // Save to cache for next time
    if (isCacheable) {
      localStorage.setItem(cacheKey, JSON.stringify(freshData));
    }
    
    return freshData;
  } catch (err) {
    // If network fails completely and we have a cache, return the cache as a fallback
    if (isCacheable) {
      const fallbackCache = localStorage.getItem(cacheKey);
      if (fallbackCache) {
        console.log(`[SWR] Network failed, using offline fallback for ${url}`);
        return JSON.parse(fallbackCache) as T;
      }
    }
    throw err;
  }
}
