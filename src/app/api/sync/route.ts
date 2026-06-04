import { fetchVKData } from "@/lib/hubspot"
import { writeCache } from "@/lib/cache"
import { NextResponse } from "next/server"

export const maxDuration = 300

export async function GET() {
  try {
    const data = await fetchVKData()
    await writeCache(data)
    return NextResponse.json({ ok: true, fetchedAt: data.fetchedAt, contacts: data.totalContacts })
  } catch (err: any) {
    console.error("Sync error:", err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
