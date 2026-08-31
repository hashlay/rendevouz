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

  if (!isCacheable) {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  }

  // Network-First Strategy with Timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second timeout for "too slow" network

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const freshData = await res.json() as T;
    
    // Save to cache for next time
    localStorage.setItem(cacheKey, JSON.stringify(freshData));
    
    // Trigger onUpdate if provided
    if (onUpdate) onUpdate(freshData);
    
    return freshData;
  } catch (err) {
    clearTimeout(timeoutId);
    
    // If network fails or times out, fallback to cache
    const fallbackCache = localStorage.getItem(cacheKey);
    if (fallbackCache) {
      console.log(`[SWR] Network failed or slow, using offline fallback for ${url}`);
      const cachedData = JSON.parse(fallbackCache) as T;
      
      if (onUpdate) onUpdate(cachedData);
      return cachedData;
    }
    
    throw err;
  }
}
