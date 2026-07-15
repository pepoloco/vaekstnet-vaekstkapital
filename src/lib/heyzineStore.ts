const UPSTASH_URL   = process.env.KV_REST_API_URL
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN
const CACHE_KEY = "vk-heyzine-stats"

export type HeyzineDay = {
  date: string        // YYYY-MM-DD
  visits: number
  visitors: number
  duration: number    // seconds
}

export type HeyzineStore = {
  days: HeyzineDay[]
  uploadedAt: string | null
}

export const emptyHeyzineStore = (): HeyzineStore => ({ days: [], uploadedAt: null })

let memCache: HeyzineStore | null = null

export async function readHeyzineStore(): Promise<HeyzineStore> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return memCache ?? emptyHeyzineStore()
  const res = await fetch(`${UPSTASH_URL}/get/${CACHE_KEY}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    cache: "no-store",
  })
  const json = await res.json()
  if (!json.result) return emptyHeyzineStore()
  let value = json.result
  while (typeof value === "string") value = JSON.parse(value)
  return { ...emptyHeyzineStore(), ...(value as HeyzineStore) }
}

export async function writeHeyzineStore(data: HeyzineStore): Promise<void> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) { memCache = data; return }
  await fetch(`${UPSTASH_URL}/set/${CACHE_KEY}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(JSON.stringify(data)),
    cache: "no-store",
  })
}
