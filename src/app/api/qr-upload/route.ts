import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { readQrStore, writeQrStore, type ScanRecord } from "@/lib/qrStore"

// ── Minimal CSV parser (handles quoted fields, embedded commas, CRLF) ──────
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      row.push(field); field = ""
    } else if (ch === "\n") {
      row.push(field); rows.push(row); row = []; field = ""
    } else if (ch === "\r") {
      // ignore, \n handles the line break
    } else {
      field += ch
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }

  return rows.filter(r => r.some(c => c.trim() !== ""))
}

function findCol(headers: string[], candidates: string[]): number {
  const lower = headers.map(h => h.trim().toLowerCase())
  for (const c of candidates) {
    const idx = lower.indexOf(c)
    if (idx !== -1) return idx
  }
  for (let i = 0; i < lower.length; i++) {
    if (candidates.some(c => lower[i].includes(c))) return i
  }
  return -1
}

function categorizeDevice(osRaw: string, deviceRaw: string): ScanRecord["device"] {
  const v = `${deviceRaw} ${osRaw}`.toLowerCase()
  if (v.includes("ios") || v.includes("iphone") || v.includes("ipad")) return "iOS"
  if (v.includes("android")) return "Android"
  if (v.includes("windows") || v.includes("mac") || v.includes("linux") || v.includes("cros") || v.includes("desktop")) return "Desktop"
  return "Other"
}

function parseTimestamp(dateRaw: string, timeRaw: string): string | null {
  const combined = (timeRaw ? `${dateRaw} ${timeRaw}` : dateRaw).trim()
  if (!combined) return null
  const d = new Date(combined)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export async function POST(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { source?: string; csv?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const source = body.source
  const csv = body.csv
  if (source !== "website" && source !== "card") {
    return NextResponse.json({ error: "source must be 'website' or 'card'" }, { status: 400 })
  }
  if (!csv || typeof csv !== "string") {
    return NextResponse.json({ error: "Missing CSV content" }, { status: 400 })
  }

  const rows = parseCsv(csv)
  if (rows.length < 2) {
    return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 })
  }

  const headers = rows[0]
  const dateIdx     = findCol(headers, ["date & time", "date and time", "datetime", "timestamp", "scan date", "date"])
  const timeIdx     = findCol(headers, ["time", "scan time"])
  const deviceIdx   = findCol(headers, ["device", "device type"])
  const osIdx       = findCol(headers, ["os", "operating system", "platform"])
  const cityIdx     = findCol(headers, ["city"])
  const countryIdx  = findCol(headers, ["country"])
  const locationIdx = findCol(headers, ["location", "place"])

  let imported = 0
  let skipped = 0
  const records: ScanRecord[] = []

  for (const r of rows.slice(1)) {
    const dateRaw = dateIdx !== -1 ? (r[dateIdx] ?? "") : ""
    const timeRaw = timeIdx !== -1 ? (r[timeIdx] ?? "") : ""
    const timestamp = parseTimestamp(dateRaw, timeRaw)
    if (!timestamp) { skipped++; continue }

    const osRaw = osIdx !== -1 ? (r[osIdx] ?? "") : ""
    const deviceRaw = deviceIdx !== -1 ? (r[deviceIdx] ?? "") : ""
    const device = categorizeDevice(osRaw, deviceRaw)

    let location = ""
    if (locationIdx !== -1) {
      location = r[locationIdx] ?? ""
    } else if (cityIdx !== -1 || countryIdx !== -1) {
      location = [cityIdx !== -1 ? r[cityIdx] : "", countryIdx !== -1 ? r[countryIdx] : ""]
        .filter(Boolean).join(", ")
    }

    records.push({ timestamp, device, os: osRaw || device, location: location || "Unknown", origin: "csv" })
    imported++
  }

  const store = await readQrStore()

  // Preserve any auto-synced records (from the WordPress cron) — a CSV
  // upload only replaces previously-uploaded CSV rows for this source.
  const preservedAuto = store[source].records.filter(r => r.origin === "auto")
  const merged = [...records, ...preservedAuto]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  store[source] = { records: merged, uploadedAt: new Date().toISOString() }
  await writeQrStore(store)

  return NextResponse.json({ ok: true, imported, skipped, total: records.length })
}
