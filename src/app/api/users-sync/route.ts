import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

const BASE = "https://api.hubapi.com"
const KEY = process.env.HUBSPOT_API_KEY!
const UPSTASH_URL   = process.env.KV_REST_API_URL
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN
const CACHE_KEY = "vk-users-data"

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

const TEST_DOMAINS = ["vaekstnet.com","vaekstkapital.com","mailinator.com","yopmail.com","example.com"]
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

async function searchAll(objectType: string, filterGroups: object[], properties: string[]): Promise<Record<string, string>[]> {
  const results: Record<string, string>[] = []
  let after: string | undefined
  do {
    const body: Record<string, unknown> = { filterGroups, properties, limit: 200 }
    if (after) body.after = after
    const data = await hsPost(`/crm/v3/objects/${objectType}/search`, body)
    for (const r of (data.results as Array<{ properties: Record<string, string> }>) ?? []) {
      results.push(r.properties)
    }
    after = (data.paging as { next?: { after: string } })?.next?.after
  } while (after)
  return results
}

async function countContacts(filterGroups: object[]): Promise<number> {
  const data = await hsPost("/crm/v3/objects/contacts/search", {
    filterGroups, properties: ["hs_object_id"], limit: 1,
  })
  return (data.total as number) ?? 0
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

async function batchReadCompanies(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {}
  const result: Record<string, string> = {}
  for (let i = 0; i < ids.length; i += 100) {
    await sleep(250)
    const chunk = ids.slice(i, i + 100)
    const res = await fetch(`${BASE}/crm/v3/objects/companies/batch/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: chunk.map(id => ({ id })), properties: ["name"] }),
      cache: "no-store",
    })
    if (!res.ok) continue
    const data = await res.json()
    for (const r of (data.results ?? []) as Array<{ id: string; properties: { name: string } }>) {
      result[String(r.id)] = r.properties?.name || ""
    }
  }
  return result
}

async function fetchUsersData() {
  const [owners, contactsInvested] = await Promise.all([
    getOwners(),
    countContacts([{ filters: [{ propertyName: "invested_in_vaekstnet", operator: "EQ", value: "Yes" }] }]),
  ])

  // All Vaekstnet app users (have customer_id)
  const contactsDetail = await searchAll("contacts",
    [{ filters: [{ propertyName: "customer_id", operator: "HAS_PROPERTY" }] }],
    ["signup_time","onboarding_complete_time","cash_balance","total_auc","email","firstname","lastname","hs_object_id","hubspot_owner_id","associatedcompanyid","registration_device"]
  )
  const contactsReal = contactsDetail.filter(c => !isTestEmail(c.email))

  const companyIds = [...new Set(contactsReal.map(c => c.associatedcompanyid).filter(Boolean))]
  const companyNames = await batchReadCompanies(companyIds)

  const makeVnContact = (c: Record<string, string>) => ({
    name: [c.firstname, c.lastname].filter(Boolean).join(" ") || c.email || "Unknown",
    company: companyNames[c.associatedcompanyid] || "",
    auc: parseFloat(c.total_auc || "0"),
    signupTime: c.signup_time,
    onboardingTime: c.onboarding_complete_time || null,
    id: c.hs_object_id,
  })

  const vnNotFunded = contactsReal
    .filter(c => c.onboarding_complete_time && parseFloat(c.total_auc || "0") < 1)
    .sort((a, b) => new Date(b.onboarding_complete_time).getTime() - new Date(a.onboarding_complete_time).getTime())
    .map(makeVnContact)

  const vnFunded = contactsReal
    .filter(c => parseFloat(c.total_auc || "0") >= 1)
    .sort((a, b) => new Date(b.onboarding_complete_time || b.signup_time).getTime() - new Date(a.onboarding_complete_time || a.signup_time).getTime())
    .map(makeVnContact)

  const countCreated   = contactsReal.length
  const countOnboarded = contactsReal.filter(c => c.onboarding_complete_time).length
  const countFunded    = contactsReal.filter(c => parseFloat(c.total_auc || "0") >= 1).length

  const makeFollowUp = (c: Record<string, string>) => ({
    name: [c.firstname, c.lastname].filter(Boolean).join(" ") || c.email || "Unknown",
    email: c.email,
    signupTime: c.signup_time,
    owner: owners[c.hubspot_owner_id] || "—",
    id: c.hs_object_id,
  })

  const notOnboarded = contactsReal
    .filter(c => !c.onboarding_complete_time)
    .sort((a, b) => new Date(b.signup_time).getTime() - new Date(a.signup_time).getTime())
    .map(makeFollowUp)

  const notFunded = contactsReal
    .filter(c => c.onboarding_complete_time && parseFloat(c.total_auc || "0") < 1)
    .sort((a, b) => new Date(b.signup_time).getTime() - new Date(a.signup_time).getTime())
    .map(makeFollowUp)

  const funded = contactsReal
    .filter(c => parseFloat(c.total_auc || "0") >= 1)
    .sort((a, b) => new Date(b.signup_time).getTime() - new Date(a.signup_time).getTime())
    .map(makeFollowUp)

  // Monthly breakdown (from Oct 2025)
  const now = new Date()
  const months: string[] = []
  let d = new Date(2025, 9, 1)
  while (d.getFullYear() < now.getFullYear() || (d.getFullYear() === now.getFullYear() && d.getMonth() <= now.getMonth())) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  }

  const byMonth = months.map(m => {
    const [y, mo] = m.split("-").map(Number)
    const start = new Date(y, mo - 1, 1).getTime()
    const end   = new Date(y, mo, 1).getTime()
    const created   = contactsReal.filter(c => { const t = new Date(c.signup_time).getTime(); return t >= start && t < end }).length
    const onboarded = contactsReal.filter(c => { if (!c.onboarding_complete_time) return false; const t = new Date(c.onboarding_complete_time).getTime(); return t >= start && t < end }).length
    const fundedM   = contactsReal.filter(c => { const t = new Date(c.signup_time).getTime(); return t >= start && t < end && parseFloat(c.total_auc || "0") >= 1 }).length
    return { month: m, created, onboarded, funded: fundedM }
  })
  let cs = 0, co = 0, cf = 0
  const cumulative = byMonth.map(m => {
    cs += m.created; co += m.onboarded; cf += m.funded
    return { month: m.month, created: cs, onboarded: co, funded: cf, onboardingRate: cs > 0 ? Math.round(co / cs * 100) : 0 }
  })

  const getWeekMonday = (d: Date) => {
    const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day
    const m = new Date(d); m.setDate(d.getDate() + diff); m.setHours(0, 0, 0, 0)
    return m
  }
  const thisMonday = getWeekMonday(now)
  const byWeek = Array.from({ length: 13 }, (_, i) => {
    const ws = new Date(thisMonday); ws.setDate(thisMonday.getDate() - (12 - i) * 7)
    const we = new Date(ws); we.setDate(ws.getDate() + 7)
    const label = `${String(ws.getDate()).padStart(2, "0")}/${String(ws.getMonth() + 1).padStart(2, "0")}`
    const created   = contactsReal.filter(c => { const t = new Date(c.signup_time).getTime(); return t >= ws.getTime() && t < we.getTime() }).length
    const onboarded = contactsReal.filter(c => { if (!c.onboarding_complete_time) return false; const t = new Date(c.onboarding_complete_time).getTime(); return t >= ws.getTime() && t < we.getTime() }).length
    return { week: label, created, onboarded }
  })

  const isMobileDevice = (d: string) => {
    const v = d.toLowerCase()
    return v.includes("ios") || v.includes("android") || v.includes("iphone") || v.includes("ipad")
  }
  const deviceCounts: Record<string, number> = {}
  for (const c of contactsReal) {
    const d = c.registration_device || "Unknown"
    deviceCounts[d] = (deviceCounts[d] || 0) + 1
  }
  const deviceBreakdown = Object.entries(deviceCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([device, count]) => ({ device, count, pct: Math.round(count / (contactsReal.length || 1) * 100) }))
  const appDownloads = contactsReal.filter(c => c.registration_device && isMobileDevice(c.registration_device)).length

  // AUC
  const [aucContacts, aucCompanies] = await Promise.all([
    searchAll("contacts",
      [{ filters: [{ propertyName: "total_auc", operator: "GT", value: "0" }] }],
      ["total_auc","vk_auc_in_vk_funds","cash_balance","firstname","lastname","email","hubspot_owner_id"]
    ),
    searchAll("companies",
      [{ filters: [{ propertyName: "total_auc", operator: "GT", value: "0" }] }],
      ["total_auc","vk_auc_in_vk_funds","cash_balance","name","hubspot_owner_id"]
    ),
  ])
  const aucReal = aucContacts.filter(c => !isTestEmail(c.email))

  const sumAuc  = (a: Record<string, string>[]) => a.reduce((s, c) => s + (parseFloat(c.total_auc) || 0), 0)
  const sumVk   = (a: Record<string, string>[]) => a.reduce((s, c) => s + (parseFloat(c.vk_auc_in_vk_funds) || 0), 0)
  const sumCash = (a: Record<string, string>[]) => a.reduce((s, c) => s + (parseFloat(c.cash_balance) || 0), 0)

  const aucCT = sumAuc(aucReal), aucCC = sumAuc(aucCompanies)
  const vkCT  = sumVk(aucReal),  vkCC  = sumVk(aucCompanies)
  const cashCT = sumCash(aucReal), cashCC = sumCash(aucCompanies)

  const topCustomers = [
    ...aucReal.map(c => ({
      name: [c.firstname, c.lastname].filter(Boolean).join(" ") || "Unknown",
      type: "Contact" as const,
      consultant: owners[c.hubspot_owner_id] || "—",
      totalAuc: parseFloat(c.total_auc) || 0,
      vkFunds:  parseFloat(c.vk_auc_in_vk_funds) || 0,
      cash:     parseFloat(c.cash_balance) || 0,
      listed:   Math.max(0, (parseFloat(c.total_auc) || 0) - (parseFloat(c.vk_auc_in_vk_funds) || 0) - (parseFloat(c.cash_balance) || 0)),
    })),
    ...aucCompanies.map(c => ({
      name: c.name || "Unknown",
      type: "Company" as const,
      consultant: owners[c.hubspot_owner_id] || "—",
      totalAuc: parseFloat(c.total_auc) || 0,
      vkFunds:  parseFloat(c.vk_auc_in_vk_funds) || 0,
      cash:     parseFloat(c.cash_balance) || 0,
      listed:   Math.max(0, (parseFloat(c.total_auc) || 0) - (parseFloat(c.vk_auc_in_vk_funds) || 0) - (parseFloat(c.cash_balance) || 0)),
    })),
  ].sort((a, b) => b.totalAuc - a.totalAuc).slice(0, 10)

  return {
    fetchedAt: new Date().toISOString(),
    activation: { created: countCreated, onboarded: countOnboarded, funded: countFunded, invested: contactsInvested, appDownloads },
    notOnboarded,
    notFunded,
    funded,
    byMonth,
    cumulative,
    byWeek,
    deviceBreakdown,
    auc: {
      total: aucCT + aucCC,
      vkFunds: vkCT + vkCC,
      listed: (aucCT + aucCC) - (vkCT + vkCC) - (cashCT + cashCC),
      cash: cashCT + cashCC,
      contacts:  { total: aucCT, vkFunds: vkCT, listed: aucCT - vkCT - cashCT, cash: cashCT, count: aucReal.length },
      companies: { total: aucCC, vkFunds: vkCC, listed: aucCC - vkCC - cashCC, cash: cashCC, count: aucCompanies.length },
    },
    topCustomers,
    vnContacts: { notFunded: vnNotFunded, funded: vnFunded },
  }
}

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const data = await fetchUsersData()
    await writeCache(data)
    return NextResponse.json({ ok: true, fetchedAt: data.fetchedAt, contacts: data.activation.created })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
