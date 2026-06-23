import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { readQrStore } from "@/lib/qrStore"

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const data = await readQrStore()
  return NextResponse.json(data)
}
