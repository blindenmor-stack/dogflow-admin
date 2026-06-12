import { createServiceClient } from '@/lib/supabase/server'
import { PLAN_PRICES } from '@/lib/types/admin'
import { listSubscriptionCheckouts } from '@/lib/abacatepay'
import {
  DollarSign,
  TrendingUp,
  Hourglass,
  AlertTriangle,
  Receipt,
  CreditCard,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// Receita — AbacatePay (substituiu a Stripe em 2026-06-12).
// Fontes:
// - trainers: status da assinatura, plano, trials (fonte de verdade)
// - abacatepay_events: webhooks salvos (pagamentos, valor e
//   frequência reais de cada assinatura)
// - API AbacatePay (opcional): status dos checkouts de assinatura
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

type TrainerRow = {
  id: string
  full_name: string | null
  email: string | null
  plan: string | null
  subscription_status: string | null
  trial_ends_at: string | null
  created_at: string
  abacatepay_customer_id: string | null
  abacatepay_subscription_id: string | null
  subscription_current_period_end: string | null
}

type EventRow = {
  id: string
  event_type: string
  payload: any
  trainer_id: string | null
  processed: boolean
  created_at: string
}

/** Valor mensal (R$) a partir do amount em centavos + frequência AbacatePay. */
function monthlyValue(amountCents: number | null, frequency: string | null): number | null {
  if (amountCents === null) return null
  const v = amountCents / 100
  switch (frequency) {
    case 'MONTHLY': return v
    case 'QUARTERLY': return v / 3
    case 'SEMIANNUALLY': return v / 6
    case 'ANNUALLY': return v / 12
    case 'WEEKLY': return v * 4.33
    default: return v
  }
}

const FREQUENCY_LABEL: Record<string, string> = {
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  SEMIANNUALLY: 'Semestral',
  ANNUALLY: 'Anual',
  WEEKLY: 'Semanal',
}

async function getRevenueData() {
  const supabase = await createServiceClient()
  const now = new Date()
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [trainersRes, eventsRes, apiCheckouts] = await Promise.all([
    supabase
      .from('trainers')
      .select(
        'id, full_name, email, plan, subscription_status, trial_ends_at, created_at, abacatepay_customer_id, abacatepay_subscription_id, subscription_current_period_end'
      ),
    supabase
      .from('abacatepay_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000),
    listSubscriptionCheckouts(),
  ])

  const trainers: TrainerRow[] = (trainersRes.data as TrainerRow[]) || []
  const events: EventRow[] = eventsRes.error ? [] : ((eventsRes.data as EventRow[]) || [])
  const eventsTableOk = !eventsRes.error

  const trainerById = new Map(trainers.map((t) => [t.id, t]))

  // ── Última info de assinatura (valor + frequência) por trainer ──
  // events já vêm DESC; o primeiro com data.subscription vale como atual.
  const subInfoByTrainer = new Map<string, { amountCents: number; frequency: string | null }>()
  for (const ev of events) {
    const sub = ev.payload?.data?.subscription
    if (!ev.trainer_id || !sub || typeof sub.amount !== 'number') continue
    if (!subInfoByTrainer.has(ev.trainer_id)) {
      subInfoByTrainer.set(ev.trainer_id, {
        amountCents: sub.amount,
        frequency: typeof sub.frequency === 'string' ? sub.frequency : null,
      })
    }
  }

  // ── Assinantes ativos + MRR real ──
  const activeTrainers = trainers.filter((t) => t.subscription_status === 'active')
  const subscribers = activeTrainers.map((t) => {
    const info = subInfoByTrainer.get(t.id) || null
    const monthly = info
      ? monthlyValue(info.amountCents, info.frequency)
      : (PLAN_PRICES[(t.plan || 'pro') as keyof typeof PLAN_PRICES] ?? PLAN_PRICES.pro)
    return {
      id: t.id,
      name: t.full_name || t.email || '—',
      monthly: monthly ?? PLAN_PRICES.pro,
      frequency: info?.frequency ?? null,
      periodEnd: t.subscription_current_period_end
        ? new Date(t.subscription_current_period_end)
        : null,
      fromEvents: !!info,
    }
  })
  const mrrReal = subscribers.reduce((sum, s) => sum + s.monthly, 0)

  // ── Pagamentos confirmados (dedupe por payment.id — subscription.completed
  // e checkout.completed do mesmo pagamento chegam separados) ──
  const seenPayments = new Set<string>()
  const payments: { id: string; email: string; amount: number; created: Date | null }[] = []
  for (const ev of events) {
    if (!['subscription.completed', 'subscription.renewed', 'checkout.completed'].includes(ev.event_type)) continue
    const pay = ev.payload?.data?.payment
    if (!pay) continue
    const payId: string = typeof pay.id === 'string' ? pay.id : ev.id
    if (seenPayments.has(payId)) continue
    seenPayments.add(payId)
    const cents = typeof pay.paidAmount === 'number' ? pay.paidAmount : typeof pay.amount === 'number' ? pay.amount : null
    if (cents === null) continue
    const trainer = ev.trainer_id ? trainerById.get(ev.trainer_id) : null
    const createdRaw = pay.createdAt || ev.created_at
    const created = createdRaw ? new Date(createdRaw) : null
    payments.push({
      id: payId,
      email: trainer?.full_name || trainer?.email || ev.payload?.data?.customer?.email || '—',
      amount: cents / 100,
      created: created && !Number.isNaN(created.getTime()) ? created : null,
    })
  }

  // ── Receita por mês (gráfico) ──
  const byMonth = new Map<string, { revenue: number; monthDate: Date }>()
  for (const p of payments) {
    if (!p.created) continue
    const key = format(p.created, 'yyyy-MM')
    const cur = byMonth.get(key)
    if (cur) cur.revenue += p.amount
    else byMonth.set(key, { revenue: p.amount, monthDate: new Date(p.created.getFullYear(), p.created.getMonth(), 1) })
  }
  const revenueMonthly = [...byMonth.entries()]
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime())
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0)

  // ── Trials ──
  const trials = trainers.filter(
    (t) => t.subscription_status === 'trial' && t.trial_ends_at && new Date(t.trial_ends_at) > now
  )
  const trialsExpiring = trials.filter((t) => new Date(t.trial_ends_at!) <= in7days)
  const payingOrTrial = trainers.filter(
    (t) => t.subscription_status === 'active' || t.subscription_status === 'trial'
  )
  const mrrProjected = payingOrTrial.reduce((sum, t) => {
    const price = PLAN_PRICES[(t.plan || 'pro') as keyof typeof PLAN_PRICES] ?? PLAN_PRICES.pro
    return sum + price
  }, 0)

  return {
    mrrReal,
    subscribers,
    payments: payments.slice(0, 20),
    revenueMonthly,
    totalRevenue,
    trialsCount: trials.length,
    trialsExpiring,
    mrrProjected,
    eventsTableOk,
    apiCheckouts, // null = API indisponível/sem env
  }
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function checkoutStatusBadge(status: string) {
  switch (status) {
    case 'PAID':
      return { label: 'Paga', bg: '#F0FDF4', color: '#16A34A' }
    case 'PENDING':
      return { label: 'Pendente', bg: '#FFFBEB', color: '#F59E0B' }
    case 'EXPIRED':
      return { label: 'Expirada', bg: '#F6F8FA', color: '#8A8AA3' }
    case 'CANCELLED':
      return { label: 'Cancelada', bg: '#F6F8FA', color: '#8A8AA3' }
    case 'REFUNDED':
      return { label: 'Reembolsada', bg: '#FEF2F2', color: '#DC2626' }
    default:
      return { label: status, bg: '#F6F8FA', color: '#8A8AA3' }
  }
}

function KPI({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-[#E2E7F1]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[#8A8AA3]">{label}</span>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <p className="text-2xl font-bold" style={{ color: '#121217' }}>{value}</p>
      {sub && <p className="text-xs text-[#8A8AA3] mt-1">{sub}</p>}
    </div>
  )
}

export default async function RevenuePage() {
  const d = await getRevenueData()
  const maxRevenue = Math.max(...d.revenueMonthly.map((r) => r.revenue), 1)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-bold" style={{ color: '#244C4E' }}>Receita</h1>
        <p className="text-[14px]" style={{ color: '#8A8AA3' }}>
          Assinaturas via AbacatePay (webhooks no banco) + projeção por plano dos trainers
        </p>
      </div>

      {!d.eventsTableOk && (
        <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4">
          <p className="text-[13px] font-medium" style={{ color: '#A16207' }}>
            Tabela abacatepay_events indisponível — valores reais aparecem quando o primeiro webhook chegar.
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KPI icon={DollarSign} label="MRR real" value={fmt(d.mrrReal)} sub={`${d.subscribers.length} assinatura(s) ativa(s)`} color="#16A34A" />
        <KPI icon={CreditCard} label="Assinantes ativos" value={String(d.subscribers.length)} sub="subscription_status = active" color="#244C4E" />
        <KPI icon={Hourglass} label="Trials em andamento" value={String(d.trialsCount)} sub="trial_ends_at no futuro" color="#F59E0B" />
        <KPI icon={AlertTriangle} label="Trials expirando (7d)" value={String(d.trialsExpiring.length)} sub="Atenção: follow-up" color="#DC2626" />
        <KPI icon={Receipt} label="Receita acumulada" value={fmt(d.totalRevenue)} sub="Pagamentos confirmados (AbacatePay)" color="#16A34A" />
      </div>

      {/* MRR projetado (estimativa por plan) */}
      <div
        className="flex flex-col gap-1 p-5 sm:flex-row sm:items-center sm:justify-between"
        style={{ backgroundColor: '#9EEA6C15', borderRadius: '16px', border: '1px solid #9EEA6C50' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: '#9EEA6C' }}>
            <TrendingUp className="h-5 w-5" style={{ color: '#244C4E' }} />
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: '#244C4E' }}>MRR projetado</p>
            <p className="text-[12px]" style={{ color: '#8A8AA3' }}>
              Estimativa: trainers ativos + trials convertendo no plano atual (não é receita real)
            </p>
          </div>
        </div>
        <span className="text-[28px] font-bold" style={{ color: '#244C4E' }}>{fmt(d.mrrProjected)}</span>
      </div>

      {/* Receita mensal real (gráfico de barras) */}
      <div className="flex flex-col gap-4 bg-white p-5" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
        <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>Receita mensal real (AbacatePay)</h2>
        {d.revenueMonthly.length > 0 ? (
          <div className="flex items-end gap-2 overflow-x-auto" style={{ height: '160px' }}>
            {d.revenueMonthly.map((r) => (
              <div key={r.month} className="flex min-w-[48px] flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-medium" style={{ color: '#121217' }}>{fmt(r.revenue)}</span>
                <div
                  className="w-full min-h-[4px]"
                  style={{
                    height: `${(r.revenue / maxRevenue) * 100}%`,
                    backgroundColor: '#9EEA6C',
                    borderRadius: '4px 4px 0 0',
                  }}
                />
                <span className="text-[10px]" style={{ color: '#8A8AA3' }}>
                  {format(r.monthDate, 'MMM/yy', { locale: ptBR })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-[120px] flex-col items-center justify-center gap-1">
            <Receipt className="h-6 w-6" style={{ color: '#E2E7F1' }} />
            <span className="text-[13px]" style={{ color: '#8A8AA3' }}>Nenhuma receita registrada ainda</span>
            <span className="text-[11px]" style={{ color: '#B0B0C3' }}>O gráfico aparece com o primeiro pagamento confirmado</span>
          </div>
        )}
      </div>

      {/* Assinantes ativos */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>Assinantes ativos</h2>
        <div className="overflow-hidden bg-white" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F6F8FA' }}>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Trainer</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Período</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Valor/mês</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Próxima renovação</th>
                </tr>
              </thead>
              <tbody>
                {d.subscribers.map((s) => (
                  <tr key={s.id} className="border-t" style={{ borderColor: '#E2E7F1' }}>
                    <td className="px-4 py-3 text-[13px] font-medium" style={{ color: '#121217' }}>{s.name}</td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#8A8AA3' }}>
                      {s.frequency ? FREQUENCY_LABEL[s.frequency] || s.frequency : s.fromEvents ? '—' : 'estimado'}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-medium" style={{ color: '#121217' }}>{fmt(s.monthly)}</td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#8A8AA3' }}>
                      {s.periodEnd ? format(s.periodEnd, 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                    </td>
                  </tr>
                ))}
                {d.subscribers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center">
                      <p className="text-[13px] font-medium" style={{ color: '#8A8AA3' }}>Nenhuma assinatura ainda</p>
                      <p className="mt-1 text-[12px]" style={{ color: '#B0B0C3' }}>
                        Quando o primeiro adestrador assinar o DogFlow Pro, ele aparece aqui.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Checkouts de assinatura na API (enriquecimento) */}
      {d.apiCheckouts && d.apiCheckouts.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>Checkouts de assinatura (API AbacatePay)</h2>
          <div className="overflow-hidden bg-white" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#F6F8FA' }}>
                    <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Data</th>
                    <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Checkout</th>
                    <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Valor</th>
                    <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.apiCheckouts.slice(0, 15).map((c) => {
                    const badge = checkoutStatusBadge(c.status)
                    return (
                      <tr key={c.id} className="border-t" style={{ borderColor: '#E2E7F1' }}>
                        <td className="px-4 py-3 text-[13px]" style={{ color: '#121217' }}>
                          {format(new Date(c.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-mono" style={{ color: '#8A8AA3' }}>{c.id}{c.devMode ? ' · dev' : ''}</td>
                        <td className="px-4 py-3 text-[13px] font-medium" style={{ color: '#121217' }}>{fmt(c.amount / 100)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: badge.bg, color: badge.color }}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Trials expirando */}
      {d.trialsExpiring.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>Trials expirando em 7 dias</h2>
          <div className="overflow-hidden bg-white" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#FFFBEB' }}>
                    <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#A16207' }}>Trainer</th>
                    <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#A16207' }}>Email</th>
                    <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#A16207' }}>Trial acaba em</th>
                  </tr>
                </thead>
                <tbody>
                  {d.trialsExpiring.map((t) => (
                    <tr key={t.id} className="border-t" style={{ borderColor: '#E2E7F1' }}>
                      <td className="px-4 py-3 text-[13px] font-medium" style={{ color: '#121217' }}>{t.full_name || '—'}</td>
                      <td className="px-4 py-3 text-[13px]" style={{ color: '#8A8AA3' }}>{t.email || '—'}</td>
                      <td className="px-4 py-3 text-[13px] font-medium" style={{ color: '#DC2626' }}>
                        {format(new Date(t.trial_ends_at!), 'dd/MM/yyyy', { locale: ptBR })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Pagamentos recentes */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>Pagamentos recentes (AbacatePay)</h2>
        <div className="overflow-hidden bg-white" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F6F8FA' }}>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Data</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Cliente</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {d.payments.map((p) => (
                  <tr key={p.id} className="border-t" style={{ borderColor: '#E2E7F1' }}>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#121217' }}>
                      {p.created ? format(p.created, 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#8A8AA3' }}>{p.email}</td>
                    <td className="px-4 py-3 text-[13px] font-medium" style={{ color: '#121217' }}>{fmt(p.amount)}</td>
                  </tr>
                ))}
                {d.payments.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center">
                      <p className="text-[13px] font-medium" style={{ color: '#8A8AA3' }}>Nenhum pagamento ainda</p>
                      <p className="mt-1 text-[12px]" style={{ color: '#B0B0C3' }}>
                        Os pagamentos do AbacatePay aparecem aqui assim que os webhooks chegarem.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
