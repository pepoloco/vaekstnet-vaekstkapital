import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { emptyQrStore, writeQrStore } from "@/lib/qrStore"

export async function POST() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await writeQrStore(emptyQrStore())
  return NextResponse.json({ ok: true })
}
