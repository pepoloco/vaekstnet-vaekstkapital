import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

const HUBSPOT_BASE = "https://api.hubapi.com"

// ─── Date windows ──────────────────────────────────────────────────────────────
const now              = new Date()
const days  = (n: number) => new Date(now.getTime() - n * 86_400_000)

const W12_START   = days(84)   // 12 weeks ago  → results window
const W1_START    = days(84)   // W1  = oldest week in window
const W1_END      = days(77)
const W12_START_W = days(7)    // W12 = most recent week
const L4W_START   = days(28)   // last 4 weeks  → "recent" performance
const P8W_START   = days(84)   // prior 8 weeks → "historical" baseline
const P8W_END     = days(28)   // (ends where last 4w begins)

// ─── HubSpot helpers ───────────────────────────────────────────────────────────

async function hsPost(apiKey: string, path: string, body: object) {
  const res = await fetch(`${HUBSPOT_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HubSpot ${path}: ${await res.text()}`)
  return res.json()
}

async function hsGet(apiKey: string, path: string) {
  const res = await fetch(`${HUBSPOT_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`HubSpot ${path}: ${await res.text()}`)
  return res.json()
}

/** Paginate through all results of a CRM search */
async function fetchAll(apiKey: string, path: string, body: object): Promise<any[]> {
  const results: any[] = []
  let after: string | undefined
  do {
    const page: any = await hsPost(apiKey, path, after ? { ...body, after } : body)
    results.push(...(page.results ?? []))
    after = page.paging?.next?.after
  } while (after)
  return results
}

function ms(d: Date) { return d.getTime().toString() }
function inWindow(d: any, start: Date, end: Date = now) {
  const t = new Date(d.properties.closedate).getTime()
  return t >= start.getTime() && t <= end.getTime()
}

// ─── Main route ────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) return NextResponse.json({ error: "HUBSPOT_API_KEY not set" }, { status: 500 })

  try {
    // ── 1. All closed-won deals in the last 12 weeks ─────────────────────────
    const deals12w = await fetchAll(apiKey, "/crm/v3/objects/deals/search", {
      filterGroups: [{ filters: [
        { propertyName: "hs_is_closed_won", operator: "EQ",  value: "true" },
        { propertyName: "closedate",        operator: "GTE", value: ms(W12_START) },
      ]}],
      properties: ["amount", "closedate", "createdate", "hubspot_owner_id"],
      limit: 200,
    })

    // ── 2. Deals in PRIOR 8-week window (for last4 vs past8 comparison) ──────
    const dealsPrior8w = await fetchAll(apiKey, "/crm/v3/objects/deals/search", {
      filterGroups: [{ filters: [
        { propertyName: "hs_is_closed_won", operator: "EQ",  value: "true" },
        { propertyName: "closedate",        operator: "GTE", value: ms(P8W_START) },
        { propertyName: "closedate",        operator: "LT",  value: ms(P8W_END)  },
      ]}],
      properties: ["amount", "closedate", "hubspot_owner_id"],
      limit: 200,
    })

    // ── 3. All owners ────────────────────────────────────────────────────────
    const ownersData  = await hsGet(apiKey, "/crm/v3/owners?limit=100")
    const allOwners: any[] = ownersData.results ?? []

    // Only owners who closed at least one deal in the 12w window
    const activeOwnerIds = [...new Set(
      deals12w.map((d: any) => d.properties.hubspot_owner_id).filter(Boolean)
    )] as string[]
    const activeOwners = allOwners.filter(
      (o: any) => activeOwnerIds.includes(String(o.id)) && o.firstName
    )

    // ── 4. Contacts (leads) owned by active consultants ───────────────────────
    const contacts = activeOwnerIds.length > 0
      ? await fetchAll(apiKey, "/crm/v3/objects/contacts/search", {
          filterGroups: [{ filters: [{
            propertyName: "hubspot_owner_id",
            operator: "IN",
            values: activeOwnerIds,
          }]}],
          properties: ["hubspot_owner_id", "createdate"],
          limit: 200,
        })
      : []

    // ── 5. Build per-consultant stats ─────────────────────────────────────────
    const rawConsultants = activeOwners.map((owner: any) => {
      const oid = String(owner.id)

      // Slice deals for this owner
      const od12w    = deals12w.filter((d: any)     => d.properties.hubspot_owner_id === oid)
      const odPrior  = dealsPrior8w.filter((d: any) => d.properties.hubspot_owner_id === oid)
      const odL4w    = od12w.filter(d => inWindow(d, L4W_START))       // last 4w
      const odW1     = od12w.filter(d => inWindow(d, W1_START, W1_END))
      const odW12    = od12w.filter(d => inWindow(d, W12_START_W))

      // Results – 12 weeks
      const amount12w = od12w.reduce((s, d) => s + parseFloat(d.properties.amount || "0"), 0)
      const count12w  = od12w.length
      const ticket    = count12w > 0 ? Math.round(amount12w / count12w) : 0

      // Last 4w vs prior 8w (normalised to 4w equivalent)
      const l4wCount     = odL4w.length
      const prior8wPer4w = odPrior.length / 2   // 8 weeks → per-4-week rate
      const last4GtPast8 = l4wCount > prior8wPer4w ? "Yes" : "No"

      // Meeting index: how much better is last 4w vs historical rate (100 = on par)
      const meetingIndex = prior8wPer4w > 0
        ? Math.min(Math.round((l4wCount / prior8wPer4w) * 100), 999)
        : l4wCount > 0 ? 200 : 0

      // Leads (contacts) for this owner
      const leadsL4w   = contacts.filter((c: any) => {
        const t = new Date(c.properties.createdate)
        return c.properties.hubspot_owner_id === oid && t >= L4W_START
      })
      const leadsPrior = contacts.filter((c: any) => {
        const t = new Date(c.properties.createdate)
        return c.properties.hubspot_owner_id === oid && t >= P8W_START && t < P8W_END
      })
      const leads12w   = contacts.filter((c: any) => {
        const t = new Date(c.properties.createdate)
        return c.properties.hubspot_owner_id === oid && t >= W12_START
      })

      // Hitrate: closed-won deals / total leads assigned in 12w
      const hitrate = leads12w.length > 0 ? od12w.length / leads12w.length : 0

      // Conv duration: avg days from deal create → close (proxy for call-to-close duration)
      const durations = od12w
        .filter((d: any) => d.properties.closedate && d.properties.createdate)
        .map((d: any) =>
          (new Date(d.properties.closedate).getTime() - new Date(d.properties.createdate).getTime())
          / 86_400_000
        )
      const avgDays = durations.length > 0
        ? durations.reduce((s: number, v: number) => s + v, 0) / durations.length
        : 0
      // Scale: 30 days ≈ 1.0 month; cap at 5.0
      const convDurationAvg = parseFloat(Math.min(avgDays / 30, 5).toFixed(1))

      return {
        id:   oid,
        name: `${owner.firstName} ${owner.lastName}`.trim(),
        _amount12w: Math.round(amount12w),   // used for sales index, removed later

        meeting_index:  meetingIndex,
        last4_gt_past8: last4GtPast8,

        results: {
          amount:      Math.round(amount12w),
          count:       count12w,
          ticket_size: ticket,
        },

        // W1 and W12 show deal COUNTS for that week
        // Physical / Teams / Dinner / Webinar split requires calls API scope
        // (grant "crm.objects.calls.read" in your HubSpot private app to enable)
        w1:  { physical: odW1.length,  teams: 0, dinner: 0, webinar: 0 },
        w12: { physical: odW12.length, teams: 0, dinner: 0, webinar: 0 },

        effort: {
          conv_duration_avg: convDurationAvg,
          hitrate:           parseFloat(hitrate.toFixed(4)),
          leads_difference:  leadsL4w.length - leadsPrior.length,
          number_of_leads:   leadsL4w.length,
        },
      }
    })

    // ── 6. Sales index = this consultant's 12w amount vs team average ─────────
    const amounts    = rawConsultants.map(c => c._amount12w).filter(a => a > 0)
    const teamAvgAmt = amounts.length > 0 ? amounts.reduce((s, v) => s + v, 0) / amounts.length : 1

    const consultants = rawConsultants
      .filter(c => c.results.count > 0)
      .map(({ _amount12w, ...c }) => ({
        ...c,
        sales_index: Math.min(Math.round((_amount12w / teamAvgAmt) * 100), 999),
      }))
      .sort((a, b) => b.results.amount - a.results.amount)

    return NextResponse.json({
      consultants,
      fetchedAt: new Date().toISOString(),
      meta: {
        window:      "12 weeks",
        periodStart: W12_START.toISOString(),
        periodEnd:   now.toISOString(),
        totalDeals:  deals12w.length,
        note:        "W1/W12 Physical counts = deal counts. For Physical/Teams/Dinner/Webinar split, grant crm.objects.calls.read scope in your HubSpot private app.",
      },
    })

  } catch (err: any) {
    console.error("Consultant API error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
