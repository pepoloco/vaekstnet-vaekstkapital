"use client"
// @ts-nocheck
import { useEffect, useRef, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import DashboardTabs from "@/app/components/DashboardTabs"

const PORTAL = "144061788"

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
  R: "#c0392b", Rd: "rgba(192,57,43,.1)",
  MU: "#7a7e9a",
}
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

const s = {
  page:    { minHeight: "100vh", background: "#f7f5f0", fontFamily: "inherit" },
  nav:     { background: "#121428", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", position: "sticky" as const, top: 0, zIndex: 50 },
  tabs:    { background: "#1a1d35", borderBottom: "1px solid rgba(255,255,255,.08)", display: "flex", padding: "0 24px", gap: 4 },
  main:    { maxWidth: 1280, margin: "0 auto", padding: "28px 24px" },
  lbl:     { padding: "18px 0 8px", borderTop: "1px solid #e2ddd4", marginTop: 28 },
  lblTxt:  { fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" as const, color: "#7a7e9a" },
  g4:      { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 4 },
  g3:      { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 4 },
  kpi:     { background: "#fff", border: "1px solid #e2ddd4", borderRadius: 10, padding: "16px 20px" },
  kpiLbl:  { fontSize: 10, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase" as const, color: "#7a7e9a", marginBottom: 8 },
  kpiVal:  { fontSize: 36, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1 },
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
  rank:    { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: "#f0ede6", fontSize: 10, fontWeight: 700, color: "#7a7e9a" },
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; bg: string; color: string }> = {
    "needs-app":   { label: "Not Registered Yet", bg: "rgba(192,57,43,.1)",   color: "#c0392b" },
    "kyc-pending": { label: "Not Onboarded Yet",  bg: "rgba(150,128,58,.13)", color: "#96803a" },
    "onboarded":   { label: "Onboarded",   bg: "rgba(21,97,76,.12)",   color: "#15624c" },
  }
  const c = cfg[status] ?? { label: status, bg: "#f0ede6", color: "#7a7e9a" }
  return (
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 3, background: c.bg, color: c.color }}>
      {c.label}
    </span>
  )
}

function DaysBadge({ days }: { days: number | null }) {
  if (days === null) return <span style={{ color: "#7a7e9a" }}>—</span>
  const color = days <= 30 ? "#c0392b" : days <= 90 ? "#96803a" : "#7a7e9a"
  const weight = days <= 30 ? 700 : 400
  return <span style={{ fontVariantNumeric: "tabular-nums", color, fontWeight: weight }}>{days}d</span>
}

function HsLink({ id, type, name, color }: { id: string; type: "contact" | "company"; name: string; color: string }) {
  return (
    <a
      href={`https://app-eu1.hubspot.com/contacts/${PORTAL}/${type}/${id}`}
      target="_blank" rel="noreferrer"
      style={{ color, textDecoration: "none", fontWeight: 500 }}
    >
      {name}
    </a>
  )
}

export default function JoakimPage() {
  const { status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState("")
  const [chartReady, setChartReady] = useState(false)
  const [contacted, setContacted] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const stored = localStorage.getItem("joakim-contacted")
      if (stored) setContacted(JSON.parse(stored))
    } catch {}
  }, [])

  function toggleContacted(id: string) {
    setContacted(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem("joakim-contacted", JSON.stringify(next)) } catch {}
      return next
    })
  }

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

  useEffect(() => {
    if (status !== "authenticated") return
    fetch("/api/joakim-data")
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false) })
      .catch(() => { setError("Failed to load"); setLoading(false) })
  }, [status])

  async function handleSync() {
    setSyncing(true)
    setError("")
    try {
      const r = await fetch("/api/joakim-sync")
      const j = await r.json()
      if (j.error) { setError(j.error); setSyncing(false); return }
      const d = await fetch("/api/joakim-data").then(r => r.json())
      if (!d.error) setData(d)
    } catch (e) {
      setError("Sync failed: " + e)
    }
    setSyncing(false)
  }

  const base = { responsive: false, animation: { duration: 500 }, plugins: { legend: { display: false }, tooltip: tip }, scales: sc }

  useChart("j-c1", () => ({
    type: "bar",
    data: {
      labels: data?.byMonth?.map((m: any) => MONTH_LABELS[m.month] ?? m.month) ?? [],
      datasets: [
        { label: "New VK investors (closed-won deals)", data: data?.byMonth?.map((m: any) => m.newInvestors) ?? [], backgroundColor: C.Bd, borderColor: C.B, borderWidth: 1.5, borderRadius: 4 },
        { label: "VaekstNet onboardings", data: data?.byMonth?.map((m: any) => m.newOnboardings) ?? [], backgroundColor: C.Gd, borderColor: C.G, borderWidth: 1.5, borderRadius: 4 },
      ],
    },
    options: {
      ...base,
      interaction: { mode: "index", intersect: false },
      plugins: { ...base.plugins, legend: { display: true, labels: { color: C.MU, boxWidth: 8, font: { size: 10 }, padding: 16 } } },
    },
  }), [data, chartReady])

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

  const TH = (label: string, right = false) => (
    <th style={{ ...s.th, textAlign: right ? "right" : "left" }}>{label}</th>
  )

  return (
    <div style={s.page}>

      {/* Nav */}
      <nav style={s.nav}>
        <img src="/logo.png" alt="VaekstNet" style={{ height: 22, display: "block", filter: "brightness(0) invert(1)", opacity: 0.9 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {data?.fetchedAt && (
            <span style={{ fontSize: 10, color: "rgba(255,255,255,.35)" }}>
              Synced {new Date(data.fetchedAt).toLocaleString("da-DK", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button onClick={handleSync} disabled={syncing} style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", padding: "4px 14px", border: "1px solid rgba(255,255,255,.2)", borderRadius: 4, background: "transparent", color: "rgba(255,255,255,.5)", cursor: "pointer", fontFamily: "inherit" }}>
            {syncing ? "Syncing… (1–2 min)" : "↻ Sync"}
          </button>
          <button onClick={() => signOut({ callbackUrl: "/login" })} style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", padding: "4px 12px", border: "1px solid rgba(255,255,255,.12)", borderRadius: 4, background: "transparent", color: "rgba(255,255,255,.3)", cursor: "pointer", fontFamily: "inherit" }}>
            Log out
          </button>
        </div>
      </nav>

      <DashboardTabs active="/joakim" />

      <div style={s.main}>

        {/* Title */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "#7a7e9a", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>Report</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#121428", margin: "0 0 4px" }}>Joakim VaekstNet Dashboard</h1>
          <p style={{ fontSize: 12, color: "#7a7e9a", margin: 0 }}>Based on closed-won deals · sorted by investment date · contacts requiring VaekstNet onboarding</p>
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

          {/* ── KPI cards ────────────────────────────────────────────── */}
          <div style={s.lbl}><span style={s.lblTxt}>Onboarding pipeline · based on closed-won deals</span></div>
          <div style={s.g4}>
            <div style={{ ...s.kpi, borderTop: `3px solid ${C.R}` }}>
              <div style={s.kpiLbl}>Require onboarding</div>
              <div style={{ ...s.kpiVal, color: C.R }}>{data.summary.totalNeedingOnboarding}</div>
              <div style={s.kpiSub}>individuals + companies without VaekstNet onboarding</div>
            </div>
            <div style={{ ...s.kpi, borderTop: `3px solid ${C.B}` }}>
              <div style={s.kpiLbl}>Individuals</div>
              <div style={{ ...s.kpiVal, color: C.B }}>{data.summary.individualsNeedingOnboarding}</div>
              <div style={s.kpiSub}>contacts with closed-won deals, no onboarding_complete_time</div>
            </div>
            <div style={{ ...s.kpi, borderTop: `3px solid ${C.P}` }}>
              <div style={s.kpiLbl}>Companies</div>
              <div style={{ ...s.kpiVal, color: C.P }}>{data.summary.companiesNeedingOnboarding}</div>
              <div style={s.kpiSub}>no associated contact has completed onboarding</div>
            </div>
            <div style={{ ...s.kpi, borderTop: `3px solid ${C.A}` }}>
              <div style={s.kpiLbl}>New (last 30 days)</div>
              <div style={{ ...s.kpiVal, color: C.A }}>{data.summary.newThisMonth}</div>
              <div style={s.kpiSub}>closed-won deal in last 30 days, not yet onboarded</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 12 }}>
            <div style={{ ...s.kpi, borderTop: `3px solid ${C.G}` }}>
              <div style={s.kpiLbl}>Recently onboarded</div>
              <div style={{ ...s.kpiVal, color: C.G }}>{data.summary.recentlyOnboardedCount}</div>
              <div style={s.kpiSub}>completed VaekstNet onboarding in last 90 days · call to welcome</div>
            </div>
            <div style={{ ...s.kpi, borderTop: "3px solid #8b5cf6" }}>
              <div style={s.kpiLbl}>Companies · contact onboarded</div>
              <div style={{ ...s.kpiVal, color: "#8b5cf6" }}>{data.summary.companiesWithOnboardedContact}</div>
              <div style={s.kpiSub}>company has at least one onboarded contact — verify transfer</div>
            </div>
            <div style={{ ...s.kpi, borderTop: "3px solid #7a7e9a" }}>
              <div style={s.kpiLbl}>Total investors tracked</div>
              <div style={{ ...s.kpiVal, color: "#121428" }}>{data.summary.totalInvestors}</div>
              <div style={s.kpiSub}>unique contacts from closed-won deals · excl. test accounts</div>
            </div>
          </div>

          {/* ── Chart ────────────────────────────────────────────────── */}
          <div style={{ ...s.lbl, marginTop: 28 }}><span style={s.lblTxt}>Monthly trends · new VK investors vs VaekstNet onboardings</span></div>
          <div style={s.cc}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={s.ccTitle}>New closed-won deals vs VaekstNet onboardings per month</div>
                <div style={s.ccSub}>deal closedate · onboarding_complete_time</div>
              </div>
            </div>
            <canvas id="j-c1" width={1200} height={220} style={{ maxWidth: "100%" }} />
          </div>

          {/* ── Table 1: Individuals needing onboarding ──────────────── */}
          <div style={{ ...s.lbl, marginTop: 28 }}>
            <span style={s.lblTxt}>
              1 · Individuals requiring VaekstNet onboarding &nbsp;·&nbsp; {data.individualsNeedingOnboarding?.length} contacts
            </span>
          </div>
          <div style={s.tcard}>
            <div style={s.tcardH}>
              <span style={s.tcardT}>Contacts with closed-won deals — no VaekstNet onboarding</span>
              <span style={s.tcardS}>Sorted by investment date, newest first</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <div style={{ overflowY: "auto", maxHeight: 520 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr>{TH("#")}{TH("Name")}{TH("Status")}{TH("Investment date")}{TH("Days since")}{TH("VK AuC", true)}{TH("Contact owner")}{TH("Phone")}</tr>
                  </thead>
                  <tbody>
                    {data.individualsNeedingOnboarding?.map((r: any, i: number) => (
                      <tr key={r.id} style={{ background: r.daysSinceInvestment !== null && r.daysSinceInvestment <= 30 ? "rgba(192,57,43,.03)" : undefined }}>
                        <td style={s.td}><span style={s.rank}>{i + 1}</span></td>
                        <td style={s.td}>
                          <HsLink id={r.id} type="contact" name={r.name} color={C.G} />
                          {r.email && <div style={{ fontSize: 10, color: "#7a7e9a", marginTop: 1 }}>{r.email}</div>}
                        </td>
                        <td style={s.td}><StatusBadge status={r.status} /></td>
                        <td style={{ ...s.td, color: "#7a7e9a", fontSize: 11 }}>{fmtDate(r.investmentDate)}</td>
                        <td style={s.td}><DaysBadge days={r.daysSinceInvestment} /></td>
                        <td style={{ ...s.tdr, color: C.P, fontWeight: 500 }}>{r.vkAuc > 0 ? fmtShort(r.vkAuc) : "—"}</td>
                        <td style={{ ...s.td, fontSize: 11, color: "#7a7e9a" }}>{r.owner}</td>
                        <td style={s.td}>
                          {r.phone
                            ? <a href={`tel:${r.phone}`} style={{ color: C.G, textDecoration: "none", fontWeight: 500 }}>{r.phone}</a>
                            : <span style={{ color: "#c9c5bb" }}>—</span>}
                        </td>
                      </tr>
                    ))}
                    {(!data.individualsNeedingOnboarding || data.individualsNeedingOnboarding.length === 0) && (
                      <tr><td colSpan={8} style={{ ...s.td, textAlign: "center", padding: "32px 16px", color: "#7a7e9a" }}>No records — click ↻ Sync to load from HubSpot</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Table 2: Companies needing onboarding ────────────────── */}
          <div style={{ ...s.lbl, marginTop: 28 }}>
            <span style={s.lblTxt}>
              2 · Companies requiring VaekstNet onboarding &nbsp;·&nbsp; {data.companiesNeedingOnboarding?.length} companies
            </span>
          </div>
          <div style={s.tcard}>
            <div style={s.tcardH}>
              <span style={s.tcardT}>Companies with closed-won deals — no associated contact has onboarded</span>
              <span style={s.tcardS}>Sorted by investment date, newest first</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <div style={{ overflowY: "auto", maxHeight: 440 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr>{TH("#")}{TH("Company")}{TH("Associated contacts")}{TH("Investment date")}{TH("Days since")}{TH("VK AuC", true)}{TH("Contact owner")}{TH("Phone")}</tr>
                  </thead>
                  <tbody>
                    {data.companiesNeedingOnboarding?.map((r: any, i: number) => (
                      <tr key={r.id} style={{ background: r.daysSinceInvestment !== null && r.daysSinceInvestment <= 30 ? "rgba(192,57,43,.03)" : undefined }}>
                        <td style={s.td}><span style={s.rank}>{i + 1}</span></td>
                        <td style={s.td}>
                          <HsLink id={r.id} type="company" name={r.name} color={C.B} />
                        </td>
                        <td style={s.td}>
                          {r.pendingContacts?.length > 0
                            ? <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                {r.pendingContacts.map((c: any, j: number) => (
                                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ fontSize: 11, color: "#3c3f5e" }}>{c.name}</span>
                                    <StatusBadge status={c.status} />
                                  </div>
                                ))}
                              </div>
                            : <span style={{ color: "#c9c5bb", fontSize: 11 }}>No contacts linked</span>
                          }
                        </td>
                        <td style={{ ...s.td, color: "#7a7e9a", fontSize: 11 }}>{fmtDate(r.investmentDate)}</td>
                        <td style={s.td}><DaysBadge days={r.daysSinceInvestment} /></td>
                        <td style={{ ...s.tdr, color: C.P, fontWeight: 500 }}>{r.vkAuc > 0 ? fmtShort(r.vkAuc) : "—"}</td>
                        <td style={{ ...s.td, fontSize: 11, color: "#7a7e9a" }}>{r.owner}</td>
                        <td style={s.td}>
                          {r.phone
                            ? <a href={`tel:${r.phone}`} style={{ color: C.B, textDecoration: "none", fontWeight: 500 }}>{r.phone}</a>
                            : <span style={{ color: "#c9c5bb" }}>—</span>}
                        </td>
                      </tr>
                    ))}
                    {(!data.companiesNeedingOnboarding || data.companiesNeedingOnboarding.length === 0) && (
                      <tr><td colSpan={8} style={{ ...s.td, textAlign: "center", padding: "32px 16px", color: "#7a7e9a" }}>No company records — click ↻ Sync to load from HubSpot</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Table 3: Companies with onboarded contact ─────────────── */}
          <div style={{ ...s.lbl, marginTop: 28 }}>
            <span style={s.lblTxt}>
              3 · Companies with an onboarded contact &nbsp;·&nbsp; {data.companiesWithOnboardedContact?.length} companies
            </span>
          </div>
          <div style={{ ...s.tcard, borderTop: "3px solid #8b5cf6" }}>
            <div style={s.tcardH}>
              <span style={s.tcardT}>A person from this company has completed VaekstNet onboarding</span>
              <span style={s.tcardS}>Verify assets are transferred to VaekstNet · may still need follow-up for other contacts</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <div style={{ overflowY: "auto", maxHeight: 440 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr>{TH("#")}{TH("Company")}{TH("Onboarded contact(s)")}{TH("Other contacts")}{TH("Investment date")}{TH("VK AuC", true)}{TH("Contact owner")}</tr>
                  </thead>
                  <tbody>
                    {data.companiesWithOnboardedContact?.map((r: any, i: number) => (
                      <tr key={r.id}>
                        <td style={s.td}><span style={s.rank}>{i + 1}</span></td>
                        <td style={s.td}>
                          <HsLink id={r.id} type="company" name={r.name} color="#8b5cf6" />
                        </td>
                        <td style={s.td}>
                          {r.onboardedContacts?.map((c: any, j: number) => (
                            <div key={j} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: j < r.onboardedContacts.length - 1 ? 4 : 0 }}>
                              <span style={{ fontSize: 11, color: C.G, fontWeight: 500 }}>{c.name}</span>
                              <span style={{ fontSize: 10, color: "#7a7e9a" }}>{fmtDate(c.onboardingDate)}</span>
                            </div>
                          ))}
                        </td>
                        <td style={s.td}>
                          {r.pendingContacts?.length > 0
                            ? <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                {r.pendingContacts.map((c: any, j: number) => (
                                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ fontSize: 11, color: "#7a7e9a" }}>{c.name}</span>
                                    <StatusBadge status={c.status} />
                                  </div>
                                ))}
                              </div>
                            : <span style={{ fontSize: 11, color: "#c9c5bb" }}>All onboarded</span>
                          }
                        </td>
                        <td style={{ ...s.td, color: "#7a7e9a", fontSize: 11 }}>{fmtDate(r.investmentDate)}</td>
                        <td style={{ ...s.tdr, color: C.P, fontWeight: 500 }}>{r.vkAuc > 0 ? fmtShort(r.vkAuc) : "—"}</td>
                        <td style={{ ...s.td, fontSize: 11, color: "#7a7e9a" }}>{r.owner}</td>
                      </tr>
                    ))}
                    {(!data.companiesWithOnboardedContact || data.companiesWithOnboardedContact.length === 0) && (
                      <tr><td colSpan={7} style={{ ...s.td, textAlign: "center", padding: "32px 16px", color: "#7a7e9a" }}>No company has an onboarded contact yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Table 4: Recently onboarded ──────────────────────────── */}
          <div style={{ ...s.lbl, marginTop: 28 }}>
            <span style={s.lblTxt}>
              4 · Recently onboarded to VaekstNet · last 90 days &nbsp;·&nbsp; {data.recentlyOnboarded?.length} contacts
            </span>
          </div>
          <div style={{ ...s.tcard, borderTop: `3px solid ${C.G}` }}>
            <div style={s.tcardH}>
              <span style={s.tcardT}>Completed VaekstNet onboarding in last 90 days — call to welcome &amp; support</span>
              <span style={s.tcardS}>onboarding_complete_time · sorted by onboarding date</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                <thead>
                  <tr>{TH("#")}{TH("Name")}{TH("Onboarded")}{TH("Investment date")}{TH("VK AuC", true)}{TH("Total AuC", true)}{TH("Contact owner")}{TH("Phone")}{TH("Contacted")}</tr>
                </thead>
                <tbody>
                  {data.recentlyOnboarded?.map((r: any, i: number) => {
                    const done = !!contacted[r.id]
                    return (
                    <tr key={r.id} style={{ opacity: done ? 0.5 : 1, background: done ? "#fafaf8" : undefined }}>
                      <td style={s.td}><span style={s.rank}>{i + 1}</span></td>
                      <td style={s.td}>
                        <HsLink id={r.id} type="contact" name={r.name} color={C.G} />
                        {r.email && <div style={{ fontSize: 10, color: "#7a7e9a", marginTop: 1 }}>{r.email}</div>}
                      </td>
                      <td style={{ ...s.td, color: C.G, fontWeight: 500 }}>{fmtDate(r.onboardingDate)}</td>
                      <td style={{ ...s.td, color: "#7a7e9a", fontSize: 11 }}>{fmtDate(r.investmentDate)}</td>
                      <td style={{ ...s.tdr, color: C.P, fontWeight: 500 }}>{r.vkAuc > 0 ? fmtShort(r.vkAuc) : "—"}</td>
                      <td style={{ ...s.tdr, color: C.G, fontWeight: 500 }}>{r.totalAuc > 0 ? fmtShort(r.totalAuc) : "—"}</td>
                      <td style={{ ...s.td, fontSize: 11, color: "#7a7e9a" }}>{r.owner}</td>
                      <td style={s.td}>
                        {r.phone
                          ? <a href={`tel:${r.phone}`} style={{ color: C.G, textDecoration: "none", fontWeight: 500 }}>{r.phone}</a>
                          : <span style={{ color: "#c9c5bb" }}>—</span>}
                      </td>
                      <td style={{ ...s.td, textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() => toggleContacted(r.id)}
                          style={{ width: 16, height: 16, cursor: "pointer", accentColor: C.G }}
                        />
                      </td>
                    </tr>
                    )
                  })}
                  {(!data.recentlyOnboarded || data.recentlyOnboarded.length === 0) && (
                    <tr><td colSpan={9} style={{ ...s.td, textAlign: "center", padding: "32px 16px", color: "#7a7e9a" }}>No recent VaekstNet onboardings</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Status legend */}
          <div style={{ marginTop: 20, padding: "14px 16px", background: "#fff", border: "1px solid #e2ddd4", borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#7a7e9a", marginBottom: 10 }}>Status legend</div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {[
                { status: "needs-app", desc: "Has a closed-won deal but has not registered on the VaekstNet app (no customer_id)" },
                { status: "kyc-pending", desc: "Has a VaekstNet account (customer_id) but has not completed KYC / onboarding" },
              ].map(({ status, desc }) => (
                <div key={status} style={{ display: "flex", alignItems: "flex-start", gap: 8, maxWidth: 340 }}>
                  <StatusBadge status={status} />
                  <span style={{ fontSize: 11, color: "#7a7e9a", lineHeight: 1.4 }}>{desc}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: "#7a7e9a" }}>
              <span style={{ fontWeight: 600, color: C.R }}>Red days</span> = deal closed in last 30 days (highest priority, rows are highlighted).
              Data source: closed-won deal stages only — excludes lost deals, subscription-only, and other prospects.
            </div>
          </div>

          <div style={{ height: 48 }} />
        </>)}
      </div>
    </div>
  )
}
