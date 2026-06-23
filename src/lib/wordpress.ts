/**
 * VaekstNet — Fetch card stats from WordPress REST API
 *
 * Env vars (set in Vercel project settings):
 *   WORDPRESS_API_BASE_URL  →  e.g. https://YOUR-WORDPRESS-DOMAIN.com
 *   WORDPRESS_API_KEY       →  must match the key configured in
 *                              vaekstnet-card-stats-api.php on the WordPress side
 */

export type WpCardStatsDay = {
  stat_date: string // YYYY-MM-DD
  ios: number
  android: number
  fallback: number
}

export type WpCardStatsResponse = {
  "QR-source": string
  date: string
  stats: WpCardStatsDay[]
}

export async function fetchCardStats(date: string | null = null): Promise<WpCardStatsResponse> {
  const base = process.env.WORDPRESS_API_BASE_URL
  const apiKey = process.env.WORDPRESS_API_KEY

  if (!base || !apiKey) {
    throw new Error("WORDPRESS_API_BASE_URL / WORDPRESS_API_KEY are not configured")
  }

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
    throw new Error(`WordPress API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}
