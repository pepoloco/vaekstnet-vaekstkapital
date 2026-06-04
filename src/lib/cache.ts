const UPSTASH_URL   = process.env.KV_REST_API_URL
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN
const KEY = "vk-data"

// In-memory fallback when Upstash is not configured
let memCache: unknown = null

export async function readCache() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return memCache ?? null
  const res = await fetch(`${UPSTASH_URL}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    cache: "no-store",
  })
  const json = await res.json()
  if (!json.result) return null
  let value = json.result
  // Upstash sometimes double-encodes — unwrap until we have an object
  while (typeof value === "string") value = JSON.parse(value)
  return value
}

export async function writeCache(data: unknown): Promise<void> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    memCache = data
    return
  }
  await fetch(`${UPSTASH_URL}/set/${KEY}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(JSON.stringify(data)),
    cache: "no-store",
  })
}
