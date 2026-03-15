export type TrainerWithStats = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  plan: 'starter' | 'pro' | 'scale'
  created_at: string
  updated_at: string
  onboarding_completed: boolean
  whatsapp_connected: boolean
  google_calendar_connected: boolean
  sessions_count?: number
  clients_count?: number
  dogs_count?: number
  payments_total?: number
  last_activity?: string | null
}

export type AdminStats = {
  total_trainers: number
  active_trainers: number
  total_sessions: number
  total_clients: number
  total_dogs: number
  mrr: number
  sessions_this_week: number
}

export type PlanPricing = {
  starter: number
  pro: number
  scale: number
}

export const PLAN_PRICES: PlanPricing = {
  starter: 39,
  pro: 97,
  scale: 197,
}

export type AlertItem = {
  type: 'inactive' | 'no_sessions'
  trainer_id: string
  trainer_name: string
  message: string
}
