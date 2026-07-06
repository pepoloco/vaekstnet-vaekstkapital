import { NextResponse } from "next/server"
import { fetchQrStats, type WpStatsDay } from "@/lib/wordpress"
import { readQrStore, writeQrStore, type ScanRecord, type QrSourceKey } from "@/lib/qrStore"

export const maxDuration = 60

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

// Maps the WordPress plugin's QR-source labels to our internal store keys.
const SOURCE_MAP: Record<string, QrSourceKey> = {
  CARD: "card",
  WEB: "website",
  MAGAZINES: "magazine",
}

// Turn a day's aggregate { ios, android, fallback } counts into synthetic
// per-scan records so they merge cleanly with the existing chart/table logic.
function buildSyntheticRecords(day: WpStatsDay): ScanRecord[] {
  const records: ScanRecord[] = []
  const ts = `${day.stat_date}T12:00:00.000Z`

  for (let i = 0; i < (day.ios || 0); i++) {
    records.push({ timestamp: ts, device: "iOS", os: "iOS (auto-synced)", location: "—", origin: "auto" })
  }
  for (let i = 0; i < (day.android || 0); i++) {
    records.push({ timestamp: ts, device: "Android", os: "Android (auto-synced)", location: "—", origin: "auto" })
  }
  for (let i = 0; i < (day.fallback || 0); i++) {
    records.push({ timestamp: ts, device: "Fallback", os: "Fallback (auto-synced)", location: "—", origin: "auto" })
  }

  return records
}

// GET /api/qr-sync?days=N
// No auth check — this is invoked by Vercel Cron (see vercel.json), same
// pattern as /api/sync. Also safe to call manually (e.g. a "Sync now" button).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const days = Math.min(Math.max(parseInt(searchParams.get("days") || "2", 10) || 2, 1), 90)

  try {
    const today = new Date()
    const bySource: Record<QrSourceKey, WpStatsDay[]> = { website: [], card: [], magazine: [] }
    const debugLog: Array<{ date: string; raw: unknown }> = []

    for (let i = 0; i < days; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const dateStr = toIsoDate(d)

      const resp = await fetchQrStats(dateStr)
      debugLog.push({ date: dateStr, raw: resp })
      for (const block of resp.sources ?? []) {
        const key = SOURCE_MAP[block["QR-source"]]
        if (!key) continue
        bySource[key].push(...(block.stats ?? []))
      }

      if (i < days - 1) await sleep(150)
    }

    const store = await readQrStore()
    const allDatesUpdated = new Set<string>()
    let totalNew = 0

    for (const key of Object.keys(bySource) as QrSourceKey[]) {
      const sourceDays = bySource[key]
      if (!sourceDays.length) continue

      const datesUpdated = new Set(sourceDays.map(d => d.stat_date))
      datesUpdated.forEach(d => allDatesUpdated.add(d))

      const newAutoRecords = sourceDays.flatMap(buildSyntheticRecords)
      const existingNonAuto = store[key].records.filter(r => r.origin !== "auto")
      const existingAutoOtherDays = store[key].records.filter(
        r => r.origin === "auto" && !datesUpdated.has(r.timestamp.slice(0, 10))
      )

      store[key] = {
        records: [...existingNonAuto, ...existingAutoOtherDays, ...newAutoRecords]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
        uploadedAt: store[key].uploadedAt,
      }
      totalNew += newAutoRecords.length
    }

    store.autoSync = { lastSyncedAt: new Date().toISOString(), lastError: null }
    await writeQrStore(store)

    return NextResponse.json({
      ok: true,
      daysFetched: days,
      datesUpdated: [...allDatesUpdated],
      newRecords: totalNew,
      debug: debugLog,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    try {
      const store = await readQrStore()
      store.autoSync = { ...store.autoSync, lastError: msg }
      await writeQrStore(store)
    } catch {
      // best-effort error recording
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
