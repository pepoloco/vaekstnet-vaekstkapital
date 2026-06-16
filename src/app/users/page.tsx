"use client"
// @ts-nocheck
import { useEffect, useRef, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"

const PORTAL = "144061788"

const fmt      = (n: number) => new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(n)
const fmtShort = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + "M kr." : (n / 1e3).toFixed(0) + "K kr."
const fmtDate  = (iso: string | null | undefined) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("da-DK")
}

const MONTH_LABELS: Record<string, string> = {
  "2025-10": "Okt 25", "2025-11": "Nov 25", "2025-12": "Dec 25",
  "2026-01": "Jan 26", "2026-02": "Feb 26", "2026-03": "Mar 26",
  "2026-04": "Apr 26", "2026-05": "Maj 26", "2026-06": "Jun 26",
  "2026-07": "Jul 26", "2026-08": "Aug 26", "2026-09": "Sep 26",
  "2026-10": "Okt 26", "2026-11": "Nov 26", "2026-12": "Dec 26",
}

const C = {
  G: "#15624c", Gd: "rgba(21,97,76,.12)",
  P: "#5a4998", Pd: "rgba(90,73,152,.12)",
  A: "#96803a", Ad: "rgba(150,128,58,.13)",
  B: "#2d68b0", Bd: "rgba(45,104,176,.12)",
  MU: "#7a7e9a",
}
const DEV_COLORS = [C.G, C.P, C.A, C.B, "#8b5cf6", "#e06c75"]
const DEV_BG     = [C.Gd, C.Pd, C.Ad, C.Bd, "rgba(139,92,246,.12)", "rgba(224,108,117,.12)"]
const tip = { backgroundColor: "#fff", borderColor: "rgba(18,20,40,.1)", borderWidth: 1, titleColor: "#121428", bodyColor: "#3c3f5e", padding: 10, cornerRadius: 6, displayColors: false }
const gr  = { color: "rgba(18,20,40,.05)" }
const sc  = { x: { grid: gr, ticks: { color: C.MU, font: { size: 10 } } }, y: { grid: gr, ticks: { color: C.MU, font: { size: 10 } } } }

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

// ── Inline styles ──────────────────────────────────────────────────────────────

const s = {
  page:   { minHeight: "100vh", background: "#f7f5f0", fontFamily: "inherit" },
  nav:    { background: "#121428", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", position: "sticky" as const, top: 0, zIndex: 50 },
  main:   { maxWidth: 1280, margin: "0 auto", padding: "28px 24px" },
  lbl:    { padding: "18px 0 8px", borderTop: "1px solid #e2ddd4", marginTop: 28 },
  lblTxt: { fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" as const, color: "#7a7e9a" },
  g4:     { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 4 },
  g2:     { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 },
  g11:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  g21:    { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 },
  mt:     { marginTop: 12 },
  kpi:    { background: "#fff", border: "1px solid #e2ddd4", borderRadius: 10, padding: "16px 20px" },
  kpiLbl: { fontSize: 10, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase" as const, color: "#7a7e9a", marginBottom: 8 },
  kpiVal: { fontSize: 36, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1 },
  kpiSub: { fontSize: 11, color: "#7a7e9a", marginTop: 4 },
  cc:     { background: "#fff", border: "1px solid #e2ddd4", borderRadius: 10, padding: "16px 20px" },
  ccHead: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 },
  ccTitle:{ fontSize: 13, fontWeight: 700, color: "#121428" },
  ccSub:  { fontSize: 10, color: "#7a7e9a", marginTop: 2 },
  tcard:  { background: "#fff", border: "1px solid #e2ddd4", borderRadius: 10, overflow: "hidden" },
  tcardH: { display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #e2ddd4" },
  tcardT: { fontSize: 13, fontWeight: 700, color: "#121428" },
  tcardS: { fontSize: 11, color: "#7a7e9a" },
  th:     { fontSize: 10, fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase" as const, color: "#7a7e9a", padding: "7px 16px", textAlign: "left" as const, borderBottom: "1px solid #e2ddd4" },
  td:     { padding: "9px 16px", borderBottom: "1px solid #e2ddd4", color: "#3c3f5e", fontSize: 12 },
  tdr:    { padding: "9px 16px", borderBottom: "1px solid #e2ddd4", color: "#3c3f5e", fontSize: 12, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const },
  rank:   { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: "#f0ede6", fontSize: 10, fontWeight: 700, color: "#7a7e9a" },
  acard:  { background: "#f7f5f0", border: "1px solid #e2ddd4", borderRadius: 10, padding: "14px 16px" },
  acardH: { fontSize: 11, fontWeight: 700, color: "#7a7e9a", letterSpacing: ".06em", textTransform: "uppercase" as const, marginBottom: 10 },
  arow:   { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0", borderBottom: "1px solid #e2ddd4" },
  arowL:  { fontSize: 11, color: "#7a7e9a" },
  arowV:  { fontSize: 13, fontWeight: 600 },
}

export default function UsersPage() {
  const { status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState("")
  const [chartReady, setChartReady] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  // Load Chart.js from CDN
  useEffect(() => {
    if ((window as any).Chart) { setChartReady(true); return }
    const sc = document.createElement("script")
    sc.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"
    sc.onload = () => setChartReady(true)
    document.head.appendChild(sc)
  }, [])

  useEffect(() => {
    if (status !== "authenticated") return
    fetch("/api/users-data")
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false) })
      .catch(() => { setError("Failed to load"); setLoading(false) })
  }, [status])

  async function handleSync() {
    setSyncing(true)
    setError("")
    try {
      const r = await fetch("/api/users-sync")
      const j = await r.json()
      if (j.error) { setError(j.error); setSyncing(false); return }
      const d = await fetch("/api/users-data").then(r => r.json())
      if (!d.error) setData(d)
    } catch (e) {
      setError("Sync failed: " + e)
    }
    setSyncing(false)
  }

  const base = { responsive: false, animation: { duration: 500 }, plugins: { legend: { display: false }, tooltip: tip }, scales: sc }

  useChart("u-c1", () => ({
    type: "line",
    data: { labels: data?.cumulative.map((m: any) => MONTH_LABELS[m.month] ?? m.month) ?? [], datasets: [
      { label: "Created",   data: data?.cumulative.map((m: any) => m.created)   ?? [], borderColor: C.G, backgroundColor: "transparent", tension: .4, pointRadius: 3, pointBackgroundColor: C.G, borderWidth: 2.5 },
      { label: "Onboarded", data: data?.cumulative.map((m: any) => m.onboarded) ?? [], borderColor: C.P, backgroundColor: "transparent", tension: .4, pointRadius: 3, pointBackgroundColor: C.P, borderWidth: 2.5 },
      { label: "Funded",    data: data?.cumulative.map((m: any) => m.funded)    ?? [], borderColor: C.A, backgroundColor: "transparent", tension: .4, pointRadius: 3, pointBackgroundColor: C.A, borderWidth: 2.5 },
    ]},
    options: { ...base, interaction: { mode: "index", intersect: false }, plugins: { ...base.plugins, legend: { display: true, labels: { color: C.MU, boxWidth: 8, font: { size: 10 }, padding: 16 } } } },
  }), [data, chartReady])

  useChart("u-c2", () => ({
    type: "bar",
    data: { labels: data?.byMonth.map((m: any) => MONTH_LABELS[m.month] ?? m.month) ?? [], datasets: [
      { label: "Created",   data: data?.byMonth.map((m: any) => m.created)   ?? [], backgroundColor: C.Gd, borderColor: C.G, borderWidth: 1.5, borderRadius: 4 },
      { label: "Onboarded", data: data?.byMonth.map((m: any) => m.onboarded) ?? [], backgroundColor: C.Pd, borderColor: C.P, borderWidth: 1.5, borderRadius: 4 },
      { label: "Funded",    data: data?.byMonth.map((m: any) => m.funded)    ?? [], backgroundColor: C.Ad, borderColor: C.A, borderWidth: 1.5, borderRadius: 4 },
    ]},
    options: { ...base, interaction: { mode: "index", intersect: false }, plugins: { ...base.plugins, legend: { display: true, labels: { color: C.MU, boxWidth: 8, font: { size: 10 }, padding: 16 } } } },
  }), [data, chartReady])

  const act = data?.activation
  useChart("u-c3", () => ({
    type: "bar",
    data: { labels: ["Created", "Onboarded", "Funded"], datasets: [{ data: [act?.created ?? 0, act?.onboarded ?? 0, act?.funded ?? 0], backgroundColor: [C.Gd, C.Pd, C.Ad], borderColor: [C.G, C.P, C.A], borderWidth: 1.5, borderRadius: 5 }] },
    options: { ...base, indexAxis: "y", plugins: { ...base.plugins, tooltip: { ...tip, callbacks: { label: (c: any) => ` ${Number(c.raw)} (${Math.round(Number(c.raw) / (act?.created || 1) * 100)}%)` } } } },
  }), [data, chartReady])

  useChart("u-c4", () => ({
    type: "line",
    data: { labels: data?.cumulative.map((m: any) => MONTH_LABELS[m.month] ?? m.month) ?? [], datasets: [{ label: "Onboarding rate", data: data?.cumulative.map((m: any) => m.created > 0 ? Math.round(m.onboarded / m.created * 100) : 0) ?? [], borderColor: C.P, backgroundColor: "transparent", tension: .4, pointRadius: 3, pointBackgroundColor: C.P, borderWidth: 2.5 }] },
    options: { ...base, plugins: { ...base.plugins, tooltip: { ...tip, callbacks: { label: (c: any) => ` ${Number(c.raw)}%` } } }, scales: { ...sc, y: { ...sc.y, min: 0, max: 100, ticks: { callback: (v: any) => v + "%", color: C.MU, font: { size: 10 } } } } },
  }), [data, chartReady])

  useChart("u-c5", () => ({
    type: "doughnut",
    data: { labels: ["VK fonde", "Noterede", "Likvider"], datasets: [{ data: [data?.auc.vkFunds ?? 0, data?.auc.listed ?? 0, data?.auc.cash ?? 0], backgroundColor: [C.Pd, C.Ad, "rgba(45,104,176,.14)"], borderColor: [C.P, C.A, C.B], borderWidth: 2, hoverOffset: 5 }] },
    options: { responsive: false, cutout: "64%", animation: { duration: 500 }, plugins: { legend: { display: true, position: "bottom", labels: { color: C.MU, boxWidth: 8, font: { size: 10 }, padding: 12 } }, tooltip: { ...tip, callbacks: { label: (c: any) => ` ${fmt(Number(c.raw))}` } } } },
  }), [data, chartReady])

  useChart("u-c6", () => ({
    type: "bar",
    data: {
      labels: data?.byWeek?.map((w: any) => w.week) ?? [],
      datasets: [
        { label: "Signed up",    data: data?.byWeek?.map((w: any) => w.created)   ?? [], backgroundColor: C.Gd, borderColor: C.G, borderWidth: 1.5, borderRadius: 4 },
        { label: "KYC complete", data: data?.byWeek?.map((w: any) => w.onboarded) ?? [], backgroundColor: C.Pd, borderColor: C.P, borderWidth: 1.5, borderRadius: 4 },
      ],
    },
    options: { ...base, interaction: { mode: "index", intersect: false }, plugins: { ...base.plugins, legend: { display: true, labels: { color: C.MU, boxWidth: 8, font: { size: 10 }, padding: 16 } } } },
  }), [data, chartReady])

  useChart("u-c7", () => {
    const devices = data?.deviceBreakdown ?? []
    return {
      type: "doughnut",
      data: {
        labels: devices.map((d: any) => d.device),
        datasets: [{ data: devices.map((d: any) => d.count), backgroundColor: DEV_BG.slice(0, devices.length), borderColor: DEV_COLORS.slice(0, devices.length), borderWidth: 2, hoverOffset: 5 }],
      },
      options: { responsive: false, cutout: "64%", animation: { duration: 500 }, plugins: { legend: { display: true, position: "bottom", labels: { color: C.MU, boxWidth: 8, font: { size: 10 }, padding: 12 } }, tooltip: { ...tip, callbacks: { label: (c: any) => ` ${Number(c.raw)} (${Math.round(Number(c.raw) / (data?.activation?.created || 1) * 100)}%)` } } } },
    }
  }, [data, chartReady])

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div style={s.page}>
        <nav style={s.nav}>
          <img src="/logo.png" alt="VaekstNet" style={{ height: 22, display: "block", filter: "brightness(0) invert(1)", opacity: 0.9 }} />
        </nav>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 12 }}>
          <div style={{ color: "#7a7e9a", fontSize: 14 }}>Loading…</div>
        </div>
      </div>
    )
  }

  const maxCust = data?.topCustomers?.[0]?.totalAuc ?? 1

  const userTh = (label: string) => <th style={s.th}>{label}</th>
  const userTblRow = (c: any, i: number, color: string) => (
    <tr key={c.id}>
      <td style={s.td}><span style={s.rank}>{i + 1}</span></td>
      <td style={s.td}>
        <a href={`https://app-eu1.hubspot.com/contacts/${PORTAL}/contact/${c.id}`} target="_blank" rel="noreferrer" style={{ color, textDecoration: "none", fontWeight: 500 }}>{c.name}</a>
      </td>
      <td style={{ ...s.td, color: "#7a7e9a", fontSize: 11 }}>{c.email}</td>
      <td style={{ ...s.td, fontSize: 11, color: "#7a7e9a" }}>{c.owner}</td>
      <td style={{ ...s.td, fontSize: 11, color: "#7a7e9a" }}>{fmtDate(c.signupTime)}</td>
    </tr>
  )

  return (
    <div style={s.page}>

      {/* Nav */}
      <nav style={s.nav}>
        <img src="/logo.png" alt="VaekstNet" style={{ height: 22, display: "block", filter: "brightness(0) invert(1)", opacity: 0.9 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {data?.fetchedAt && <span style={{ fontSize: 10, color: "rgba(255,255,255,.35)" }}>Synced {new Date(data.fetchedAt).toLocaleString("da-DK", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
          <button onClick={handleSync} disabled={syncing} style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", padding: "4px 14px", border: "1px solid rgba(255,255,255,.2)", borderRadius: 4, background: "transparent", color: "rgba(255,255,255,.5)", cursor: "pointer", fontFamily: "inherit" }}>
            {syncing ? "Syncing… (1–2 min)" : "↻ Sync"}
          </button>
          <button onClick={() => signOut({ callbackUrl: "/login" })} style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", padding: "4px 12px", border: "1px solid rgba(255,255,255,.12)", borderRadius: 4, background: "transparent", color: "rgba(255,255,255,.3)", cursor: "pointer", fontFamily: "inherit" }}>
            Log out
          </button>
        </div>
      </nav>

      {/* Tab bar */}
      <div style={{ background: "#1a1d35", borderBottom: "1px solid rgba(255,255,255,.08)", display: "flex", padding: "0 24px", gap: 4 }}>
        <a href="/users" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", padding: "12px 14px", color: "#fff", textDecoration: "none", borderBottom: "2px solid #5a4998" }}>
          User Activation
        </a>
        <a href="/joakim" style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", padding: "12px 14px", color: "rgba(255,255,255,.4)", textDecoration: "none", borderBottom: "2px solid transparent" }}>
          Joakim VaekstNet Dashboard Draft
        </a>
      </div>

      <div style={s.main}>

        {/* Page title */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "#7a7e9a", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>Report</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#121428", margin: "0 0 4px" }}>User Activation · VaekstNet</h1>
          <p style={{ fontSize: 12, color: "#7a7e9a", margin: 0 }}>Contacts with customer_id — excl. test accounts · DKK</p>
        </div>

        {error && !data && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "24px", textAlign: "center", marginBottom: 24 }}>
            <div style={{ color: "#b91c1c", fontSize: 14, marginBottom: 12 }}>{error}</div>
            <button onClick={handleSync} disabled={syncing} style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: "#121428", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {syncing ? "Syncing… this takes 1–2 minutes" : "Sync from HubSpot"}
            </button>
          </div>
        )}

        {data && (<>

          {/* ── User Activation KPIs ─────────────────────────────────────── */}
          <div style={s.lbl}><span style={s.lblTxt}>User Activation · Since launch</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 4 }}>
            <div style={{ ...s.kpi, borderTop: `3px solid ${C.B}` }}>
              <div style={s.kpiLbl}>Downloaded app</div>
              <div style={{ ...s.kpiVal, color: C.B }}>{data.activation.appDownloads ?? "—"}</div>
              <div style={s.kpiSub}>{data.activation.appDownloads != null ? `${Math.round((data.activation.appDownloads) / (data.activation.created || 1) * 100)}% · iOS + Android registrations` : "Sync to populate"}</div>
            </div>
            <div style={{ ...s.kpi, borderTop: `3px solid ${C.G}` }}>
              <div style={s.kpiLbl}>Registered users</div>
              <div style={{ ...s.kpiVal, color: C.G }}>{data.activation.created}</div>
              <div style={s.kpiSub}>have Customer ID · excl. internal</div>
            </div>
            <div style={{ ...s.kpi, borderTop: `3px solid ${C.P}` }}>
              <div style={s.kpiLbl}>KYC complete</div>
              <div style={{ ...s.kpiVal, color: C.P }}>{data.activation.onboarded}</div>
              <div style={s.kpiSub}>{Math.round((data.activation.onboarded ?? 0) / (data.activation.created || 1) * 100)}% of registered</div>
            </div>
            <div style={{ ...s.kpi, borderTop: "3px solid #e06c75" }}>
              <div style={s.kpiLbl}>KYC pending</div>
              <div style={{ ...s.kpiVal, color: "#e06c75" }}>{(data.activation.created ?? 0) - (data.activation.onboarded ?? 0)}</div>
              <div style={s.kpiSub}>{Math.round(((data.activation.created ?? 0) - (data.activation.onboarded ?? 0)) / (data.activation.created || 1) * 100)}% of registered</div>
            </div>
            <div style={{ ...s.kpi, borderTop: `3px solid ${C.A}` }}>
              <div style={s.kpiLbl}>Funded users</div>
              <div style={{ ...s.kpiVal, color: C.A }}>{data.activation.funded}</div>
              <div style={s.kpiSub}>total_auc ≥ 1 · invested</div>
            </div>
          </div>

          {/* ── Charts ───────────────────────────────────────────────────── */}
          <div style={s.lbl}><span style={s.lblTxt}>Growth over time · Since launch</span></div>
          <div style={s.g2}>
            <div style={s.cc}>
              <div style={s.ccHead}><div><div style={s.ccTitle}>Cumulative users</div><div style={s.ccSub}>Created · Onboarded · Funded</div></div></div>
              <canvas id="u-c1" width={580} height={200} style={{ maxWidth: "100%" }} />
            </div>
            <div style={s.cc}>
              <div style={s.ccHead}><div><div style={s.ccTitle}>New users per month</div><div style={s.ccSub}>signup_time</div></div></div>
              <canvas id="u-c2" width={580} height={200} style={{ maxWidth: "100%" }} />
            </div>
          </div>
          <div style={{ ...s.mt }}>
            <div style={s.cc}>
              <div style={s.ccHead}><div><div style={s.ccTitle}>Activation funnel</div><div style={s.ccSub}>Created → Onboarded → Funded · since launch</div></div></div>
              <canvas id="u-c3" width={1200} height={200} style={{ maxWidth: "100%" }} />
            </div>
          </div>
          <div style={{ ...s.g2, marginTop: 12 }}>
            <div style={s.cc}>
              <div style={s.ccHead}><div><div style={s.ccTitle}>Onboarding rate over time</div><div style={s.ccSub}>Cumulative Onboarded / Created</div></div></div>
              <canvas id="u-c4" width={580} height={200} style={{ maxWidth: "100%" }} />
            </div>
            <div style={{ ...s.cc, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={s.ccHead}><div><div style={s.ccTitle}>Activation rate</div><div style={s.ccSub}>Onboarded / Created · since launch</div></div></div>
              <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: "-.02em", color: C.P, lineHeight: 1, paddingBottom: 8 }}>
                {Math.round((data.activation.onboarded ?? 0) / (data.activation.created || 1) * 100)}%
              </div>
              <div style={{ fontSize: 11, color: "#7a7e9a" }}>{data.activation.onboarded} of {data.activation.created} users onboarded</div>
            </div>
          </div>

          {/* ── Weekly activity ──────────────────────────────────────────── */}
          <div style={s.lbl}><span style={s.lblTxt}>Weekly activity · last 13 weeks</span></div>
          <div style={s.g2}>
            <div style={s.cc}>
              <div style={s.ccHead}><div><div style={s.ccTitle}>Weekly sign-ups &amp; KYC completions</div><div style={s.ccSub}>signup_time · onboarding_complete_time</div></div></div>
              {data.byWeek
                ? <canvas id="u-c6" width={580} height={200} style={{ maxWidth: "100%" }} />
                : <div style={{ padding: "40px 0", textAlign: "center", color: "#7a7e9a", fontSize: 12 }}>Click ↻ Sync to populate weekly data</div>}
            </div>
            <div style={s.cc}>
              <div style={s.ccHead}><div><div style={s.ccTitle}>Registration Device</div><div style={s.ccSub}>registration_device · all registered users</div></div></div>
              {(data.deviceBreakdown?.length ?? 0) > 0 ? (
                <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <canvas id="u-c7" width={180} height={180} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, paddingTop: 4 }}>
                    {data.deviceBreakdown?.map((d: any, i: number) => (
                      <div key={d.device} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #e2ddd4" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: DEV_COLORS[i % DEV_COLORS.length], flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: "#3c3f5e" }}>{d.device}</span>
                        </div>
                        <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#121428" }}>{d.count}</span>
                          <span style={{ fontSize: 11, color: "#7a7e9a", minWidth: 32, textAlign: "right" }}>{d.pct}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <div style={{ padding: "40px 0", textAlign: "center", color: "#7a7e9a", fontSize: 12 }}>No device data — sync to populate</div>}
            </div>
          </div>

          {/* ── KYC breakdown ────────────────────────────────────────────── */}
          <div style={{ ...s.lbl, marginTop: 28 }}><span style={s.lblTxt}>KYC status · onboarding_complete_time</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 4 }}>
            <div style={{ ...s.kpi, borderTop: `3px solid ${C.G}` }}>
              <div style={s.kpiLbl}>Registered</div>
              <div style={{ ...s.kpiVal, color: C.G }}>{data.activation.created}</div>
              <div style={s.kpiSub}>have Customer ID · excl. internal</div>
            </div>
            <div style={{ ...s.kpi, borderTop: `3px solid ${C.P}` }}>
              <div style={s.kpiLbl}>KYC complete</div>
              <div style={{ ...s.kpiVal, color: C.P }}>{data.activation.onboarded}</div>
              <div style={s.kpiSub}>{Math.round((data.activation.onboarded ?? 0) / (data.activation.created || 1) * 100)}% of registered · onboarding_complete_time set</div>
            </div>
            <div style={{ ...s.kpi, borderTop: "3px solid #e06c75" }}>
              <div style={s.kpiLbl}>KYC not completed</div>
              <div style={{ ...s.kpiVal, color: "#e06c75" }}>{(data.activation.created ?? 0) - (data.activation.onboarded ?? 0)}</div>
              <div style={s.kpiSub}>{Math.round(((data.activation.created ?? 0) - (data.activation.onboarded ?? 0)) / (data.activation.created || 1) * 100)}% of registered · no onboarding_complete_time</div>
            </div>
          </div>

          {/* ── Follow-up tables ─────────────────────────────────────────── */}
          <div style={s.lbl}><span style={s.lblTxt}>Follow up · users requiring action</span></div>

          <div style={s.mt}>
            <div style={s.tcard}>
              <div style={s.tcardH}><span style={s.tcardT}>Created but not onboarded</span><span style={s.tcardS}>Latest signup first · {data.notOnboarded?.length} contacts</span></div>
              <div style={{ overflowY: "auto", maxHeight: 420 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0, background: "#f7f5f0", zIndex: 1 }}><tr>{userTh("#")}{userTh("Name")}{userTh("Email")}{userTh("Contact owner")}{userTh("Signup")}</tr></thead>
                  <tbody>{data.notOnboarded?.map((c: any, i: number) => userTblRow(c, i, C.G))}</tbody>
                </table>
              </div>
            </div>
          </div>

          <div style={s.mt}>
            <div style={s.tcard}>
              <div style={s.tcardH}><span style={s.tcardT}>Onboarded but not funded</span><span style={s.tcardS}>Latest signup first · {data.notFunded?.length} contacts</span></div>
              <div style={{ overflowY: "auto", maxHeight: 420 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0, background: "#f7f5f0", zIndex: 1 }}><tr>{userTh("#")}{userTh("Name")}{userTh("Email")}{userTh("Contact owner")}{userTh("Signup")}</tr></thead>
                  <tbody>{data.notFunded?.map((c: any, i: number) => userTblRow(c, i, C.P))}</tbody>
                </table>
              </div>
            </div>
          </div>

          <div style={s.mt}>
            <div style={s.tcard}>
              <div style={s.tcardH}><span style={s.tcardT}>Funded users</span><span style={s.tcardS}>Latest signup first · {data.funded?.length} contacts</span></div>
              <div style={{ overflowY: "auto", maxHeight: 420 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0, background: "#f7f5f0", zIndex: 1 }}><tr>{userTh("#")}{userTh("Name")}{userTh("Email")}{userTh("Contact owner")}{userTh("Signup")}</tr></thead>
                  <tbody>{data.funded?.map((c: any, i: number) => userTblRow(c, i, C.A))}</tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── AUC ─────────────────────────────────────────────────────── */}
          <div style={{ ...s.lbl, marginTop: 40 }}><span style={s.lblTxt}>Assets under custody · as of sync date</span></div>
          <div style={{ ...s.g4, marginBottom: 12 }}>
            <div style={{ ...s.kpi, borderTop: `3px solid ${C.G}` }}>
              <div style={s.kpiLbl}>Total AuC</div>
              <div style={{ ...s.kpiVal, fontSize: 24, color: C.G }}>{fmtShort(data.auc.total ?? 0)}</div>
              <div style={s.kpiSub}>Contacts + Companies</div>
            </div>
            <div style={{ ...s.kpi, borderTop: `3px solid ${C.P}` }}>
              <div style={s.kpiLbl}>of which VK funds</div>
              <div style={{ ...s.kpiVal, fontSize: 24, color: C.P }}>{fmtShort(data.auc.vkFunds ?? 0)}</div>
              <div style={s.kpiSub}>{Math.round((data.auc.vkFunds ?? 0) / (data.auc.total || 1) * 100)}% of total AuC</div>
            </div>
            <div style={{ ...s.kpi, borderTop: `3px solid ${C.A}` }}>
              <div style={s.kpiLbl}>of which listed</div>
              <div style={{ ...s.kpiVal, fontSize: 24, color: C.A }}>{fmtShort(data.auc.listed ?? 0)}</div>
              <div style={s.kpiSub}>{Math.round((data.auc.listed ?? 0) / (data.auc.total || 1) * 100)}% of total AuC</div>
            </div>
            <div style={{ ...s.kpi, borderTop: `3px solid #7a7e9a` }}>
              <div style={s.kpiLbl}>Invested users</div>
              <div style={{ ...s.kpiVal, fontSize: 24, color: "#121428" }}>{data.activation.invested}</div>
              <div style={s.kpiSub}>invested_in_vaekstnet = Yes</div>
            </div>
          </div>

          <div style={s.g21}>
            <div style={s.g11}>
              <div style={s.acard}>
                <div style={s.acardH}>Contacts · {data.auc.contacts.count}</div>
                {[["Total AuC", fmt(data.auc.contacts.total ?? 0), C.G], ["in VK funds", fmt(data.auc.contacts.vkFunds ?? 0), C.P], ["listed", fmt(data.auc.contacts.listed ?? 0), C.A], ["liquid", fmt(data.auc.contacts.cash ?? 0), C.B], ["avg. per contact", fmt((data.auc.contacts.total ?? 0) / (data.auc.contacts.count || 1)), "#121428"]].map(([l, v, c]) => (
                  <div key={l} style={s.arow}><span style={s.arowL}>{l}</span><span style={{ ...s.arowV, color: c }}>{v}</span></div>
                ))}
              </div>
              <div style={s.acard}>
                <div style={s.acardH}>Companies · {data.auc.companies.count}</div>
                {[["Total AuC", fmt(data.auc.companies.total ?? 0), C.G], ["in VK funds", fmt(data.auc.companies.vkFunds ?? 0), C.P], ["listed", fmt(data.auc.companies.listed ?? 0), C.A], ["liquid", fmt(data.auc.companies.cash ?? 0), C.B], ["avg. per company", fmt((data.auc.companies.total ?? 0) / (data.auc.companies.count || 1)), "#121428"]].map(([l, v, c]) => (
                  <div key={l} style={s.arow}><span style={s.arowL}>{l}</span><span style={{ ...s.arowV, color: c }}>{v}</span></div>
                ))}
              </div>
            </div>
            <div style={s.cc}>
              <div style={s.ccHead}><div><div style={s.ccTitle}>AuC distribution</div><div style={s.ccSub}>VK funds · listed · liquid</div></div></div>
              <canvas id="u-c5" width={340} height={200} style={{ maxWidth: "100%" }} />
            </div>
          </div>

          {/* ── Top 10 customers ─────────────────────────────────────────── */}
          <div style={s.lbl}><span style={s.lblTxt}>Top 10 customers · AuC</span></div>
          <div style={s.mt}>
            <div style={s.tcard}>
              <div style={s.tcardH}><span style={s.tcardT}>Largest customers by total AuC</span><span style={s.tcardS}>Contacts + Companies · VK funds + listed + liquid</span></div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["#","Name","Type","Contact owner"].map(h => <th key={h} style={s.th}>{h}</th>)}
                    {["VK Funds","Listed","Liquid","Total AuC"].map(h => <th key={h} style={{ ...s.th, textAlign: "right" }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.topCustomers.map((c: any, i: number) => (
                    <tr key={c.name + i}>
                      <td style={s.td}><span style={s.rank}>{i + 1}</span></td>
                      <td style={s.td}>
                        <div style={{ fontWeight: 500 }}>{c.name}</div>
                        <div style={{ height: 4, background: "#f0ede6", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                          <div style={{ width: `${Math.round(c.totalAuc / maxCust * 100)}%`, height: "100%", background: c.type === "Company" ? C.B : C.G, borderRadius: 2 }} />
                        </div>
                      </td>
                      <td style={s.td}><span style={{ fontSize: 9, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 3, background: c.type === "Company" ? "rgba(45,104,176,.1)" : "rgba(21,97,76,.1)", color: c.type === "Company" ? C.B : C.G }}>{c.type}</span></td>
                      <td style={{ ...s.td, fontSize: 11 }}>{c.consultant}</td>
                      <td style={{ ...s.tdr, color: C.P, fontWeight: 500 }}>{fmt(c.vkFunds)}</td>
                      <td style={{ ...s.tdr, color: C.A, fontWeight: 500 }}>{fmt(c.listed)}</td>
                      <td style={{ ...s.tdr, color: C.B, fontWeight: 500 }}>{fmt(c.cash)}</td>
                      <td style={{ ...s.tdr, color: C.G, fontWeight: 600 }}>{fmt(c.totalAuc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ height: 48 }} />
        </>)}
      </div>
    </div>
  )
}
