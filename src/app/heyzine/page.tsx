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
const tip = { backgroundColor: "#fff", borderColor: "rgba(18,20,40,.1)", borderWidth: 1, titleColor: "#121428", bodyColor: "#3c3f5e", padding: 10, cornerRadius: 6, displayColors: false }
const gr  = { color: "rgba(18,20,40,.05)" }
const sc  = { x: { grid: gr, ticks: { color: C.MU, font: { size: 10 } } }, y: { grid: gr, ticks: { color: C.MU, font: { size: 10 } } } }

const fmtDateOnly = (iso: string) => {
  const d = new Date(iso + "T00:00:00")
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("da-DK", { day: "2-digit", month: "short", year: "numeric" })
}
const fmtAxisDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00")
  return `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleString("en-GB", { month: "short" })}`
}
const fmtDuration = (sec: number) => {
  if (!sec) return "0:00"
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}
const fmtDateTime = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("da-DK", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function useChart(id: string, config: () => object, deps: unknown[]) {
  const ref = useRef<any>(null)
  useEffect(() => {
    const el = document.getElementById(id)
    if (!el) return
    if (typeof (window as any).Chart !== "function") return
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
  tdr:     { padding: "9px 16px", borderBottom: "1px solid #e2ddd4", color: "#3c3f5e", fontSize: 12, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const },
}

const RANGE_OPTIONS = [
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
] as const

function rangeToDates(range: string): { from: Date | null; to: Date | null } {
  const now = new Date()
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  if (range === "30d") {
    const from = new Date(now); from.setDate(now.getDate() - 29); from.setHours(0, 0, 0, 0)
    return { from, to: endOfToday }
  }
  if (range === "90d") {
    const from = new Date(now); from.setDate(now.getDate() - 89); from.setHours(0, 0, 0, 0)
    return { from, to: endOfToday }
  }
  if (range === "year") {
    return { from: new Date(now.getFullYear(), 0, 1), to: endOfToday }
  }
  return { from: null, to: null } // all time
}

export default function HeyzinePage() {
  const { status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [chartReady, setChartReady] = useState(false)
  const [range, setRange] = useState<string>("90d")
  const [visibleRows, setVisibleRows] = useState(10)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if ((window as any).Chart) { setChartReady(true); return }
    const el = document.createElement("script")
    el.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"
    el.onload = () => setChartReady(true)
    document.head.appendChild(el)
  }, [])

  function loadData() {
    fetch("/api/heyzine-data")
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
        setLoading(false)
      })
      .catch(() => {
        setError("Failed to load")
        setLoading(false)
      })
  }

  useEffect(() => {
    if (status !== "authenticated") return
    loadData()
  }, [status])

  function handleUploadClick() {
    fileInputRef.current?.click()
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadMsg("")
    try {
      const csv = await file.text()
      const r = await fetch("/api/heyzine-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      })
      const j = await r.json()
      if (!j.ok) {
        setUploadMsg(`Error: ${j.error}`)
      } else {
        setUploadMsg(`Imported ${j.imported} day(s)${j.skipped ? `, skipped ${j.skipped}` : ""}`)
        loadData()
      }
    } catch (err) {
      setUploadMsg("Upload failed: " + err)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleClear() {
    if (!window.confirm("Clear all uploaded Heyzine stats? This cannot be undone.")) return
    await fetch("/api/heyzine-clear", { method: "POST" })
    loadData()
  }

  // ── Derived data ──────────────────────────────────────────────────────
  const allDays: Array<{ date: string; visits: number; visitors: number; duration: number }> = data?.days ?? []

  const { from, to } = rangeToDates(range)
  const filtered = useMemo(() => {
    return allDays.filter(d => {
      const t = new Date(d.date + "T00:00:00")
      if (from && t < from) return false
      if (to && t > to) return false
      return true
    })
  }, [allDays, from, to])

  const totalVisits   = filtered.reduce((sum, d) => sum + d.visits, 0)
  const totalVisitors = filtered.reduce((sum, d) => sum + d.visitors, 0)
  const activeDays    = filtered.filter(d => d.visits > 0).length
  const avgDuration   = activeDays ? filtered.reduce((sum, d) => sum + d.duration, 0) / activeDays : 0
  const peakDay       = [...filtered].sort((a, b) => b.visits - a.visits)[0] ?? null
  const returnRate    = totalVisits ? Math.max(0, Math.round((1 - totalVisitors / totalVisits) * 100)) : 0

  const sortedAsc  = useMemo(() => [...filtered].sort((a, b) => a.date.localeCompare(b.date)), [filtered])
  const sortedDesc = useMemo(() => [...filtered].sort((a, b) => b.date.localeCompare(a.date)), [filtered])

  function handleExport() {
    const header = "Date,Visits,Visitors,Visit duration\n"
    const body = sortedDesc.map(d => `${d.date},${d.visits},${d.visitors},${d.duration}`).join("\n")
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `heyzine-stats-${range}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const base = { responsive: false, animation: { duration: 400 }, plugins: { legend: { display: false }, tooltip: tip }, scales: sc }

  useChart("hz-c1", () => ({
    type: "line",
    data: {
      labels: sortedAsc.map(d => fmtAxisDate(d.date)),
      datasets: [
        { label: "Visits", data: sortedAsc.map(d => d.visits), borderColor: C.G, backgroundColor: C.Gd, fill: true, tension: .4, pointRadius: 0, borderWidth: 2 },
        { label: "Visitors", data: sortedAsc.map(d => d.visitors), borderColor: C.B, backgroundColor: C.Bd, fill: true, tension: .4, pointRadius: 0, borderWidth: 2 },
      ],
    },
    options: { ...base, interaction: { mode: "index", intersect: false }, plugins: { ...base.plugins, legend: { display: true, labels: { color: C.MU, boxWidth: 8, font: { size: 10 }, padding: 16 } } } },
  }), [sortedAsc, chartReady])

  useChart("hz-c2", () => ({
    type: "bar",
    data: {
      labels: sortedAsc.map(d => fmtAxisDate(d.date)),
      datasets: [{ label: "Avg duration (s)", data: sortedAsc.map(d => d.duration), backgroundColor: C.Ad, borderColor: C.A, borderWidth: 1.5, borderRadius: 4 }],
    },
    options: base,
  }), [sortedAsc, chartReady])

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

      <DashboardTabs active="/heyzine" />

      <div style={s.main}>

        {/* Title row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: "#7a7e9a", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>Marketing Report</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#121428", margin: "0 0 4px" }}>Heyzine Analytics</h1>
            <p style={{ fontSize: 12, color: "#7a7e9a", margin: 0 }}>Engagement with the digital magazine hosted on Heyzine — visits, visitors, and read time.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChosen} style={{ display: "none" }} />
              <button onClick={handleUploadClick} disabled={uploading} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "8px 14px", border: "1px solid #e2ddd4", borderRadius: 6, background: "#fff", color: C.G, cursor: uploading ? "default" : "pointer", fontFamily: "inherit" }}>
                {uploading ? "Uploading…" : "↑ Upload CSV"}
              </button>
              <button onClick={handleClear} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "8px 14px", border: "1px solid #e2ddd4", borderRadius: 6, background: "#fff", color: "#7a7e9a", cursor: "pointer", fontFamily: "inherit" }}>
                Clear
              </button>
              <button onClick={handleExport} disabled={!sortedDesc.length} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "8px 14px", border: "none", borderRadius: 6, background: "#121428", color: "#fff", cursor: sortedDesc.length ? "pointer" : "not-allowed", opacity: sortedDesc.length ? 1 : .5, fontFamily: "inherit" }}>
                Export
              </button>
            </div>
            <div style={{ fontSize: 10, color: "#7a7e9a" }}>
              {data?.uploadedAt
                ? <>Last uploaded {fmtDateTime(data.uploadedAt)}</>
                : <>No data yet — upload the monthly Heyzine stats CSV above</>}
            </div>
            {uploadMsg && (
              <div style={{ fontSize: 11, fontWeight: 600, color: uploadMsg.startsWith("Error") || uploadMsg.startsWith("Upload failed") ? "#b91c1c" : C.G, padding: "4px 10px", background: uploadMsg.startsWith("Error") || uploadMsg.startsWith("Upload failed") ? "#fef2f2" : "#f0faf6", borderRadius: 5 }}>{uploadMsg}</div>
            )}
          </div>
        </div>

        {!allDays.length && !loading && (
          <div style={{ background: "#fff", border: "1px solid #e2ddd4", borderRadius: 10, padding: "24px", textAlign: "center", marginBottom: 16 }}>
            <div style={{ color: "#7a7e9a", fontSize: 13 }}>No Heyzine data yet — upload the monthly stats CSV above to get started.</div>
          </div>
        )}

        {allDays.length > 0 && (<>

          {/* ── Overview + date range ────────────────────────────────── */}
          <div style={{ ...s.lbl, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={s.lblTxt}>Overview</span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {RANGE_OPTIONS.map(o => (
                <button key={o.key} onClick={() => setRange(o.key)} style={{ fontSize: 11, fontWeight: 600, padding: "6px 12px", border: "1px solid #e2ddd4", borderRadius: 6, background: range === o.key ? "#121428" : "#fff", color: range === o.key ? "#fff" : "#3c3f5e", cursor: "pointer", fontFamily: "inherit" }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* KPI cards */}
          <div style={s.g4}>
            <div style={s.kpi}>
              <div style={s.kpiLbl}>Total visits</div>
              <div style={s.kpiVal}>{totalVisits}</div>
              <div style={s.kpiSub}>{activeDays} active day{activeDays === 1 ? "" : "s"}</div>
            </div>
            <div style={s.kpi}>
              <div style={s.kpiLbl}>Total visitors</div>
              <div style={s.kpiVal}>{totalVisitors}</div>
              <div style={s.kpiSub}>{returnRate}% est. return visits</div>
            </div>
            <div style={s.kpi}>
              <div style={s.kpiLbl}>Avg visit duration</div>
              <div style={s.kpiVal}>{fmtDuration(avgDuration)}</div>
              <div style={s.kpiSub}>minutes:seconds, active days only</div>
            </div>
            <div style={s.kpi}>
              <div style={s.kpiLbl}>Peak day</div>
              <div style={s.kpiVal}>{peakDay ? peakDay.visits : 0}</div>
              <div style={s.kpiSub}>{peakDay ? fmtDateOnly(peakDay.date) : "—"}</div>
            </div>
          </div>

          {/* Visits & visitors over time */}
          <div style={{ marginTop: 12 }}>
            <div style={s.cc}>
              <div style={{ marginBottom: 12 }}>
                <div style={s.ccTitle}>Visits & visitors over time</div>
                <div style={s.ccSub}>Daily traffic to the Heyzine magazine</div>
              </div>
              <canvas id="hz-c1" width={1200} height={220} style={{ maxWidth: "100%" }} />
            </div>
          </div>

          {/* Duration trend + summary */}
          <div style={{ ...s.g2, marginTop: 12 }}>
            <div style={s.cc}>
              <div style={{ marginBottom: 12 }}>
                <div style={s.ccTitle}>Visit duration trend</div>
                <div style={s.ccSub}>Average seconds spent per visit, by day</div>
              </div>
              <canvas id="hz-c2" width={580} height={200} style={{ maxWidth: "100%" }} />
            </div>
            <div style={s.cc}>
              <div style={{ marginBottom: 12 }}>
                <div style={s.ccTitle}>Summary</div>
                <div style={s.ccSub}>Selected period</div>
              </div>
              {[
                ["Days tracked", filtered.length],
                ["Avg visits / day", filtered.length ? (totalVisits / filtered.length).toFixed(1) : "0"],
                ["Avg visitors / day", filtered.length ? (totalVisitors / filtered.length).toFixed(1) : "0"],
                ["Longest single-day avg. duration", fmtDuration(Math.max(0, ...filtered.map(d => d.duration)))],
              ].map(([label, value]) => (
                <div key={label as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #e2ddd4" }}>
                  <span style={{ fontSize: 12, color: "#3c3f5e" }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#121428" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Daily breakdown */}
          <div style={{ ...s.lbl, marginTop: 28 }}><span style={s.lblTxt}>Daily breakdown</span></div>
          <div style={s.tcard}>
            <div style={s.tcardH}>
              <span style={s.tcardT}>Daily breakdown</span>
              <span style={s.tcardS}>{filtered.length} day(s) in selected period</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={s.th}>Date</th>
                  <th style={{ ...s.th, textAlign: "right" }}>Visits</th>
                  <th style={{ ...s.th, textAlign: "right" }}>Visitors</th>
                  <th style={{ ...s.th, textAlign: "right" }}>Avg duration</th>
                </tr>
              </thead>
              <tbody>
                {sortedDesc.slice(0, visibleRows).map((d) => (
                  <tr key={d.date}>
                    <td style={{ ...s.td, fontSize: 11, color: "#7a7e9a" }}>{fmtDateOnly(d.date)}</td>
                    <td style={s.tdr}>{d.visits}</td>
                    <td style={s.tdr}>{d.visitors}</td>
                    <td style={s.tdr}>{fmtDuration(d.duration)}</td>
                  </tr>
                ))}
                {sortedDesc.length === 0 && (
                  <tr><td colSpan={4} style={{ ...s.td, textAlign: "center", padding: "32px 16px", color: "#7a7e9a" }}>No data in this period</td></tr>
                )}
              </tbody>
            </table>
            {visibleRows < sortedDesc.length && (
              <div style={{ padding: "14px 16px", textAlign: "center" }}>
                <button onClick={() => setVisibleRows(v => v + 10)} style={{ fontSize: 12, fontWeight: 600, padding: "8px 18px", border: "1px solid #e2ddd4", borderRadius: 6, background: "#fff", color: "#3c3f5e", cursor: "pointer", fontFamily: "inherit" }}>
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
