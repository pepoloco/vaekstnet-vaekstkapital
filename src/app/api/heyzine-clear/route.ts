import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { emptyHeyzineStore, writeHeyzineStore } from "@/lib/heyzineStore"

export async function POST() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await writeHeyzineStore(emptyHeyzineStore())
  return NextResponse.json({ ok: true })
}
