const BASE = "https://api-eu1.hubspot.com"
const KEY  = process.env.HUBSPOT_API_KEY!

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function hsGet(path: string, attempt = 0): Promise<any> {
  await sleep(150)
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: "no-store",
  })
  if (res.status === 429 && attempt < 5) {
    await sleep(2000 * (attempt + 1))
    return hsGet(path, attempt + 1)
  }
  if (!res.ok) throw new Error(`HubSpot GET ${path} → ${res.status}`)
  return res.json()
}

async function hsPost(path: string, body: object, attempt = 0): Promise<any> {
  await sleep(150)
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  }) 

  if (res.status === 429 && attempt < 5) {
    await sleep(2000 * (attempt + 1))
    return hsPost(path, body, attempt + 1)
  }
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`HubSpot POST ${path} → ${res.status}: ${err}`)
  }
  return res.json()
}
 
async function getAllContacts(properties: string[]): Promise<any[]> {
  const results: any[] = []
  let after: string | undefined
  const propsParam = properties.join(",")

  do {
    let path = `/crm/v3/objects/contacts?limit=100&properties=${propsParam}`
    if (after) path += `&after=${after}`
    const data = await hsGet(path)
    results.push(...(data.results || []).map((r: any) => ({ ...r.properties, _id: r.id })))
    after = data.paging?.next?.after
  } while (after)

  return results
}

async function getLifecycleHistory(contactIds: string[]): Promise<Record<string, any[]>> {
  const result: Record<string, any[]> = {}
  const batches: string[][] = []
  for (let i = 0; i < contactIds.length; i += 100) {
    batches.push(contactIds.slice(i, i + 100))
  }

  let successCount = 0
  let errorCount = 0

  for (const batch of batches) {
    await sleep(200)
    try {
      const body = {
        inputs: batch.map(id => ({ id })),
        properties: ["lifecyclestage"],
        propertiesWithHistory: ["lifecyclestage"],
      }
      const data = await hsPost("/crm/v3/objects/contacts/batch/read", body)
      for (const contact of data.results || []) {
        const history = contact.propertiesWithHistory?.lifecyclestage || []
        const timestamps = history
          .filter((h: any) => h.timestamp)
          .map((h: any) => ({ value: h.value, ts: new Date(h.timestamp) }))
          .sort((a: any, b: any) => a.ts - b.ts)
        result[contact.id] = timestamps
      }
      successCount++
    } catch (e) {
      errorCount++
      if (errorCount <= 3) console.error("HISTORY_ERROR:", String(e))
    }
  }

  console.log(`HISTORY_RESULT: ${successCount} batches ok, ${errorCount} fejl, ${Object.keys(result).length} contacts med history`)

  const sample = Object.entries(result).slice(0, 2).map(([id, hist]) => ({
    id,
    historyCount: hist.length,
    sample: hist.slice(0, 3),
  }))
  console.log("HISTORY_SAMPLE:", JSON.stringify(sample))

  return result
}

export async function getOwners(): Promise<Record<string, string>> {
  const data = await hsGet("/crm/v3/owners?limit=100")
  const map: Record<string, string> = {}
  for (const o of data.results ?? []) {
    map[String(o.id)] = [o.firstName, o.lastName].filter(Boolean).join(" ")
  }
  return map
}

export async function getAllPipelinesAndStages() {
  const data = await hsGet("/crm/v3/pipelines/contacts")
  return data.results ?? []
}

const TEST_DOMAINS = ["vaekstnet.com","vaekstkapital.com","vaekstkapital.dk","mailinator.com","yopmail.com","example.com"]

function isTestContact(email: string) {
  if (!email) return true
  const domain = email.split("@")[1]?.toLowerCase()
  return TEST_DOMAINS.includes(domain)
}

function median(arr: number[]): number {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return Math.round(sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2)
}

const LIFECYCLE_STAGES = [
  { id: "lead",                   label: "Lead" },
  { id: "marketingqualifiedlead", label: "MQL Cold" },
  { id: "770940371",              label: "MQL Connected" },
  { id: "773079518",              label: "Attempted / Connected" },
  { id: "salesqualifiedlead",     label: "SQL" },
  { id: "opportunity",            label: "Opportunity" },
  { id: "customer",               label: "Kunde" },
  { id: "1874186475",             label: "Disqualified" },
]

const stageDateProps: Record<string, string> = {
  lead:                   "hs_lifecyclestage_lead_date",
  marketingqualifiedlead: "hs_lifecyclestage_marketingqualifiedlead_date",
  salesqualifiedlead:     "hs_lifecyclestage_salesqualifiedlead_date",
  opportunity:            "hs_lifecyclestage_opportunity_date",
  customer:               "hs_lifecyclestage_customer_date",
}

export async function fetchVKData() {
  const owners = await getOwners()

  const contactProps = [
    "email",
    "firstname",
    "lastname",
    "lifecyclestage",
    "hs_lead_status",
    "createdate",
    "hs_last_sales_activity_timestamp",
    "hubspot_owner_id",
    "endavu_deal_id",
    "phone",
    "company",
  ]

  const allContacts = await getAllContacts(contactProps)

  const contacts = allContacts.filter(c =>
    !isTestContact(c.email || "") && !c.endavu_deal_id
  )

  // ── Stage counts ──────────────────────────────────────────────
  const stageCounts: Record<string, number> = {}
  for (const stage of LIFECYCLE_STAGES) {
    stageCounts[stage.id] = contacts.filter(c => c.lifecyclestage === stage.id).length
  }

  // ── Property history til transitions ─────────────────────────
  const advancedContacts = contacts.filter(c =>
    c.lifecyclestage === "opportunity" ||
    c.lifecyclestage === "customer" ||
    c.lifecyclestage === "salesqualifiedlead"
  )
  const advancedIds = advancedContacts.map(c => c._id)
  const lifecycleHistory = await getLifecycleHistory(advancedIds)

  const transitionDurations: Record<string, number[]> = {
    "Lead → MQL Cold":          [],
    "MQL Cold → MQL Connected": [],
    "MQL Connected → SQL":      [],
    "SQL → Opportunity":        [],
    "Opportunity → Kunde":      [],
    "Lead → Kunde (total)":     [],
  }

  for (const [, history] of Object.entries(lifecycleHistory)) {
    if (!history || !Array.isArray(history)) continue

    const stageTimes: Record<string, Date> = {}
    for (const entry of history as any[]) {
      if (entry.value && entry.ts && !stageTimes[entry.value]) {
        stageTimes[entry.value] = entry.ts
      }
    }

    const getTs = (id: string) => stageTimes[id] || null

    const pairs = [
      { key: "Lead → MQL Cold",          from: "lead",                   to: "marketingqualifiedlead" },
      { key: "MQL Cold → MQL Connected", from: "marketingqualifiedlead", to: "770940371" },
      { key: "MQL Connected → SQL",      from: "770940371",              to: "salesqualifiedlead" },
      { key: "SQL → Opportunity",        from: "salesqualifiedlead",     to: "opportunity" },
      { key: "Opportunity → Kunde",      from: "opportunity",            to: "customer" },
    ]

    for (const p of pairs) {
      const from = getTs(p.from)
      const to   = getTs(p.to)
      if (from && to && to > from) {
        const days = (to.getTime() - from.getTime()) / 86400000
        if (days < 1825) transitionDurations[p.key].push(days)
      }
    }

    const leadTs     = getTs("lead")
    const customerTs = getTs("customer")
    if (leadTs && customerTs && customerTs > leadTs) {
      const days = (customerTs.getTime() - leadTs.getTime()) / 86400000
      if (days < 1825) transitionDurations["Lead → Kunde (total)"].push(days)
    }
  }

  const avgDaysPerTransition: Record<string, { avg: number; median: number; count: number }> = {}
  for (const [key, durations] of Object.entries(transitionDurations)) {
    avgDaysPerTransition[key] = {
      avg:    durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      median: median(durations),
      count:  durations.length,
    }
  }

  // ── Tid i nuværende stage ─────────────────────────────────────
  const now = Date.now()
  const avgDaysInCurrentStage: Record<string, { avg: number; median: number; count: number; dataSource: string }> = {}

  for (const stage of LIFECYCLE_STAGES) {
    if (stage.id === "1874186475") continue

    const inStage = contacts.filter(c => c.lifecyclestage === stage.id)
    if (!inStage.length) continue

    const isCustom = !stageDateProps[stage.id]
    let days: number[]
    let dataSource: string

    if (isCustom) {
      days = inStage.map(c => {
        const ref = c.hs_last_sales_activity_timestamp || c.createdate
        return ref ? (now - new Date(ref).getTime()) / 86400000 : 0
      }).filter(d => d > 0)
      dataSource = "last_activity_approx"
    } else {
      const daysFromHistory: number[] = []
      const daysFromFallback: number[] = []

      for (const c of inStage) {
        const hist = lifecycleHistory[c._id] as any[]
        if (hist) {
          const entries = hist.filter((h: any) => h.value === stage.id)
          if (entries.length) {
            const latest = entries[entries.length - 1]
            const d = (now - new Date(latest.ts).getTime()) / 86400000
            if (d > 0 && d < 3650) daysFromHistory.push(d)
            continue
          }
        }
        if (c.createdate) {
          const d = (now - new Date(c.createdate).getTime()) / 86400000
          if (d > 0) daysFromFallback.push(d)
        }
      }

      days = [...daysFromHistory, ...daysFromFallback]
      dataSource = daysFromHistory.length > daysFromFallback.length
        ? "property_history"
        : "createdate_approx"
    }

    avgDaysInCurrentStage[stage.label] = {
      avg:    days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0,
      median: median(days),
      count:  days.length,
      dataSource,
    }
  }

  // ── Funnel ────────────────────────────────────────────────────
  const stageOrder = ["lead","marketingqualifiedlead","770940371","773079518","salesqualifiedlead","opportunity","customer"]
  const funnelData = stageOrder.map(s => ({
    stage: LIFECYCLE_STAGES.find(l => l.id === s)?.label || s,
    count: contacts.filter(c => {
      const idx    = stageOrder.indexOf(s)
      const curIdx = stageOrder.indexOf(c.lifecyclestage)
      return curIdx >= idx
    }).length,
  }))

  // ── Stuck leads ───────────────────────────────────────────────
  const stuckLeads = contacts
    .filter(c => {
      const stage = c.lifecyclestage
      if (!stage || stage === "customer" || stage === "1874186475") return false
      const isCustom = !stageDateProps[stage]
      const ref = isCustom
        ? (c.hs_last_sales_activity_timestamp || c.createdate)
        : c.createdate
      if (!ref) return false
      const days = (now - new Date(ref).getTime()) / 86400000
      return days > 30 && days < 730
    })
    .map(c => {
      const stage = c.lifecyclestage
      const isCustom = !stageDateProps[stage]
      const ref = isCustom
        ? (c.hs_last_sales_activity_timestamp || c.createdate)
        : c.createdate
      const days = ref ? Math.round((now - new Date(ref).getTime()) / 86400000) : null
      return {
        id: c._id,
        name: [c.firstname, c.lastname].filter(Boolean).join(" ") || c.email,
        email: c.email,
        company: c.company || "",
        stage: LIFECYCLE_STAGES.find(l => l.id === stage)?.label || stage,
        daysInStage: days,
        owner: owners[c.hubspot_owner_id] || "Ukendt",
        lastActivity: c.hs_last_sales_activity_timestamp
          ? new Date(c.hs_last_sales_activity_timestamp).toLocaleDateString("da-DK")
          : "—",
      }
    })
    .sort((a, b) => (b.daysInStage || 0) - (a.daysInStage || 0))
    .slice(0, 50)

  // ── By owner ──────────────────────────────────────────────────
  const ownerMap: Record<string, { name: string; lead: number; mql: number; sql: number; opportunity: number; customer: number }> = {}
  for (const c of contacts) {
    const ownerName = owners[c.hubspot_owner_id] || "Ukendt"
    if (!ownerMap[ownerName]) ownerMap[ownerName] = { name: ownerName, lead: 0, mql: 0, sql: 0, opportunity: 0, customer: 0 }
    const s = c.lifecyclestage
    if (s === "lead")                                        ownerMap[ownerName].lead++
    if (s === "marketingqualifiedlead" || s === "770940371") ownerMap[ownerName].mql++
    if (s === "salesqualifiedlead")                          ownerMap[ownerName].sql++
    if (s === "opportunity")                                 ownerMap[ownerName].opportunity++
    if (s === "customer")                                    ownerMap[ownerName].customer++
  }
  const byOwner = Object.values(ownerMap)
    .sort((a, b) => (b.customer + b.opportunity) - (a.customer + a.opportunity))

  // ── Monthly created ───────────────────────────────────────────
  const monthlyMap: Record<string, number> = {}
  for (const c of contacts) {
    if (!c.createdate) continue
    const m = c.createdate.slice(0, 7)
    monthlyMap[m] = (monthlyMap[m] || 0) + 1
  }
  const byMonth = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-18)
    .map(([month, count]) => ({ month, count }))

  // ── Reinvestering ─────────────────────────────────────────────
  const customers = contacts.filter(c => c.lifecyclestage === "customer")
  let reinvestering = {
    medianDays: 0, avgDays: 0, reinvestRate: 0,
    totalCustomers: customers.length,
    reinvestedCount: 0, within90days: 0, within180days: 0,
  }

  try {
    const WON_STAGES = ["497565675","503960545","517811422","766320087","4500113624","4643302624"]
    const allWonDeals: any[] = []

    for (const stageId of WON_STAGES) {
      let after: string | undefined
      do {
        const body: any = {
          filterGroups: [{ filters: [{ propertyName: "dealstage", operator: "EQ", value: stageId }] }],
          properties: ["closedate","dealname","amount"],
          limit: 200,
        }
        if (after) body.after = after
        const data = await hsPost("/crm/v3/objects/deals/search", body)
        allWonDeals.push(...(data.results || []))
        after = data.paging?.next?.after
      } while (after)
      await sleep(300)
    }

    const dealIds = allWonDeals.map(d => d.id)
    const contactDealDates: Record<string, Date[]> = {}
    const batchSize = 100

    for (let i = 0; i < dealIds.length; i += batchSize) {
      const batch = dealIds.slice(i, i + batchSize)
      await sleep(200)
      try {
        const assocData = await hsPost("/crm/v4/associations/deals/contacts/batch/read", {
          inputs: batch.map(id => ({ id })),
        })
        for (const result of assocData.results || []) {
          const dealId = result.from?.id
          const deal = allWonDeals.find(d => d.id === dealId)
          if (!deal?.properties?.closedate) continue
          const closeDate = new Date(deal.properties.closedate)
          for (const assoc of result.to || []) {
            const cid = String(assoc.toObjectId || assoc.id)
            if (!contactDealDates[cid]) contactDealDates[cid] = []
            contactDealDates[cid].push(closeDate)
          }
        }
      } catch {
        // skip batch
      }
    }

    const daysToReinvest: number[] = []
    let within90 = 0, within180 = 0

    for (const dates of Object.values(contactDealDates)) {
      if (dates.length < 2) continue
      const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
      const days = (sorted[1].getTime() - sorted[0].getTime()) / 86400000
      if (days >= 30 && days < 1825) {
        daysToReinvest.push(days)
        if (days <= 90)  within90++
        if (days <= 180) within180++
      }
    }

    const count = daysToReinvest.length
    reinvestering = {
      medianDays:      median(daysToReinvest),
      avgDays:         count ? Math.round(daysToReinvest.reduce((a, b) => a + b, 0) / count) : 0,
      reinvestRate:    customers.length ? Math.round((count / customers.length) * 100) : 0,
      totalCustomers:  customers.length,
      reinvestedCount: count,
      within90days:    within90,
      within180days:   within180,
    }
  } catch (e) {
    console.error("Reinvestering fejl:", e)
  }

  return {
    fetchedAt: new Date().toISOString(),
    totalContacts: contacts.length,
    stageCounts,
    avgDaysPerTransition,
    avgDaysInCurrentStage,
    funnelData,
    stuckLeads,
    byOwner,
    byMonth,
    stageLabels: LIFECYCLE_STAGES,
    reinvestering,
  }
}
