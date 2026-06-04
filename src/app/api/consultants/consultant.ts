// src/types/consultant.ts

export interface WeeklyActivity {
  physical: number
  teams: number
  dinner: number
  webinar: number
}

export interface ConsultantEffort {
  conv_duration_avg: number
  hitrate: number          // 0–1, e.g. 0.10 = 10%
  leads_difference: number // can be negative
  number_of_leads: number
}

export interface ConsultantResults {
  amount: number
  count: number
  ticket_size: number
}

export interface Consultant {
  id: string
  name: string
  meeting_index: number
  sales_index: number
  last4_gt_past8: string | null  // "Yes" | "No" | null
  results: ConsultantResults
  w1: WeeklyActivity
  w12: WeeklyActivity
  effort: ConsultantEffort
}

export interface ConsultantsApiResponse {
  consultants: Consultant[]
  fetchedAt: string
}
