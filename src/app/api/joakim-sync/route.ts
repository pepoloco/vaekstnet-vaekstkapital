import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

const BASE = "https://api.hubapi.com"
const KEY = process.env.HUBSPOT_API_KEY!
const UPSTASH_URL   = process.env.KV_REST_API_URL
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN
const CACHE_KEY = "vk-joakim-data"

let memCache: unknown = null

async function writeCache(data: unknown) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) { memCache = data; return }
  await fetch(`${UPSTASH_URL}/set/${CACHE_KEY}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(JSON.stringify(data)),
    cache: "no-store",
  })
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const TEST_DOMAINS = ["vaekstnet.com","vaekstkapital.com","vaekstkapital.dk","mailinator.com","yopmail.com","example.com"]
function isTestEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const e = email.toLowerCase()
  return TEST_DOMAINS.some(d => e.endsWith("@" + d)) ||
    ["test@","demo@","staging@","sandbox@"].some(p => e.startsWith(p))
}

async function hsPost(path: string, body: object): Promise<Record<string, unknown>> {
  await sleep(250)
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  if (res.status === 429) { await sleep(3000); return hsPost(path, body) }
  const data = await res.json()
  if (!res.ok) throw new Error(`HubSpot ${path}: ${JSON.stringify(data)}`)
  return data
}

async function getOwners(): Promise<Record<string, string>> {
  const byId: Record<string, string> = {}
  let after: string | undefined
  do {
    await sleep(150)
    const url = `${BASE}/crm/v3/owners?limit=100${after ? `&after=${after}` : ""}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store" })
    const data = await res.json()
    for (const o of data.results ?? []) {
      const name = [o.firstName, o.lastName].filter(Boolean).join(" ")
      if (name) byId[String(o.id)] = name
    }
    after = (data.paging as { next?: { after: string } })?.next?.after
  } while (after)
  return byId
}

// All closed-won deal stage IDs (same as used in the main sales funnel)
const WON_STAGES = ["497565675","503960545","517811422","766320087","4500113624","4643302624"]

async function fetchAllWonDeals(): Promise<Array<{ id: string; closedate: string }>> {
  const deals: Array<{ id: string; closedate: string }> = []
  for (const stageId of WON_STAGES) {
    let after: string | undefined
    do {
      const body: Record<string, unknown> = {
        filterGroups: [{ filters: [{ propertyName: "dealstage", operator: "EQ", value: stageId }] }],
        properties: ["closedate"],
        limit: 200,
      }
      if (after) body.after = after
      const data = await hsPost("/crm/v3/objects/deals/search", body)
      for (const r of (data.results as Array<{ id: string; properties: { closedate: string } }>) ?? []) {
        deals.push({ id: r.id, closedate: r.properties.closedate })
      }
      after = (data.paging as { next?: { after: string } })?.next?.after
    } while (after)
    await sleep(300)
  }
  return deals
}

async function getDealContactAssociations(dealIds: string[]): Promise<Record<string, string[]>> {
  // dealId → contactIds[]
  const map: Record<string, string[]> = {}
  for (let i = 0; i < dealIds.length; i += 100) {
    const batch = dealIds.slice(i, i + 100)
    await sleep(200)
    try {
      const data = await hsPost("/crm/v4/associations/deals/contacts/batch/read", {
        inputs: batch.map(id => ({ id })),
      })
      for (const result of (data.results as Array<{ from: { id: string }; to: Array<{ toObjectId?: string; id?: string }> }>) ?? []) {
        const dealId = result.from?.id
        map[dealId] = (result.to ?? []).map(a => String(a.toObjectId ?? a.id))
      }
    } catch {
      // skip batch
    }
  }
  return map
}

async function batchReadContacts(ids: string[]): Promise<Record<string, Record<string, string>>> {
  const result: Record<string, Record<string, string>> = {}
  const props = ["email","firstname","lastname","phone","onboarding_complete_time","customer_id","hubspot_owner_id","associatedcompanyid","total_auc","vk_auc_in_vk_funds"]
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100)
    await sleep(250)
    const res = await fetch(`${BASE}/crm/v3/objects/contacts/batch/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: batch.map(id => ({ id })), properties: props }),
      cache: "no-store",
    })
    if (!res.ok) continue
    const data = await res.json()
    for (const r of (data.results ?? []) as Array<{ id: string; properties: Record<string, string> }>) {
      result[r.id] = r.properties
    }
  }
  return result
}

async function batchReadCompanies(ids: string[]): Promise<Record<string, Record<string, string>>> {
  const result: Record<string, Record<string, string>> = {}
  const props = ["name","phone","hubspot_owner_id","total_auc","vk_auc_in_vk_funds"]
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100)
    await sleep(250)
    const res = await fetch(`${BASE}/crm/v3/objects/companies/batch/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: batch.map(id => ({ id })), properties: props }),
      cache: "no-store",
    })
    if (!res.ok) continue
    const data = await res.json()
    for (const r of (data.results ?? []) as Array<{ id: string; properties: Record<string, string> }>) {
      result[r.id] = r.properties
    }
  }
  return result
}

export type ContactRow = {
  id: string
  name: string
  email: string
  phone: string
  investmentDate: string | null
  daysSinceInvestment: number | null
  owner: string
  vkAuc: number
  totalAuc: number
  hasApp: boolean
  onboardingDate: string | null
  status: "needs-app" | "kyc-pending" | "onboarded"
  associatedCompanyId: string | null
}

export type CompanyRow = {
  id: string
  name: string
  phone: string
  investmentDate: string | null
  daysSinceInvestment: number | null
  owner: string
  vkAuc: number
  totalAuc: number
  onboardedContacts: Array<{ name: string; onboardingDate: string }>
  pendingContacts: Array<{ name: string; status: "needs-app" | "kyc-pending" }>
}

async function fetchJoakimData() {
  const owners = await getOwners()
  const now = new Date()

  // Step 1: Fetch all closed-won deals
  const deals = await fetchAllWonDeals()
  const dealCloseDateMap: Record<string, string> = {}
  for (const d of deals) dealCloseDateMap[d.id] = d.closedate

  // Step 2: Get contact associations for all deals
  const dealContactMap = await getDealContactAssociations(deals.map(d => d.id))

  // Build: contactId → most recent deal close date
  const contactLatestDeal: Record<string, string> = {}
  for (const [dealId, contactIds] of Object.entries(dealContactMap)) {
    const closedate = dealCloseDateMap[dealId]
    if (!closedate) continue
    for (const cid of contactIds) {
      const existing = contactLatestDeal[cid]
      if (!existing || new Date(closedate) > new Date(existing)) {
        contactLatestDeal[cid] = closedate
      }
    }
  }

  const allContactIds = Object.keys(contactLatestDeal)

  // Step 3: Fetch contact properties
  const contactDetails = await batchReadContacts(allContactIds)

  // Step 4: Fetch company properties for all associated companies
  const companyIds = [...new Set(
    Object.values(contactDetails)
      .map(c => c.associatedcompanyid)
      .filter(Boolean)
  )]
  const companyDetails = await batchReadCompanies(companyIds)

  // Step 5: Build per-contact rows (deduplicated)
  const contactRows: ContactRow[] = []
  for (const contactId of allContactIds) {
    const c = contactDetails[contactId]
    if (!c) continue
    if (isTestEmail(c.email)) continue

    const investDate = contactLatestDeal[contactId] || null
    const days = investDate ? Math.round((now.getTime() - new Date(investDate).getTime()) / 86400000) : null
    const hasApp = !!c.customer_id
    const hasOnboarding = !!c.onboarding_complete_time
    const status: ContactRow["status"] = hasOnboarding ? "onboarded" : hasApp ? "kyc-pending" : "needs-app"

    contactRows.push({
      id: contactId,
      name: [c.firstname, c.lastname].filter(Boolean).join(" ") || c.email || "Unknown",
      email: c.email || "",
      phone: c.phone || "",
      investmentDate: investDate,
      daysSinceInvestment: days,
      owner: owners[c.hubspot_owner_id] || "—",
      vkAuc: parseFloat(c.vk_auc_in_vk_funds || "0"),
      totalAuc: parseFloat(c.total_auc || "0"),
      hasApp,
      onboardingDate: c.onboarding_complete_time || null,
      status,
      associatedCompanyId: c.associatedcompanyid || null,
    })
  }

  // Step 6: Build company rows — group contacts by company
  const byCompany: Record<string, ContactRow[]> = {}
  for (const row of contactRows) {
    if (!row.associatedCompanyId) continue
    if (!byCompany[row.associatedCompanyId]) byCompany[row.associatedCompanyId] = []
    byCompany[row.associatedCompanyId].push(row)
  }

  const companyRows: CompanyRow[] = []
  for (const [compId, contacts] of Object.entries(byCompany)) {
    const comp = companyDetails[compId]
    if (!comp) continue

    // Most recent deal date across all contacts at this company
    const latestDate = contacts
      .map(c => c.investmentDate)
      .filter(Boolean)
      .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0] || null
    const days = latestDate ? Math.round((now.getTime() - new Date(latestDate).getTime()) / 86400000) : null

    companyRows.push({
      id: compId,
      name: comp.name || "Unknown Company",
      phone: comp.phone || "",
      investmentDate: latestDate,
      daysSinceInvestment: days,
      owner: owners[comp.hubspot_owner_id] || "—",
      vkAuc: parseFloat(comp.vk_auc_in_vk_funds || "0"),
      totalAuc: parseFloat(comp.total_auc || "0"),
      onboardedContacts: contacts
        .filter(c => c.status === "onboarded")
        .map(c => ({ name: c.name, onboardingDate: c.onboardingDate! })),
      pendingContacts: contacts
        .filter(c => c.status !== "onboarded")
        .map(c => ({ name: c.name, status: c.status })),
    })
  }

  const sortByDate = (a: { investmentDate: string | null }, b: { investmentDate: string | null }) => {
    if (!a.investmentDate && !b.investmentDate) return 0
    if (!a.investmentDate) return 1
    if (!b.investmentDate) return -1
    return new Date(b.investmentDate).getTime() - new Date(a.investmentDate).getTime()
  }

  // Individuals needing onboarding = contacts with no onboarding_complete_time
  const individualsNeedingOnboarding = contactRows
    .filter(r => r.status !== "onboarded")
    .sort(sortByDate)

  // Companies where NO contact has onboarded yet
  const companiesNeedingOnboarding = companyRows
    .filter(r => r.onboardedContacts.length === 0)
    .sort(sortByDate)

  // Companies where at least one contact IS onboarded (3rd section)
  const companiesWithOnboardedContact = companyRows
    .filter(r => r.onboardedContacts.length > 0)
    .sort(sortByDate)

  // Recently onboarded contacts (last 90 days)
  const recentlyOnboarded = contactRows
    .filter(r => {
      if (!r.onboardingDate) return false
      return (now.getTime() - new Date(r.onboardingDate).getTime()) / 86400000 <= 90
    })
    .sort((a, b) => new Date(b.onboardingDate!).getTime() - new Date(a.onboardingDate!).getTime())

  const newThisMonth = individualsNeedingOnboarding.filter(r => r.daysSinceInvestment !== null && r.daysSinceInvestment <= 30).length

  // Monthly stats
  const months: string[] = []
  let d = new Date(2025, 9, 1)
  while (d < new Date(now.getFullYear(), now.getMonth() + 1, 1)) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  }

  const byMonth = months.map(m => {
    const [y, mo] = m.split("-").map(Number)
    const start = new Date(y, mo - 1, 1).getTime()
    const end   = new Date(y, mo, 1).getTime()
    const newInvestors = contactRows.filter(r => {
      if (!r.investmentDate) return false
      const t = new Date(r.investmentDate).getTime()
      return t >= start && t < end
    }).length
    const newOnboardings = contactRows.filter(r => {
      if (!r.onboardingDate) return false
      const t = new Date(r.onboardingDate).getTime()
      return t >= start && t < end
    }).length
    return { month: m, newInvestors, newOnboardings }
  })

  return {
    fetchedAt: new Date().toISOString(),
    summary: {
      totalInvestors: contactRows.length,
      totalNeedingOnboarding: individualsNeedingOnboarding.length + companiesNeedingOnboarding.length,
      individualsNeedingOnboarding: individualsNeedingOnboarding.length,
      companiesNeedingOnboarding: companiesNeedingOnboarding.length,
      companiesWithOnboardedContact: companiesWithOnboardedContact.length,
      recentlyOnboardedCount: recentlyOnboarded.length,
      newThisMonth,
    },
    individualsNeedingOnboarding,
    companiesNeedingOnboarding,
    companiesWithOnboardedContact,
    recentlyOnboarded,
    byMonth,
  }
}

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const data = await fetchJoakimData()
    await writeCache(data)
    return NextResponse.json({ ok: true, fetchedAt: data.fetchedAt, total: data.summary.totalNeedingOnboarding })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
