import { createServiceClient } from '@/lib/supabase/server'
import { PLAN_PRICES } from '@/lib/types/admin'
import {
  DollarSign,
  TrendingUp,
  Users,
  Hourglass,
  AlertTriangle,
  Receipt,
  CreditCard,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

// ----- Parsing defensivo: as views admin_stripe_* vêm do Stripe Sync Engine
// e a estrutura pode variar. Tudo aqui tolera campo ausente/null.

type Row = Record<string, unknown>

function pickStr(row: Row, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.length > 0) return v
    if (typeof v === 'number' && k !== '') return String(v)
  }
  return null
}

function pickNum(row: Row, keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'number' && !Number.isNaN(v)) return v
    if (typeof v === 'string' && v !== '' && !Number.isNaN(Number(v))) return Number(v)
  }
  return null
}

function stripeDate(row: Row, keys: string[]): Date | null {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'number') return new Date(v > 10_000_000_000 ? v : v * 1000) // epoch s ou ms
    if (typeof v === 'string' && v.length > 0) {
      const d = new Date(v)
      if (!Number.isNaN(d.getTime())) return d
    }
  }
  return null
}

/** Stripe guarda valores em centavos. Converte pra reais. */
function cents(v: number | null): number {
  return v === null ? 0 : v / 100
}

/** Normaliza valor da assinatura pra mensal conforme o intervalo. */
function monthlyValue(amountCents: number | null, interval: string | null, intervalCount: number | null): number {
  const v = cents(amountCents)
  const n = intervalCount && intervalCount > 0 ? intervalCount : 1
  if (interval === 'year') return v / (12 * n)
  if (interval === 'week') return (v * 4.33) / n
  if (interval === 'day') return (v * 30) / n
  return v / n // month (trimestral = month/3)
}

async function getRevenueData() {
  const supabase = await createServiceClient()
  const now = new Date()
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  // Views Stripe (podem ainda não existir — degrada com graça)
  const [subsRes, revRes, invRes, trainersRes] = await Promise.all([
    supabase.from('admin_stripe_subscriptions').select('*'),
    supabase.from('admin_stripe_revenue_monthly').select('*'),
    supabase.from('admin_stripe_invoices_recent').select('*').limit(20),
    supabase
      .from('trainers')
      .select('id, full_name, email, plan, subscription_status, trial_ends_at, created_at'),
  ])

  const subs: Row[] = subsRes.error ? [] : subsRes.data || []
  const revenueMonthly: Row[] = revRes.error ? [] : revRes.data || []
  const invoices: Row[] = invRes.error ? [] : invRes.data || []
  const trainers = trainersRes.data || []

  // --- Assinaturas reais (Stripe)
  const parsedSubs = subs.map((s) => {
    const status = pickStr(s, ['status']) || 'unknown'
    return {
      id: pickStr(s, ['id', 'subscription_id']) || crypto.randomUUID(),
      status,
      email: pickStr(s, ['customer_email', 'email', 'customer_name', 'customer']) || '—',
      amountCents: pickNum(s, ['plan_amount', 'unit_amount', 'amount', 'price_amount']),
      interval: pickStr(s, ['interval', 'plan_interval', 'recurring_interval']),
      intervalCount: pickNum(s, ['interval_count', 'plan_interval_count']),
      periodStart: stripeDate(s, ['current_period_start', 'period_start']),
      periodEnd: stripeDate(s, ['current_period_end', 'period_end']),
      created: stripeDate(s, ['created', 'created_at', 'start_date']),
    }
  })

  const activeSubs = parsedSubs.filter((s) => s.status === 'active' || s.status === 'trialing')
  const mrrReal = activeSubs.reduce(
    (sum, s) => sum + monthlyValue(s.amountCents, s.interval, s.intervalCount),
    0
  )

  // --- Receita mensal real (gráfico)
  const parsedRevenue = revenueMonthly
    .map((r) => ({
      month: pickStr(r, ['month', 'month_start', 'period', 'mes']) || '',
      revenue: cents(pickNum(r, ['revenue', 'revenue_cents', 'total', 'amount', 'gross_revenue'])),
      monthDate: stripeDate(r, ['month', 'month_start', 'period']),
    }))
    .filter((r) => r.month !== '')
    .sort((a, b) => (a.monthDate && b.monthDate ? a.monthDate.getTime() - b.monthDate.getTime() : 0))

  const totalRevenue =
    parsedRevenue.length > 0
      ? parsedRevenue.reduce((sum, r) => sum + r.revenue, 0)
      : invoices.reduce((sum, i) => {
          const status = pickStr(i, ['status'])
          return status === 'paid' ? sum + cents(pickNum(i, ['amount_paid', 'total', 'amount_due'])) : sum
        }, 0)

  // --- Faturas recentes
  const parsedInvoices = invoices.map((i) => ({
    id: pickStr(i, ['id', 'invoice_id']) || crypto.randomUUID(),
    email: pickStr(i, ['customer_email', 'email', 'customer_name', 'customer']) || '—',
    amount: cents(pickNum(i, ['amount_paid', 'total', 'amount_due'])),
    status: pickStr(i, ['status']) || 'unknown',
    created: stripeDate(i, ['created', 'created_at', 'date']),
  }))

  // --- Trainers: trials e MRR projetado
  const trials = trainers.filter(
    (t) =>
      t.subscription_status === 'trial' &&
      t.trial_ends_at &&
      new Date(t.trial_ends_at) > now
  )
  const trialsExpiring = trials.filter((t) => new Date(t.trial_ends_at) <= in7days)
  const payingOrTrial = trainers.filter(
    (t) => t.subscription_status === 'active' || t.subscription_status === 'trial'
  )
  // MRR projetado: se todo trial + ativo pagar o plano (plano único Pro = R$97)
  const mrrProjected = payingOrTrial.reduce((sum, t) => {
    const price = PLAN_PRICES[(t.plan || 'pro') as keyof typeof PLAN_PRICES] ?? PLAN_PRICES.pro
    return sum + price
  }, 0)

  return {
    mrrReal,
    activeSubsCount: parsedSubs.filter((s) => s.status === 'active').length,
    subs: parsedSubs,
    revenueMonthly: parsedRevenue,
    totalRevenue,
    invoices: parsedInvoices,
    trialsCount: trials.length,
    trialsExpiring,
    mrrProjected,
    stripeViewsOk: !subsRes.error,
  }
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function subStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return { label: 'Ativa', bg: '#F0FDF4', color: '#16A34A' }
    case 'trialing':
      return { label: 'Trial', bg: '#FFFBEB', color: '#F59E0B' }
    case 'past_due':
      return { label: 'Atrasada', bg: '#FEF2F2', color: '#DC2626' }
    case 'canceled':
    case 'cancelled':
      return { label: 'Cancelada', bg: '#F6F8FA', color: '#8A8AA3' }
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
          Dados reais da Stripe + projeção por plano dos trainers
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KPI icon={DollarSign} label="MRR real (Stripe)" value={fmt(d.mrrReal)} sub={`${d.activeSubsCount} assinatura(s) ativa(s)`} color="#16A34A" />
        <KPI icon={CreditCard} label="Assinantes ativos" value={String(d.activeSubsCount)} sub="Status active na Stripe" color="#244C4E" />
        <KPI icon={Hourglass} label="Trials em andamento" value={String(d.trialsCount)} sub="trial_ends_at no futuro" color="#F59E0B" />
        <KPI icon={AlertTriangle} label="Trials expirando (7d)" value={String(d.trialsExpiring.length)} sub="Atenção: follow-up" color="#DC2626" />
        <KPI icon={Receipt} label="Receita acumulada" value={fmt(d.totalRevenue)} sub="Faturas pagas (Stripe)" color="#16A34A" />
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
        <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>Receita mensal real (Stripe)</h2>
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
                  {r.monthDate ? format(r.monthDate, 'MMM/yy', { locale: ptBR }) : r.month}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-[120px] flex-col items-center justify-center gap-1">
            <Receipt className="h-6 w-6" style={{ color: '#E2E7F1' }} />
            <span className="text-[13px]" style={{ color: '#8A8AA3' }}>Nenhuma receita registrada ainda</span>
            <span className="text-[11px]" style={{ color: '#B0B0C3' }}>O gráfico aparece com a primeira fatura paga</span>
          </div>
        )}
      </div>

      {/* Assinaturas */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>Assinaturas (Stripe)</h2>
        <div className="overflow-hidden bg-white" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F6F8FA' }}>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Cliente</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Status</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Valor/mês</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Período atual</th>
                </tr>
              </thead>
              <tbody>
                {d.subs.map((s) => {
                  const badge = subStatusBadge(s.status)
                  return (
                    <tr key={s.id} className="border-t" style={{ borderColor: '#E2E7F1' }}>
                      <td className="px-4 py-3 text-[13px] font-medium" style={{ color: '#121217' }}>{s.email}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: badge.bg, color: badge.color }}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] font-medium" style={{ color: '#121217' }}>
                        {fmt(monthlyValue(s.amountCents, s.interval, s.intervalCount))}
                      </td>
                      <td className="px-4 py-3 text-[13px]" style={{ color: '#8A8AA3' }}>
                        {s.periodStart && s.periodEnd
                          ? `${format(s.periodStart, 'dd/MM/yy')} → ${format(s.periodEnd, 'dd/MM/yy')}`
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
                {d.subs.length === 0 && (
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
                        {format(new Date(t.trial_ends_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Faturas recentes */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>Faturas recentes (Stripe)</h2>
        <div className="overflow-hidden bg-white" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F6F8FA' }}>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Data</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Cliente</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Valor</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {d.invoices.map((inv) => (
                  <tr key={inv.id} className="border-t" style={{ borderColor: '#E2E7F1' }}>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#121217' }}>
                      {inv.created ? format(inv.created, 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#8A8AA3' }}>{inv.email}</td>
                    <td className="px-4 py-3 text-[13px] font-medium" style={{ color: '#121217' }}>{fmt(inv.amount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize"
                        style={{
                          backgroundColor: inv.status === 'paid' ? '#F0FDF4' : '#FFFBEB',
                          color: inv.status === 'paid' ? '#16A34A' : '#F59E0B',
                        }}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {d.invoices.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center">
                      <p className="text-[13px] font-medium" style={{ color: '#8A8AA3' }}>Nenhuma fatura ainda</p>
                      <p className="mt-1 text-[12px]" style={{ color: '#B0B0C3' }}>
                        As faturas da Stripe aparecem aqui assim que houver cobranças.
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
