import { createServiceClient } from '@/lib/supabase/server'
import {
  Gauge,
  MessageSquare,
  Sun,
  FileText,
  Banknote,
  BarChart3,
} from 'lucide-react'
import Link from 'next/link'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

const PERIODS = [7, 30, 90] as const
type Period = (typeof PERIODS)[number]

const EVENT_LABELS: Record<string, string> = {
  signup_completed: 'Cadastros',
  onboarding_step_completed: 'Steps de onboarding',
  onboarding_completed: 'Onboardings completos',
  first_client_added: '1º cliente adicionado',
  first_session_scheduled: '1ª sessão agendada',
  first_payment_recorded: '1º pagamento registrado',
  wa_interaction: 'Interações WhatsApp',
  aha_first_report: 'Aha (1º relatório)',
  briefing_sent: 'Briefings enviados',
  demo_followup_sent: 'Follow-ups de demo',
  trial_warning_sent: 'Avisos de trial',
  partner_coupon_applied: 'Cupons de parceiro',
  report_sent_to_client: 'Relatórios p/ tutores',
  payment_registered_via_wa: 'Pagamentos via bot',
}

async function getPerformanceData(days: Period) {
  const supabase = await createServiceClient()
  const cutoff = subDays(new Date(), days)

  const { data, error } = await supabase
    .from('analytics_events')
    .select('event_name, occurred_at, trainer_id')
    .gte('occurred_at', cutoff.toISOString())
    .order('occurred_at', { ascending: true })
    .limit(10000)

  const events = error ? [] : data || []

  // Eventos por dia
  const dayKeys = eachDayOfInterval({ start: cutoff, end: new Date() }).map((d) =>
    format(d, 'yyyy-MM-dd')
  )
  const byDay: Record<string, number> = Object.fromEntries(dayKeys.map((k) => [k, 0]))
  const waByDay: Record<string, number> = Object.fromEntries(dayKeys.map((k) => [k, 0]))

  // Breakdown por evento
  const byEvent: Record<string, number> = {}

  for (const e of events) {
    const day = format(new Date(e.occurred_at), 'yyyy-MM-dd')
    if (day in byDay) byDay[day]++
    if (e.event_name === 'wa_interaction' && day in waByDay) waByDay[day]++
    byEvent[e.event_name] = (byEvent[e.event_name] || 0) + 1
  }

  const breakdown = Object.entries(byEvent)
    .map(([name, count]) => ({ name, label: EVENT_LABELS[name] || name, count }))
    .sort((a, b) => b.count - a.count)

  return {
    totalEvents: events.length,
    uniqueTrainers: new Set(events.map((e) => e.trainer_id)).size,
    byDay,
    waByDay,
    breakdown,
    waCount: byEvent['wa_interaction'] || 0,
    briefingsCount: byEvent['briefing_sent'] || 0,
    reportsCount: byEvent['report_sent_to_client'] || 0,
    waPaymentsCount: byEvent['payment_registered_via_wa'] || 0,
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

function BarChart({ data, color, emptyLabel }: { data: Record<string, number>; color: string; emptyLabel: string }) {
  const entries = Object.entries(data)
  const max = Math.max(...entries.map(([, v]) => v), 1)
  const hasData = entries.some(([, v]) => v > 0)
  const dense = entries.length > 40 // 90d: esconde labels intermediários

  if (!hasData) {
    return (
      <div className="flex h-[120px] items-center justify-center">
        <span className="text-[13px]" style={{ color: '#8A8AA3' }}>{emptyLabel}</span>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-[2px]" style={{ height: '120px' }}>
      {entries.map(([day, count], i) => {
        const showLabel = !dense || i % 7 === 0
        return (
          <div key={day} className="flex flex-1 flex-col items-center gap-1 min-w-0">
            {count > 0 && !dense && (
              <span className="text-[9px] font-medium" style={{ color: '#121217' }}>{count}</span>
            )}
            <div
              className="w-full"
              style={{
                height: `${(count / max) * 90}%`,
                minHeight: count > 0 ? '3px' : '1px',
                backgroundColor: count > 0 ? color : '#F0F1F5',
                borderRadius: '3px 3px 0 0',
              }}
            />
            <span className="text-[8px] truncate w-full text-center" style={{ color: showLabel ? '#8A8AA3' : 'transparent' }}>
              {format(new Date(day + 'T12:00:00'), 'dd/MM')}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const params = await searchParams
  const period: Period = PERIODS.includes(Number(params.period) as Period)
    ? (Number(params.period) as Period)
    : 30
  const d = await getPerformanceData(period)
  const maxBreakdown = Math.max(...d.breakdown.map((b) => b.count), 1)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: '#244C4E' }}>Desempenho</h1>
          <p className="text-[14px]" style={{ color: '#8A8AA3' }}>
            Eventos do app (analytics_events) — últimos {period} dias
          </p>
        </div>
        {/* Filtro de período */}
        <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: '#F6F8FA', border: '1px solid #E2E7F1' }}>
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/performance?period=${p}`}
              className="rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors"
              style={
                p === period
                  ? { backgroundColor: '#9EEA6C', color: '#244C4E' }
                  : { color: '#8A8AA3' }
              }
            >
              {p}d
            </Link>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KPI icon={Gauge} label="Eventos totais" value={String(d.totalEvents)} sub={`${d.uniqueTrainers} trainer(s) ativos`} color="#244C4E" />
        <KPI icon={MessageSquare} label="Interações WhatsApp" value={String(d.waCount)} sub={`~${(d.waCount / period).toFixed(1)}/dia`} color="#8B5CF6" />
        <KPI icon={Sun} label="Briefings enviados" value={String(d.briefingsCount)} sub="Resumo diário do bot" color="#F59E0B" />
        <KPI icon={FileText} label="Relatórios p/ tutores" value={String(d.reportsCount)} sub="Enviados aos clientes" color="#3B82F6" />
        <KPI icon={Banknote} label="Pagamentos via bot" value={String(d.waPaymentsCount)} sub="Registrados no WhatsApp" color="#16A34A" />
      </div>

      {/* Eventos por dia */}
      <div className="flex flex-col gap-4 bg-white p-5" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
        <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>Eventos por dia</h2>
        <BarChart data={d.byDay} color="#9EEA6C" emptyLabel="Nenhum evento no período" />
      </div>

      {/* Interações WhatsApp por dia */}
      <div className="flex flex-col gap-4 bg-white p-5" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
        <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>Interações WhatsApp por dia</h2>
        <BarChart data={d.waByDay} color="#8B5CF6" emptyLabel="Nenhuma interação WhatsApp no período" />
      </div>

      {/* Breakdown por evento */}
      <div className="flex flex-col gap-4 bg-white p-5" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" style={{ color: '#244C4E' }} />
          <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>Breakdown por evento</h2>
        </div>
        {d.breakdown.length > 0 ? (
          <div className="flex flex-col gap-2">
            {d.breakdown.map((b) => (
              <div key={b.name} className="flex items-center gap-3">
                <div className="w-[180px] shrink-0 text-right">
                  <p className="text-[12px] font-medium leading-tight" style={{ color: '#244C4E' }}>{b.label}</p>
                  <p className="text-[10px]" style={{ color: '#B0B0C3' }}>{b.name}</p>
                </div>
                <div className="h-6 flex-1 overflow-hidden rounded-md" style={{ backgroundColor: '#F6F8FA' }}>
                  <div
                    className="flex h-full items-center rounded-md px-2"
                    style={{
                      width: `${Math.max((b.count / maxBreakdown) * 100, 6)}%`,
                      backgroundColor: '#9EEA6C',
                    }}
                  >
                    <span className="text-[11px] font-bold" style={{ color: '#244C4E' }}>{b.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-[80px] flex-col items-center justify-center">
            <p className="text-[13px] font-medium" style={{ color: '#8A8AA3' }}>Nenhum evento registrado no período</p>
            <p className="text-[11px]" style={{ color: '#B0B0C3' }}>Os eventos aparecem conforme os trainers usam o app</p>
          </div>
        )}
      </div>
    </div>
  )
}
