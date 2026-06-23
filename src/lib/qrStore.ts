const UPSTASH_URL   = process.env.KV_REST_API_URL
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN
const CACHE_KEY = "vk-qr-scans"

export type ScanRecord = {
  timestamp: string // ISO
  device: "iOS" | "Android" | "Desktop" | "Other"
  os: string
  location: string
  origin: "csv" | "auto"
}

export type QrSource = {
  records: ScanRecord[]
  uploadedAt: string | null
}

export type QrStore = {
  website: QrSource
  card: QrSource
  cardAutoSync: {
    lastSyncedAt: string | null
    lastError: string | null
  }
}

export const emptyQrStore = (): QrStore => ({
  website: { records: [], uploadedAt: null },
  card:    { records: [], uploadedAt: null },
  cardAutoSync: { lastSyncedAt: null, lastError: null },
})

let memCache: QrStore | null = null

export async function readQrStore(): Promise<QrStore> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return memCache ?? emptyQrStore()
  const res = await fetch(`${UPSTASH_URL}/get/${CACHE_KEY}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    cache: "no-store",
  })
  const json = await res.json()
  if (!json.result) return emptyQrStore()
  let value = json.result
  while (typeof value === "string") value = JSON.parse(value)
  return { ...emptyQrStore(), ...(value as QrStore) }
}

export async function writeQrStore(data: QrStore): Promise<void> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) { memCache = data; return }
  await fetch(`${UPSTASH_URL}/set/${CACHE_KEY}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(JSON.stringify(data)),
    cache: "no-store",
  })
}
