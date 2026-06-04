import { getAllPipelinesAndStages } from "@/lib/hubspot"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const pipelines = await getAllPipelinesAndStages()
    return NextResponse.json({ pipelines })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
