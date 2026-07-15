import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { readHeyzineStore, writeHeyzineStore, type HeyzineDay } from "@/lib/heyzineStore"

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

function parseDate(raw: string): string | null {
  const d = new Date(raw.trim())
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

export async function POST(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { csv?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const csv = body.csv
  if (!csv || typeof csv !== "string") {
    return NextResponse.json({ error: "Missing CSV content" }, { status: 400 })
  }

  const rows = parseCsv(csv)
  if (rows.length < 2) {
    return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 })
  }

  const headers = rows[0]
  const dateIdx     = findCol(headers, ["date"])
  const visitsIdx   = findCol(headers, ["visits"])
  const visitorsIdx = findCol(headers, ["visitors"])
  const durationIdx = findCol(headers, ["visit duration", "duration"])

  if (dateIdx === -1) {
    return NextResponse.json({ error: "CSV is missing a Date column" }, { status: 400 })
  }

  let imported = 0
  let skipped = 0
  const parsed: HeyzineDay[] = []

  for (const r of rows.slice(1)) {
    const date = parseDate(r[dateIdx] ?? "")
    if (!date) { skipped++; continue }
    parsed.push({
      date,
      visits: Number(r[visitsIdx] ?? 0) || 0,
      visitors: Number(r[visitorsIdx] ?? 0) || 0,
      duration: Number(r[durationIdx] ?? 0) || 0,
    })
    imported++
  }

  const store = await readHeyzineStore()

  // A monthly upload replaces any existing rows for the same dates, and
  // adds new ones — re-uploading a month with corrections is safe.
  const byDate = new Map(store.days.map(d => [d.date, d]))
  for (const d of parsed) byDate.set(d.date, d)
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))

  const updated = { days, uploadedAt: new Date().toISOString() }
  await writeHeyzineStore(updated)

  return NextResponse.json({ ok: true, imported, skipped, total: days.length })
}
