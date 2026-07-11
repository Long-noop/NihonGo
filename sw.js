/**
 * Service Worker for NihonGo PWA
 * Caches static assets, data, and handles offline fallback
 *
 * Strategy:
 * - Static assets (HTML, CSS, fonts): Cache-first
 * - Data JSON pages: Cache-first with fallback
 * - KanjiVG SVGs: Network-first with cache fallback
 */

const STATIC_CACHE = "nihongo-static-v2";
const DATA_CACHE = "nihongo-data-v1";
const KANJIVG_CACHE = "nihongo-kanjivg-v1";

// Assets to precache on install
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./asserts/styles.css",
  "./asserts/fonts.css",
  "./asserts/samurai.png",
  "./manifest.json",
  "./search.js",
  // Font files (will attempt to cache, but won't fail if not available)
  "./asserts/fonts/v15-rg-kR9Q9UFVG-xI5L5RivnA-Xg.woff2",
  "./asserts/fonts/v15-rg-kR9Q9UFVG-xI5L5RivnA-Xw.woff2",
  "./asserts/fonts/v15-rg-kR9Q9UFVG-xI5L5RivnA-Zw.woff2",
  "./asserts/fonts/v52-_Xmo9KwMn-Kz-Y4DJGDq.0.woff2",
  "./asserts/fonts/v52-_Xmo9KwMn-Kz-Y4D6GDq.0.woff2",
  "./asserts/fonts/UcCO3FwrK3iLTeHAPUlsc3GT6pHPqEBVSZc.woff2",
  "./asserts/fonts/UcCO3FwrK3iLTeHAPUlsc3GT6pHPqEBgSZc.woff2",
  "./asserts/fonts/UcCO3FwrK3iLTeHAPUlsc3GT6pHPqEBUVZc.woff2",
  "./asserts/fonts/UcCO3FwrK3iLTeHAPUlsc3GT6pHPqEBZVZc.woff2",
];

// Data pages to precache
const DATA_ASSETS = [
  "./data/kanji-sample.json",
  "./data/index.json",
  "./data/pages/page-1.json",
  "./data/pages/page-2.json",
  "./data/pages/page-3.json",
  "./data/pages/page-4.json",
  "./data/pages/page-5.json",
  "./data/pages/page-6.json",
  "./data/pages/page-7.json",
  "./data/pages/page-8.json",
  "./data/pages/page-9.json",
  "./data/pages/page-10.json",
  "./data/pages/page-11.json",
  "./data/pages/page-12.json",
  "./data/pages/page-13.json",
  "./data/pages/page-14.json",
  "./data/pages/page-15.json",
  "./data/pages/page-16.json",
  "./data/pages/page-17.json",
  "./data/pages/page-18.json",
  "./data/pages/page-19.json",
  "./data/pages/page-20.json",
  "./data/pages/page-21.json",
  "./data/pages/page-22.json",
  "./data/pages/page-23.json",
  "./data/pages/page-24.json",
  "./data/pages/page-25.json",
  "./data/pages/page-26.json",
  "./data/pages/page-27.json",
];

/**
 * Install event: precache static assets and data
 */
self.addEventListener("install", (event) => {
  console.log("[SW] Installing...", STATIC_CACHE, DATA_CACHE);

  event.waitUntil(
    (async () => {
      try {
        // Precache static assets (including fonts)
        const staticCache = await caches.open(STATIC_CACHE);

        // Core assets - these must succeed
        const coreAssets = STATIC_ASSETS.filter(
          (url) => !url.includes("/fonts/"),
        );
        await staticCache.addAll(coreAssets);
        console.log("[SW] Core static assets cached");

        // Font files - cache individually to handle missing files gracefully
        const fontAssets = STATIC_ASSETS.filter((url) =>
          url.includes("/fonts/"),
        );
        for (const url of fontAssets) {
          try {
            await staticCache.add(url);
          } catch (err) {
            console.warn(
              `[SW] Font file not available (will use fallback): ${url}`,
            );
            // Continue - fonts.css has local() fallback
          }
        }
        console.log(`[SW] Cached ${fontAssets.length} font file references`);

        // Precache data files
        const dataCache = await caches.open(DATA_CACHE);

        // Cache each page JSON individually to handle failures gracefully
        for (const url of DATA_ASSETS) {
          try {
            await dataCache.add(url);
          } catch (err) {
            console.warn(`[SW] Failed to cache ${url}:`, err.message);
            // Continue with next file instead of failing entire install
          }
        }
        console.log("[SW] Data files cached");

        // Skip waiting — activate immediately
        self.skipWaiting();
      } catch (err) {
        console.error("[SW] Install failed:", err);
      }
    })(),
  );
});

/**
 * Activate event: clean up old caches
 */
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating...");

  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const cachesToDelete = cacheNames.filter((name) => {
        // Delete old versions of our caches
        return (
          name.startsWith("nihongo-") &&
          name !== STATIC_CACHE &&
          name !== DATA_CACHE &&
          name !== KANJIVG_CACHE
        );
      });

      await Promise.all(cachesToDelete.map((name) => caches.delete(name)));
      console.log("[SW] Old caches deleted:", cachesToDelete);

      // Claim all clients
      return self.clients.claim();
    })(),
  );
});

/**
 * Fetch event: implement cache-first strategy for static/data,
 * network-first for KanjiVG SVGs
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== "GET") {
    return;
  }

  // Ignore external URLs (fonts from CDN, etc.)
  if (
    !url.pathname.startsWith("./") &&
    !url.origin.includes(self.location.origin)
  ) {
    return;
  }

  // Handle KanjiVG SVG files (network-first)
  if (url.pathname.includes("/kanjivg/")) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(KANJIVG_CACHE);
            cache.put(request, response.clone());
            return response;
          }
        } catch (err) {
          console.log(
            "[SW] Network failed for KanjiVG, trying cache:",
            url.pathname,
          );
        }

        // Fallback to cache
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }

        // If not in cache and network failed, return error response
        return new Response("SVG not available offline", {
          status: 503,
          statusText: "Service Unavailable",
        });
      })(),
    );
    return;
  }

  // Handle static and data assets (cache-first)
  event.respondWith(
    (async () => {
      // Try cache first
      let response = await caches.match(request);
      if (response) {
        return response;
      }

      // Try network
      try {
        response = await fetch(request);

        // Cache successful responses
        if (response.ok) {
          const cache = await (url.pathname.includes("/pages/") ||
          url.pathname.includes("/data/")
            ? caches.open(DATA_CACHE)
            : caches.open(STATIC_CACHE));
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        console.warn("[SW] Fetch failed for", url.pathname, err.message);

        // Return offline fallback for HTML requests
        if (request.headers.get("accept")?.includes("text/html")) {
          const cached = await caches.match("./index.html");
          if (cached) {
            return cached;
          }
        }

        // Generic offline response
        return new Response("offline", {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "text/plain" },
        });
      }
    })(),
  );
});

console.log("[SW] Service Worker loaded");
