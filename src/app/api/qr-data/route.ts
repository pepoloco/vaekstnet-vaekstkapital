import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

const UPSTASH_URL   = process.env.KV_REST_API_URL
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN
const CACHE_KEY = "vk-qr-scans"

const emptyStore = () => ({
  website: { records: [], uploadedAt: null },
  card:    { records: [], uploadedAt: null },
})

let memCache: unknown = null

async function readCache() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return memCache ?? emptyStore()
  const res = await fetch(`${UPSTASH_URL}/get/${CACHE_KEY}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    cache: "no-store",
  })
  const json = await res.json()
  if (!json.result) return emptyStore()
  let value = json.result
  while (typeof value === "string") value = JSON.parse(value)
  return value
}

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const data = await readCache()
  return NextResponse.json(data)
}
