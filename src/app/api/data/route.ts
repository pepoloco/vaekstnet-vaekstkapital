import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { readCache } from "@/lib/cache"

export async function GET() {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const data = await readCache()
  if (!data) {
    return NextResponse.json({ error: "No data — click Sync first" }, { status: 404 })
  }
  return NextResponse.json(data)
}
