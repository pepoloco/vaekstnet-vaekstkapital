import { NextResponse } from "next/server"
import { fetchCardStats, type WpCardStatsDay } from "@/lib/wordpress"
import { readQrStore, writeQrStore, type ScanRecord } from "@/lib/qrStore"

export const maxDuration = 60

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

// Turn a day's aggregate { ios, android, fallback } counts into synthetic
// per-scan records so they merge cleanly with the existing chart/table logic.
function buildSyntheticRecords(day: WpCardStatsDay): ScanRecord[] {
  const records: ScanRecord[] = []
  const ts = `${day.stat_date}T12:00:00.000Z`

  for (let i = 0; i < (day.ios || 0); i++) {
    records.push({ timestamp: ts, device: "iOS", os: "iOS (auto-synced)", location: "—", origin: "auto" })
  }
  for (let i = 0; i < (day.android || 0); i++) {
    records.push({ timestamp: ts, device: "Android", os: "Android (auto-synced)", location: "—", origin: "auto" })
  }
  for (let i = 0; i < (day.fallback || 0); i++) {
    records.push({ timestamp: ts, device: "Other", os: "Other (auto-synced)", location: "—", origin: "auto" })
  }

  return records
}

// GET /api/qr-card-sync?days=N
// No auth check — this is invoked by Vercel Cron (see vercel.json), same
// pattern as /api/sync. Also safe to call manually (e.g. a "Sync now" button).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const days = Math.min(Math.max(parseInt(searchParams.get("days") || "2", 10) || 2, 1), 90)

  try {
    const today = new Date()
    const fetchedDays: WpCardStatsDay[] = []

    for (let i = 0; i < days; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const dateStr = toIsoDate(d)

      const resp = await fetchCardStats(dateStr)
      fetchedDays.push(...(resp.stats ?? []))

      if (i < days - 1) await sleep(150)
    }

    const datesUpdated = new Set(fetchedDays.map(d => d.stat_date))
    const newAutoRecords = fetchedDays.flatMap(buildSyntheticRecords)

    const store = await readQrStore()
    const existingCsv = store.card.records.filter(r => r.origin === "csv")
    const existingAutoOtherDays = store.card.records.filter(
      r => r.origin === "auto" && !datesUpdated.has(r.timestamp.slice(0, 10))
    )

    store.card.records = [...existingCsv, ...existingAutoOtherDays, ...newAutoRecords]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    store.cardAutoSync = { lastSyncedAt: new Date().toISOString(), lastError: null }

    await writeQrStore(store)

    return NextResponse.json({
      ok: true,
      daysFetched: days,
      datesUpdated: [...datesUpdated],
      newRecords: newAutoRecords.length,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    try {
      const store = await readQrStore()
      store.cardAutoSync = { ...store.cardAutoSync, lastError: msg }
      await writeQrStore(store)
    } catch {
      // best-effort error recording
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
