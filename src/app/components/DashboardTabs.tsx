"use client"

const TABS = [
  { href: "/users", label: "User Activation" },
  { href: "/joakim", label: "Joakim VaekstNet Dashboard" },
  { href: "/qr-analytics", label: "QR Analytics" },
]

export default function DashboardTabs({ active }: { active: string }) {
  return (
    <div style={{ background: "#1a1d35", borderBottom: "1px solid rgba(255,255,255,.08)", display: "flex", padding: "0 24px", gap: 4 }}>
      {TABS.map(t => (
        <a
          key={t.href}
          href={t.href}
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            padding: "12px 14px",
            textDecoration: "none",
            color: active === t.href ? "#fff" : "rgba(255,255,255,.4)",
            borderBottom: active === t.href ? "2px solid #5a4998" : "2px solid transparent",
          }}
        >
          {t.label}
        </a>
      ))}
    </div>
  )
}
