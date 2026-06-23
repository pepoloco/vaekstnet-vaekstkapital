"use client"
// @ts-nocheck
import { useEffect, useRef, useState, useMemo } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import DashboardTabs from "@/app/components/DashboardTabs"

const C = {
  G: "#15624c", Gd: "rgba(21,97,76,.12)",
  P: "#5a4998", Pd: "rgba(90,73,152,.12)",
  A: "#96803a", Ad: "rgba(150,128,58,.13)",
  B: "#2d68b0", Bd: "rgba(45,104,176,.12)",
  MU: "#7a7e9a",
}
const DEV_COLORS = [C.B, C.G, C.A, "#9a96a8"]
const DEV_BG     = [C.Bd, C.Gd, C.Ad, "rgba(154,150,168,.14)"]
const tip = { backgroundColor: "#fff", borderColor: "rgba(18,20,40,.1)", borderWidth: 1, titleColor: "#121428", bodyColor: "#3c3f5e", padding: 10, cornerRadius: 6, displayColors: false }
const gr  = { color: "rgba(18,20,40,.05)" }
const sc  = { x: { grid: gr, ticks: { color: C.MU, font: { size: 10 } } }, y: { grid: gr, ticks: { color: C.MU, font: { size: 10 } } } }

const fmtDateTime = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("da-DK", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}
const fmtAxisDate = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleString("en-GB", { month: "short" })}`
}

function useChart(id: string, config: () => object, deps: unknown[]) {
  const ref = useRef<any>(null)
  useEffect(() => {
    const el = document.getElementById(id)
    if (!el) return
    ref.current?.destroy()
    ref.current = new (window as any).Chart(el, config())
    return () => { ref.current?.destroy() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

const s = {
  page:    { minHeight: "100vh", background: "#f7f5f0", fontFamily: "inherit" },
  nav:     { background: "#121428", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", position: "sticky" as const, top: 0, zIndex: 50 },
  main:    { maxWidth: 1280, margin: "0 auto", padding: "28px 24px" },
  lbl:     { padding: "18px 0 8px", borderTop: "1px solid #e2ddd4", marginTop: 28 },
  lblTxt:  { fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" as const, color: "#7a7e9a" },
  g2:      { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 },
  g4:      { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 4 },
  kpi:     { background: "#fff", border: "1px solid #e2ddd4", borderRadius: 10, padding: "16px 20px" },
  kpiLbl:  { fontSize: 10, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase" as const, color: "#7a7e9a", marginBottom: 8 },
  kpiVal:  { fontSize: 32, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1 },
  kpiSub:  { fontSize: 11, color: "#7a7e9a", marginTop: 4 },
  cc:      { background: "#fff", border: "1px solid #e2ddd4", borderRadius: 10, padding: "16px 20px" },
  ccTitle: { fontSize: 13, fontWeight: 700, color: "#121428" },
  ccSub:   { fontSize: 10, color: "#7a7e9a", marginTop: 2 },
  tcard:   { background: "#fff", border: "1px solid #e2ddd4", borderRadius: 10, overflow: "hidden" },
  tcardH:  { display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #e2ddd4" },
  tcardT:  { fontSize: 13, fontWeight: 700, color: "#121428" },
  tcardS:  { fontSize: 11, color: "#7a7e9a" },
  th:      { fontSize: 10, fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase" as const, color: "#7a7e9a", padding: "7px 16px", textAlign: "left" as const, borderBottom: "1px solid #e2ddd4", background: "#f7f5f0" },
  td:      { padding: "9px 16px", borderBottom: "1px solid #e2ddd4", color: "#3c3f5e", fontSize: 12 },
  upcard:  { background: "#fff", border: "1px solid #e2ddd4", borderRadius: 10, padding: "16px 20px" },
  dropzone:{ marginTop: 12, border: "1.5px dashed #d8d3c8", borderRadius: 8, padding: "28px 16px", textAlign: "center" as const, background: "#fbfaf7", cursor: "pointer" },
}

const RANGE_OPTIONS = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
] as const

function rangeToDates(range: string, customFrom: string, customTo: string): { from: Date | null; to: Date | null } {
  const now = new Date()
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  if (range === "7d") {
    const from = new Date(now); from.setDate(now.getDate() - 6); from.setHours(0, 0, 0, 0)
    return { from, to: endOfToday }
  }
  if (range === "30d") {
    const from = new Date(now); from.setDate(now.getDate() - 29); from.setHours(0, 0, 0, 0)
    return { from, to: endOfToday }
  }
  if (range === "year") {
    return { from: new Date(now.getFullYear(), 0, 1), to: endOfToday }
  }
  if (range === "custom") {
    const from = customFrom ? new Date(customFrom + "T00:00:00") : null
    const to = customTo ? new Date(customTo + "T23:59:59") : null
    return { from, to }
  }
  return { from: null, to: null } // all time
}

export default function QrAnalyticsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [chartReady, setChartReady] = useState(false)
  const [range, setRange] = useState<string>("30d")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [uploading, setUploading] = useState<{ website: boolean; card: boolean }>({ website: false, card: false })
  const [uploadMsg, setUploadMsg] = useState<{ website: string; card: string }>({ website: "", card: "" })
  const [dragOver, setDragOver] = useState<{ website: boolean; card: boolean }>({ website: false, card: false })
  const [visibleScans, setVisibleScans] = useState(8)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if ((window as any).Chart) { setChartReady(true); return }
    const sc = document.createElement("script")
    sc.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"
    sc.onload = () => setChartReady(true)
    document.head.appendChild(sc)
  }, [])

  function loadData() {
    fetch("/api/qr-data")
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false) })
      .catch(() => { setError("Failed to load"); setLoading(false) })
  }

  useEffect(() => {
    if (status !== "authenticated") return
    loadData()
  }, [status])

  async function handleUpload(source: "website" | "card", file: File) {
    setUploading(u => ({ ...u, [source]: true }))
    setUploadMsg(m => ({ ...m, [source]: "" }))
    try {
      const csv = await file.text()
      const r = await fetch("/api/qr-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, csv }),
      })
      const j = await r.json()
      if (j.error) {
        setUploadMsg(m => ({ ...m, [source]: `Error: ${j.error}` }))
      } else {
        setUploadMsg(m => ({ ...m, [source]: `Imported ${j.imported} scans${j.skipped ? `, skipped ${j.skipped}` : ""}` }))
        loadData()
      }
    } catch (e) {
      setUploadMsg(m => ({ ...m, [source]: "Upload failed: " + e }))
    }
    setUploading(u => ({ ...u, [source]: false }))
  }

  async function handleClear() {
    if (!window.confirm("Clear all uploaded QR scan data? This cannot be undone.")) return
    await fetch("/api/qr-clear", { method: "POST" })
    loadData()
  }

  // ── Derived data ──────────────────────────────────────────────────────
  const combined = useMemo(() => {
    if (!data) return []
    const website = (data.website?.records ?? []).map((r: any) => ({ ...r, source: "Website QR" }))
    const card    = (data.card?.records ?? []).map((r: any) => ({ ...r, source: "Business Card QR" }))
    return [...website, ...card]
  }, [data])

  const { from, to } = rangeToDates(range, customFrom, customTo)
  const filtered = useMemo(() => {
    return combined.filter(r => {
      const t = new Date(r.timestamp)
      if (from && t < from) return false
      if (to && t > to) return false
      return true
    })
  }, [combined, from, to])

  const websiteCount = filtered.filter(r => r.source === "Website QR").length
  const cardCount    = filtered.filter(r => r.source === "Business Card QR").length
  const totalScans   = filtered.length

  const deviceCounts: Record<string, number> = { iOS: 0, Android: 0, Desktop: 0, Other: 0 }
  for (const r of filtered) deviceCounts[r.device] = (deviceCounts[r.device] ?? 0) + 1
  const topDevice = Object.entries(deviceCounts).sort((a, b) => b[1] - a[1])[0] ?? ["—", 0]

  // Time series — daily buckets, weekly if range spans > 60 days
  const seriesData = useMemo(() => {
    if (!filtered.length) return { labels: [], website: [], card: [] }
    const times = filtered.map(r => new Date(r.timestamp).getTime())
    const minT = from ? from.getTime() : Math.min(...times)
    const maxT = to ? to.getTime() : Math.max(...times)
    const spanDays = Math.max(1, Math.round((maxT - minT) / 86400000))
    const bucketDays = spanDays > 60 ? 7 : 1

    const buckets: { key: string; label: string; start: number; end: number }[] = []
    let cursor = new Date(minT); cursor.setHours(0, 0, 0, 0)
    const end = new Date(maxT)
    while (cursor <= end) {
      const bStart = cursor.getTime()
      const bEnd = new Date(cursor); bEnd.setDate(bEnd.getDate() + bucketDays)
      buckets.push({ key: cursor.toISOString(), label: fmtAxisDate(cursor.toISOString()), start: bStart, end: bEnd.getTime() })
      cursor = bEnd
    }

    const website = buckets.map(b => filtered.filter(r => r.source === "Website QR" && new Date(r.timestamp).getTime() >= b.start && new Date(r.timestamp).getTime() < b.end).length)
    const card    = buckets.map(b => filtered.filter(r => r.source === "Business Card QR" && new Date(r.timestamp).getTime() >= b.start && new Date(r.timestamp).getTime() < b.end).length)

    return { labels: buckets.map(b => b.label), website, card }
  }, [filtered, from, to])

  const recentScans = useMemo(() => [...filtered].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [filtered])

  function handleExport() {
    const header = "Date & Time,Source,Device,OS,Location\n"
    const body = recentScans.map(r => [fmtDateTime(r.timestamp), r.source, r.device, r.os, r.location].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `vaekstnet-qr-scans-${range}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const base = { responsive: false, animation: { duration: 400 }, plugins: { legend: { display: false }, tooltip: tip }, scales: sc }

  useChart("qr-c1", () => ({
    type: "line",
    data: {
      labels: seriesData.labels,
      datasets: [
        { label: "Website QR", data: seriesData.website, borderColor: C.G, backgroundColor: C.Gd, fill: true, tension: .4, pointRadius: 0, borderWidth: 2 },
        { label: "Business Card QR", data: seriesData.card, borderColor: C.B, backgroundColor: C.Bd, fill: true, tension: .4, pointRadius: 0, borderWidth: 2 },
      ],
    },
    options: { ...base, interaction: { mode: "index", intersect: false }, plugins: { ...base.plugins, legend: { display: true, labels: { color: C.MU, boxWidth: 8, font: { size: 10 }, padding: 16 } } } },
  }), [seriesData, chartReady])

  useChart("qr-c2", () => ({
    type: "doughnut",
    data: {
      labels: ["iOS", "Android", "Desktop", "Other"],
      datasets: [{ data: [deviceCounts.iOS, deviceCounts.Android, deviceCounts.Desktop, deviceCounts.Other], backgroundColor: DEV_BG, borderColor: DEV_COLORS, borderWidth: 2, hoverOffset: 5 }],
    },
    options: { responsive: false, cutout: "64%", animation: { duration: 400 }, plugins: { legend: { display: false }, tooltip: { ...tip, callbacks: { label: (c: any) => ` ${Number(c.raw)} (${totalScans ? Math.round(Number(c.raw) / totalScans * 100) : 0}%)` } } } },
  }), [deviceCounts.iOS, deviceCounts.Android, deviceCounts.Desktop, deviceCounts.Other, chartReady])

  useChart("qr-c3", () => ({
    type: "bar",
    data: { labels: ["Website QR", "Business Card QR"], datasets: [{ data: [websiteCount, cardCount], backgroundColor: [C.Bd, C.Gd], borderColor: [C.B, C.G], borderWidth: 1.5, borderRadius: 5 }] },
    options: base,
  }), [websiteCount, cardCount, chartReady])

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div style={s.page}>
        <nav style={s.nav}>
          <img src="/logo.png" alt="VaekstNet" style={{ height: 22, display: "block", filter: "brightness(0) invert(1)", opacity: 0.9 }} />
        </nav>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
          <div style={{ color: "#7a7e9a", fontSize: 14 }}>Loading…</div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>

      {/* Nav */}
      <nav style={s.nav}>
        <img src="/logo.png" alt="VaekstNet" style={{ height: 22, display: "block", filter: "brightness(0) invert(1)", opacity: 0.9 }} />
        <button onClick={() => signOut({ callbackUrl: "/login" })} style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", padding: "4px 12px", border: "1px solid rgba(255,255,255,.12)", borderRadius: 4, background: "transparent", color: "rgba(255,255,255,.3)", cursor: "pointer", fontFamily: "inherit" }}>
          Log out
        </button>
      </nav>

      <DashboardTabs active="/qr-analytics" />

      <div style={s.main}>

        {/* Title row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: "#7a7e9a", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>Report</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#121428", margin: "0 0 4px" }}>QR Scan Analytics</h1>
            <p style={{ fontSize: 12, color: "#7a7e9a", margin: 0 }}>Monitor engagement across your website and business card QR codes.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleClear} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "8px 14px", border: "1px solid #e2ddd4", borderRadius: 6, background: "#fff", color: "#7a7e9a", cursor: "pointer", fontFamily: "inherit" }}>
              Clear
            </button>
            <button onClick={handleExport} disabled={!recentScans.length} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "8px 14px", border: "none", borderRadius: 6, background: "#121428", color: "#fff", cursor: recentScans.length ? "pointer" : "not-allowed", opacity: recentScans.length ? 1 : .5, fontFamily: "inherit" }}>
              Export
            </button>
          </div>
        </div>

        {/* ── Upload cards ──────────────────────────────────────────── */}
        <div style={s.g2}>
          {([
            { key: "website" as const, title: "Website QR", desc: "Upload the scan export for your website QR code", count: data?.website?.records?.length ?? 0 },
            { key: "card" as const, title: "Business Card QR", desc: "Upload the scan export for your business card QR code", count: data?.card?.records?.length ?? 0 },
          ]).map(cfg => (
            <div key={cfg.key} style={s.upcard}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#121428" }}>{cfg.title}</div>
                  <div style={{ fontSize: 11, color: "#7a7e9a", marginTop: 2 }}>{cfg.desc}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, background: "#f0ede6", color: "#3c3f5e", borderRadius: 12, padding: "3px 10px" }}>{cfg.count}</span>
              </div>
              <label
                style={{ ...s.dropzone, borderColor: dragOver[cfg.key] ? C.P : "#d8d3c8", background: dragOver[cfg.key] ? "rgba(90,73,152,.04)" : "#fbfaf7" }}
                onDragOver={e => { e.preventDefault(); setDragOver(d => ({ ...d, [cfg.key]: true })) }}
                onDragLeave={() => setDragOver(d => ({ ...d, [cfg.key]: false }))}
                onDrop={e => {
                  e.preventDefault()
                  setDragOver(d => ({ ...d, [cfg.key]: false }))
                  const file = e.dataTransfer.files?.[0]
                  if (file) handleUpload(cfg.key, file)
                }}
              >
                <input
                  type="file"
                  accept=".csv"
                  style={{ display: "none" }}
                  onChange={e => { const file = e.target.files?.[0]; if (file) handleUpload(cfg.key, file) }}
                />
                <div style={{ fontSize: 12, color: "#3c3f5e" }}>
                  {uploading[cfg.key]
                    ? "Uploading…"
                    : <>Drop CSV here or <span style={{ color: C.P, fontWeight: 600 }}>browse</span></>}
                </div>
                <div style={{ fontSize: 10, color: "#7a7e9a", marginTop: 4 }}>Accepts .csv exports</div>
              </label>
              {uploadMsg[cfg.key] && (
                <div style={{ marginTop: 8, fontSize: 11, color: uploadMsg[cfg.key].startsWith("Error") ? "#b91c1c" : C.G }}>{uploadMsg[cfg.key]}</div>
              )}
              {data?.[cfg.key]?.uploadedAt && (
                <div style={{ marginTop: 4, fontSize: 10, color: "#7a7e9a" }}>Last uploaded {fmtDateTime(data[cfg.key].uploadedAt)}</div>
              )}
            </div>
          ))}
        </div>

        {!combined.length && !loading && (
          <div style={{ background: "#fff", border: "1px solid #e2ddd4", borderRadius: 10, padding: "24px", textAlign: "center", marginTop: 16 }}>
            <div style={{ color: "#7a7e9a", fontSize: 13 }}>No scan data yet — upload a CSV export above to get started.</div>
          </div>
        )}

        {combined.length > 0 && (<>

          {/* ── Overview + date range ────────────────────────────────── */}
          <div style={{ ...s.lbl, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={s.lblTxt}>Overview</span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {RANGE_OPTIONS.map(o => (
                <button key={o.key} onClick={() => setRange(o.key)} style={{ fontSize: 11, fontWeight: 600, padding: "6px 12px", border: "1px solid #e2ddd4", borderRadius: 6, background: range === o.key ? "#121428" : "#fff", color: range === o.key ? "#fff" : "#3c3f5e", cursor: "pointer", fontFamily: "inherit" }}>
                  {o.label}
                </button>
              ))}
              <button onClick={() => setRange("custom")} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, padding: "6px 12px", border: "1px solid #e2ddd4", borderRadius: 6, background: range === "custom" ? "#121428" : "#fff", color: range === "custom" ? "#fff" : "#3c3f5e", cursor: "pointer", fontFamily: "inherit" }}>
                Custom range
              </button>
            </div>
          </div>

          {range === "custom" && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ fontSize: 12, padding: "6px 10px", border: "1px solid #e2ddd4", borderRadius: 6, fontFamily: "inherit" }} />
              <span style={{ fontSize: 12, color: "#7a7e9a" }}>to</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ fontSize: 12, padding: "6px 10px", border: "1px solid #e2ddd4", borderRadius: 6, fontFamily: "inherit" }} />
            </div>
          )}

          {/* KPI cards */}
          <div style={s.g4}>
            <div style={s.kpi}>
              <div style={s.kpiLbl}>Total scans</div>
              <div style={s.kpiVal}>{totalScans}</div>
              <div style={s.kpiSub}>All QR sources</div>
            </div>
            <div style={s.kpi}>
              <div style={s.kpiLbl}>Website QR</div>
              <div style={s.kpiVal}>{websiteCount}</div>
              <div style={s.kpiSub}>{totalScans ? Math.round(websiteCount / totalScans * 100) : 0}% of total</div>
            </div>
            <div style={s.kpi}>
              <div style={s.kpiLbl}>Business card QR</div>
              <div style={s.kpiVal}>{cardCount}</div>
              <div style={s.kpiSub}>{totalScans ? Math.round(cardCount / totalScans * 100) : 0}% of total</div>
            </div>
            <div style={s.kpi}>
              <div style={s.kpiLbl}>Top device</div>
              <div style={s.kpiVal}>{topDevice[0]}</div>
              <div style={s.kpiSub}>{topDevice[1]} scans · {totalScans ? Math.round(Number(topDevice[1]) / totalScans * 100) : 0}%</div>
            </div>
          </div>

          {/* Scans over time */}
          <div style={{ marginTop: 12 }}>
            <div style={s.cc}>
              <div style={{ marginBottom: 12 }}>
                <div style={s.ccTitle}>Scans over time</div>
                <div style={s.ccSub}>Daily scan volume by source</div>
              </div>
              <canvas id="qr-c1" width={1200} height={220} style={{ maxWidth: "100%" }} />
            </div>
          </div>

          {/* Device breakdown + QR source comparison */}
          <div style={{ ...s.g2, marginTop: 12 }}>
            <div style={s.cc}>
              <div style={{ marginBottom: 12 }}>
                <div style={s.ccTitle}>Device breakdown</div>
                <div style={s.ccSub}>Scans by operating system</div>
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <canvas id="qr-c2" width={180} height={180} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  {[["iOS", deviceCounts.iOS, C.B], ["Android", deviceCounts.Android, C.G], ["Desktop", deviceCounts.Desktop, C.A], ["Other", deviceCounts.Other, "#9a96a8"]].map(([label, count, color]) => (
                    <div key={label as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #e2ddd4" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color as string, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "#3c3f5e" }}>{label}</span>
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#121428" }}>{count as number}</span>
                        <span style={{ fontSize: 11, color: "#7a7e9a", minWidth: 32, textAlign: "right" }}>{totalScans ? Math.round(Number(count) / totalScans * 100) : 0}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={s.cc}>
              <div style={{ marginBottom: 12 }}>
                <div style={s.ccTitle}>QR source comparison</div>
                <div style={s.ccSub}>Total scans per QR code</div>
              </div>
              <canvas id="qr-c3" width={580} height={200} style={{ maxWidth: "100%" }} />
            </div>
          </div>

          {/* Recent scans */}
          <div style={{ ...s.lbl, marginTop: 28 }}><span style={s.lblTxt}>Recent scans</span></div>
          <div style={s.tcard}>
            <div style={s.tcardH}>
              <span style={s.tcardT}>Recent scans</span>
              <span style={s.tcardS}>{totalScans} scans in selected period</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={s.th}>Date &amp; time</th>
                  <th style={s.th}>Source</th>
                  <th style={s.th}>Device</th>
                  <th style={s.th}>OS</th>
                  <th style={s.th}>Location</th>
                </tr>
              </thead>
              <tbody>
                {recentScans.slice(0, visibleScans).map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...s.td, fontSize: 11, color: "#7a7e9a" }}>{fmtDateTime(r.timestamp)}</td>
                    <td style={s.td}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: r.source === "Website QR" ? C.Gd : C.Bd, color: r.source === "Website QR" ? C.G : C.B }}>
                        {r.source}
                      </span>
                    </td>
                    <td style={s.td}>{r.device}</td>
                    <td style={{ ...s.td, color: "#7a7e9a" }}>{r.os}</td>
                    <td style={{ ...s.td, color: "#7a7e9a" }}>{r.location}</td>
                  </tr>
                ))}
                {recentScans.length === 0 && (
                  <tr><td colSpan={5} style={{ ...s.td, textAlign: "center", padding: "32px 16px", color: "#7a7e9a" }}>No scans in this period</td></tr>
                )}
              </tbody>
            </table>
            {visibleScans < recentScans.length && (
              <div style={{ padding: "14px 16px", textAlign: "center" }}>
                <button onClick={() => setVisibleScans(v => v + 10)} style={{ fontSize: 12, fontWeight: 600, padding: "8px 18px", border: "1px solid #e2ddd4", borderRadius: 6, background: "#fff", color: "#3c3f5e", cursor: "pointer", fontFamily: "inherit" }}>
                  Show more
                </button>
              </div>
            )}
          </div>

          <div style={{ height: 48 }} />
        </>)}
      </div>
    </div>
  )
}
