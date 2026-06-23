/**
 * VaekstNet — Fetch QR redirect stats from WordPress REST API
 *
 * One endpoint returns all three QR sources (CARD, WEB, MAGAZINES) for a
 * given day in a single call — see vaekstnet-card-stats-api.php (v1.1.0+).
 *
 * Env vars (set in Vercel project settings):
 *   WORDPRESS_API_BASE_URL  →  e.g. https://YOUR-WORDPRESS-DOMAIN.com
 *   WORDPRESS_API_KEY       →  must match the key configured in
 *                              vaekstnet-card-stats-api.php on the WordPress side
 */

export type WpStatsDay = {
  stat_date: string // YYYY-MM-DD
  ios: number
  android: number
  fallback: number
}

export type WpSourceBlock = {
  "QR-source": string // "CARD" | "WEB" | "MAGAZINES"
  stats: WpStatsDay[]
}

export type WpQrStatsResponse = {
  date: string
  sources: WpSourceBlock[]
}

export async function fetchQrStats(date: string | null = null): Promise<WpQrStatsResponse> {
  const rawBase = process.env.WORDPRESS_API_BASE_URL
  const apiKey = process.env.WORDPRESS_API_KEY

  if (!rawBase || !apiKey) {
    throw new Error("WORDPRESS_API_BASE_URL / WORDPRESS_API_KEY are not configured")
  }

  // Strip any trailing slash(es) so we don't end up with a double slash
  // before /wp-json — WordPress/Nginx routing can 404 on that.
  const base = rawBase.replace(/\/+$/, "")

  // Build URL — optionally pass a date string (YYYY-MM-DD) to query a specific day.
  // Without a date, the endpoint defaults to today.
  const url = new URL(`${base}/wp-json/vaekstnet/v1/card-stats`)
  if (date) url.searchParams.set("date", date)

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`WordPress API error: ${response.status} ${response.statusText} (${url.toString()})`)
  }

  const raw = await response.json()

  // Multi-source shape (current plugin, v1.1.0+): { date, sources: [...] }
  if (Array.isArray(raw?.sources)) {
    return raw as WpQrStatsResponse
  }

  // Legacy single-source shape: { "QR-source": "CARD", date, stats: [...] }
  if (raw?.["QR-source"] && Array.isArray(raw?.stats)) {
    return {
      date: raw.date,
      sources: [{ "QR-source": raw["QR-source"], stats: raw.stats }],
    }
  }

  return { date: raw?.date ?? date ?? "", sources: [] }
}
