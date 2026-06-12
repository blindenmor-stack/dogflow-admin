// Sequência canônica de marcos de ativação do trainer (colunas-marco em `trainers`).
// Usada pelo funil (/funnel), pela lista de trainers e pelo detalhe do trainer.

export type TrainerMilestones = {
  id: string
  full_name?: string | null
  email?: string | null
  created_at: string
  onboarding_started_at?: string | null
  onboarding_completed_at?: string | null
  first_client_at?: string | null
  first_wa_interaction_at?: string | null
  first_session_at?: string | null
  first_payment_at?: string | null
  gcal_connected_at?: string | null
  aha_at?: string | null
  activated_at?: string | null
  habit_moment_at?: string | null
  converted_at?: string | null
  demo_followup_sent_at?: string | null
  trial_warning_sent_at?: string | null
  coupon_redeemed_at?: string | null
  [key: string]: unknown
}

export type FunnelStep = {
  key: string
  label: string
  short: string
}

// Etapas do funil (em ordem). `created_at` = cadastro feito (todo mundo passa).
export const FUNNEL_STEPS: FunnelStep[] = [
  { key: 'created_at', label: 'Cadastro (signup)', short: 'Cadastro' },
  { key: 'onboarding_started_at', label: 'Onboarding iniciado', short: 'Onb. iniciado' },
  { key: 'onboarding_completed_at', label: 'Onboarding completo', short: 'Onb. completo' },
  { key: 'first_client_at', label: 'Primeiro cliente', short: '1º cliente' },
  { key: 'first_wa_interaction_at', label: 'Primeira interação WhatsApp', short: '1ª msg WA' },
  { key: 'aha_at', label: 'Aha (1º relatório)', short: 'Aha' },
  { key: 'habit_moment_at', label: 'Hábito', short: 'Hábito' },
  { key: 'converted_at', label: 'Converteu (pagante)', short: 'Converteu' },
]

// Marcos extras pra timeline do detalhe do trainer (não fazem parte do funil principal)
export const EXTRA_MILESTONES: FunnelStep[] = [
  { key: 'gcal_connected_at', label: 'Google Calendar conectado', short: 'Calendar' },
  { key: 'first_session_at', label: 'Primeira sessão agendada', short: '1ª sessão' },
  { key: 'first_payment_at', label: 'Primeiro pagamento registrado', short: '1º pagamento' },
  { key: 'activated_at', label: 'Ativado', short: 'Ativado' },
  { key: 'coupon_redeemed_at', label: 'Cupom de parceiro resgatado', short: 'Cupom' },
]

function getDate(t: TrainerMilestones, key: string): string | null {
  const v = t[key]
  return typeof v === 'string' && v.length > 0 ? v : null
}

/**
 * Retorna a etapa atual do trainer: o ÚLTIMO marco atingido na sequência
 * e a PRÓXIMA etapa onde ele parou (primeira coluna null).
 */
export function deriveStage(t: TrainerMilestones): {
  reachedIndex: number // índice do último marco atingido (0 = só cadastro)
  reached: FunnelStep
  stuckAt: FunnelStep | null // primeira etapa NÃO atingida (null = completou tudo)
  lastMilestoneAt: string // data do último marco atingido
} {
  let reachedIndex = 0
  let lastMilestoneAt = t.created_at

  for (let i = 1; i < FUNNEL_STEPS.length; i++) {
    const d = getDate(t, FUNNEL_STEPS[i].key)
    if (d) {
      reachedIndex = i
      lastMilestoneAt = d
    } else {
      break // sequência estrita: para na primeira coluna null
    }
  }

  const stuckAt =
    reachedIndex >= FUNNEL_STEPS.length - 1 ? null : FUNNEL_STEPS[reachedIndex + 1]

  return {
    reachedIndex,
    reached: FUNNEL_STEPS[reachedIndex],
    stuckAt,
    lastMilestoneAt,
  }
}

/** Conta quantos trainers atingiram cada etapa (sequência estrita). */
export function countFunnel(trainers: TrainerMilestones[]): number[] {
  const counts = new Array(FUNNEL_STEPS.length).fill(0)
  for (const t of trainers) {
    const { reachedIndex } = deriveStage(t)
    for (let i = 0; i <= reachedIndex; i++) counts[i]++
  }
  return counts
}

export function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((x, y) => x - y)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}
