import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { readHeyzineStore } from "@/lib/heyzineStore"

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const data = await readHeyzineStore()
  return NextResponse.json(data)
}
