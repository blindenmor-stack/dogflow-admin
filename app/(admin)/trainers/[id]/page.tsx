import { createServiceClient } from '@/lib/supabase/server'
import { PLAN_PRICES } from '@/lib/types/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ArrowLeft,
  CalendarDays,
  Users,
  PawPrint,
  DollarSign,
  Wifi,
  Calendar,
  CheckCircle2,
  XCircle,
  Milestone,
  History,
  Circle,
  Lock,
  Unlock,
  Clock,
} from 'lucide-react'
import { FUNNEL_STEPS, EXTRA_MILESTONES, type TrainerMilestones } from '@/lib/funnel'

export const dynamic = 'force-dynamic'

// ── Item unificado da timeline de auditoria ──────────────────────────────
type TimelineItem = {
  timestamp: string
  icon: string
  title: string
  detail?: string
  source: string
}

// Traduz event_name cru pra rótulo PT legível (+ ícone)
function translateEvent(
  eventName: string,
  properties: Record<string, unknown> | null
): { icon: string; title: string; detail?: string } {
  const p = properties || {}
  switch (eventName) {
    case 'signup_completed':
      return { icon: '📝', title: 'Criou a conta' }
    case 'first_client_added':
      return { icon: '👤', title: 'Cadastrou o 1º cliente' }
    case 'first_session_scheduled':
      return { icon: '📅', title: 'Agendou a 1ª sessão' }
    case 'first_payment_recorded': {
      const amount = typeof p.amount === 'number' ? p.amount : null
      const method = typeof p.method === 'string' ? p.method : null
      const parts: string[] = []
      if (amount != null) parts.push(`R$ ${amount.toLocaleString('pt-BR')}`)
      if (method) parts.push(method.toUpperCase())
      return {
        icon: '💰',
        title: 'Registrou o 1º pagamento',
        detail: parts.length ? parts.join(' · ') : undefined,
      }
    }
    case 'wa_interaction':
      return { icon: '💬', title: 'Interagiu no WhatsApp' }
    case 'aha_first_report':
      return { icon: '✨', title: 'AHA: gerou o 1º relatório por áudio' }
    case 'report_sent_to_client':
      return { icon: '📤', title: 'Enviou relatório pro tutor' }
    case 'briefing_sent':
      return { icon: '🌅', title: 'Recebeu o briefing matinal' }
    case 'onboarding_step_completed': {
      const step = p.step ?? p.step_number ?? p.index
      return {
        icon: '➡️',
        title:
          step != null
            ? `Avançou no onboarding (passo ${step})`
            : 'Avançou no onboarding',
      }
    }
    case 'onboarding_completed':
      return { icon: '🎉', title: 'Concluiu o onboarding' }
    case 'trial_warning_sent':
    case 'trial_expired_notice_sent':
      return { icon: '⏰', title: 'Aviso de trial' }
    case 'partner_coupon_applied':
      return { icon: '🎟️', title: 'Aplicou cupom de parceiro' }
    default:
      return { icon: '•', title: eventName }
  }
}

async function getTrainerData(id: string) {
  const supabase = await createServiceClient()

  // Get trainer profile
  const { data: trainer, error } = await supabase
    .from('trainers')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !trainer) return null

  // Tudo por trainer_id, em paralelo.
  // Para cada fonte: contagem REAL (head:true) + array limitado pra exibir/timeline.
  const [
    sessionsRes,
    sessionsCountRes,
    clientsCountRes,
    dogsCountRes,
    paymentsRes,
    paymentsCountRes,
    messagesCountRes,
    eventsRes,
    messagesRes,
    clientsListRes,
    dogsListRes,
    sessionsListRes,
    paymentsListRes,
    packagesListRes,
  ] = await Promise.all([
    // Sessões recentes (exibição na tabela)
    supabase
      .from('sessions')
      .select('*')
      .eq('trainer_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('trainer_id', id),
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('trainer_id', id),
    supabase.from('dogs').select('*', { count: 'exact', head: true }).eq('trainer_id', id),
    // Pagamentos recentes (exibição)
    supabase
      .from('payments')
      .select('*')
      .eq('trainer_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('payments').select('*', { count: 'exact', head: true }).eq('trainer_id', id),
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('trainer_id', id),
    // Fontes da timeline (arrays limitados)
    supabase
      .from('analytics_events')
      .select('id, event_name, properties, source, occurred_at')
      .eq('trainer_id', id)
      .order('occurred_at', { ascending: false })
      .limit(200),
    supabase
      .from('messages')
      .select('id, direction, content, created_at')
      .eq('trainer_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('clients').select('id, name, created_at').eq('trainer_id', id),
    supabase.from('dogs').select('id, name, created_at').eq('trainer_id', id),
    supabase
      .from('sessions')
      .select('id, scheduled_at, status, created_at')
      .eq('trainer_id', id),
    supabase
      .from('payments')
      .select('id, amount, status, created_at')
      .eq('trainer_id', id),
    supabase
      .from('client_packages')
      .select('id, total_sessions, status, created_at')
      .eq('trainer_id', id),
  ])

  const sessions = sessionsRes.data || []
  const payments = paymentsRes.data || []
  const events = eventsRes.data || []
  const messages = messagesRes.data || []

  const paymentsTotal = (paymentsListRes.data || []).reduce(
    (sum, p) => sum + (p.amount || 0),
    0
  )

  // ── Monta a timeline unificada ──────────────────────────────────────────
  const timeline: TimelineItem[] = []

  // 1) analytics_events
  for (const e of events) {
    if (!e.occurred_at) continue
    const { icon, title, detail } = translateEvent(
      e.event_name,
      (e.properties as Record<string, unknown> | null) ?? null
    )
    timeline.push({
      timestamp: e.occurred_at,
      icon,
      title,
      detail,
      source: e.source ? `evento · ${e.source}` : 'evento',
    })
  }

  // 2) messages (WhatsApp)
  for (const m of messages) {
    if (!m.created_at) continue
    const raw = (m.content || '').trim()
    const short = raw.length > 80 ? raw.slice(0, 80) + '…' : raw
    const isIncoming = m.direction === 'incoming'
    timeline.push({
      timestamp: m.created_at,
      icon: isIncoming ? '💬' : '🤖',
      title: isIncoming ? 'Enviou no WhatsApp' : 'Flow respondeu',
      detail: short ? `«${short}»` : undefined,
      source: 'whatsapp',
    })
  }

  // 3) Dados criados
  for (const c of clientsListRes.data || []) {
    if (!c.created_at) continue
    timeline.push({
      timestamp: c.created_at,
      icon: '👤',
      title: `Criou cliente ${c.name || ''}`.trim(),
      source: 'cliente',
    })
  }
  for (const d of dogsListRes.data || []) {
    if (!d.created_at) continue
    timeline.push({
      timestamp: d.created_at,
      icon: '🐕',
      title: `Cadastrou o cão ${d.name || ''}`.trim(),
      source: 'cão',
    })
  }
  for (const s of sessionsListRes.data || []) {
    if (!s.created_at) continue
    const when = s.scheduled_at
      ? format(new Date(s.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })
      : null
    timeline.push({
      timestamp: s.created_at,
      icon: '📅',
      title: 'Sessão agendada',
      detail: when ? `para ${when}${s.status ? ` · ${s.status}` : ''}` : s.status || undefined,
      source: 'sessão',
    })
  }
  for (const p of paymentsListRes.data || []) {
    if (!p.created_at) continue
    timeline.push({
      timestamp: p.created_at,
      icon: '💰',
      title: `Pagamento R$ ${(p.amount || 0).toLocaleString('pt-BR')}`,
      detail: p.status || undefined,
      source: 'pagamento',
    })
  }
  for (const pk of packagesListRes.data || []) {
    if (!pk.created_at) continue
    timeline.push({
      timestamp: pk.created_at,
      icon: '📦',
      title: 'Vinculou pacote',
      detail: [
        pk.total_sessions ? `${pk.total_sessions} sessões` : null,
        pk.status || null,
      ]
        .filter(Boolean)
        .join(' · ') || undefined,
      source: 'pacote',
    })
  }

  // 4) Marcos de conexão (colunas-marco do trainer)
  const t = trainer as TrainerMilestones & Record<string, unknown>
  const connectionMarks: { key: string; icon: string; title: string }[] = [
    { key: 'gcal_connected_at', icon: '🔗', title: 'Conectou o Google Calendar' },
    { key: 'aha_at', icon: '✨', title: 'Momento AHA atingido' },
    { key: 'activated_at', icon: '🚀', title: 'Conta ativada' },
    { key: 'converted_at', icon: '⭐', title: 'Converteu (virou pagante)' },
  ]
  for (const mark of connectionMarks) {
    const v = t[mark.key]
    if (typeof v === 'string' && v.length > 0) {
      timeline.push({
        timestamp: v,
        icon: mark.icon,
        title: mark.title,
        source: 'marco',
      })
    }
  }

  // Ordena desc por timestamp
  timeline.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  // nº de dias com atividade = dias distintos na timeline
  const activeDays = new Set(
    timeline.map((i) => format(new Date(i.timestamp), 'yyyy-MM-dd'))
  ).size

  return {
    trainer,
    sessions,
    sessionsCount: sessionsCountRes.count || 0,
    clientsCount: clientsCountRes.count || 0,
    dogsCount: dogsCountRes.count || 0,
    payments,
    paymentsCount: paymentsCountRes.count || 0,
    paymentsTotal,
    messagesCount: messagesCountRes.count || 0,
    timeline,
    activeDays,
  }
}

// Status de acesso conforme spec: active OU now≤trial_ends_at => liberado;
// trial_ends_at + 3d < now (e não-active) => BLOQUEADO; senão carência.
function getAccessStatus(
  subscriptionStatus: string | null | undefined,
  trialEndsAt: string | null | undefined
): { label: string; color: string; bg: string; icon: 'open' | 'grace' | 'blocked' } {
  const now = Date.now()
  const isActive = subscriptionStatus === 'active'
  const trialEnd = trialEndsAt ? new Date(trialEndsAt).getTime() : null

  if (isActive || (trialEnd != null && now <= trialEnd)) {
    return { label: 'Liberado', color: '#16A34A', bg: '#F0FDF4', icon: 'open' }
  }
  const graceLimit = trialEnd != null ? trialEnd + 3 * 24 * 60 * 60 * 1000 : null
  if (graceLimit != null && graceLimit < now) {
    return { label: 'Bloqueado', color: '#DC2626', bg: '#FEF2F2', icon: 'blocked' }
  }
  return { label: 'Carência', color: '#F59E0B', bg: '#FFFBEB', icon: 'grace' }
}

// Agrupa a timeline (já ordenada desc) por dia, preservando a ordem.
function groupByDay(items: TimelineItem[]): { day: string; label: string; items: TimelineItem[] }[] {
  const groups: { day: string; label: string; items: TimelineItem[] }[] = []
  let current: { day: string; label: string; items: TimelineItem[] } | null = null
  for (const it of items) {
    const d = new Date(it.timestamp)
    const day = format(d, 'yyyy-MM-dd')
    if (!current || current.day !== day) {
      current = {
        day,
        label: format(d, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
        items: [],
      }
      groups.push(current)
    }
    current.items.push(it)
  }
  return groups
}

function getPlanBadgeStyle(plan: string) {
  switch (plan) {
    case 'pro':
      return { backgroundColor: '#9EEA6C20', color: '#244C4E' }
    case 'scale':
      return { backgroundColor: '#244C4E', color: '#FFFFFF' }
    default:
      return { backgroundColor: '#F6F8FA', color: '#8A8AA3' }
  }
}

export default async function TrainerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getTrainerData(id)

  if (!data) notFound()

  const {
    trainer,
    sessions,
    sessionsCount,
    clientsCount,
    dogsCount,
    payments,
    paymentsCount,
    paymentsTotal,
    messagesCount,
    timeline,
    activeDays,
  } = data
  const plan = (trainer.plan || 'starter') as keyof typeof PLAN_PRICES
  const access = getAccessStatus(trainer.subscription_status, trainer.trial_ends_at)
  const timelineGroups = groupByDay(timeline)

  // Timeline de marcos: funil principal + marcos extras, ordenados por data
  const t = trainer as TrainerMilestones
  const milestonesTimeline = [...FUNNEL_STEPS, ...EXTRA_MILESTONES]
    .map((step) => {
      const v = t[step.key]
      return {
        key: step.key,
        label: step.label,
        date: typeof v === 'string' && v.length > 0 ? v : null,
      }
    })
    .sort((a, b) => {
      if (a.date && b.date) return new Date(a.date).getTime() - new Date(b.date).getTime()
      if (a.date) return -1
      if (b.date) return 1
      return 0
    })

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <Link
        href="/trainers"
        className="flex items-center gap-2 text-[13px] font-medium"
        style={{ color: '#8A8AA3' }}
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para Trainers
      </Link>

      {/* Trainer Info Card */}
      <div
        className="flex flex-col gap-4 bg-white p-6"
        style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: '#244C4E' }}>
              {trainer.full_name || 'Sem nome'}
            </h1>
            <p className="mt-1 text-[14px]" style={{ color: '#8A8AA3' }}>
              {trainer.email || 'Sem email'}
            </p>
          </div>
          <span
            className="inline-flex rounded-full px-3 py-1 text-[12px] font-medium capitalize"
            style={getPlanBadgeStyle(plan)}
          >
            {plan} - R$ {PLAN_PRICES[plan]}/mes
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <span className="text-[12px]" style={{ color: '#8A8AA3' }}>Telefone</span>
            <p className="text-[14px] font-medium" style={{ color: '#121217' }}>
              {trainer.phone || '-'}
            </p>
          </div>
          <div>
            <span className="text-[12px]" style={{ color: '#8A8AA3' }}>Criado em</span>
            <p className="text-[14px] font-medium" style={{ color: '#121217' }}>
              {format(new Date(trainer.created_at), 'dd/MM/yyyy', { locale: ptBR })}
            </p>
          </div>
          <div>
            <span className="text-[12px]" style={{ color: '#8A8AA3' }}>Onboarding</span>
            <p className="flex items-center gap-1 text-[14px] font-medium" style={{ color: '#121217' }}>
              {trainer.onboarding_completed ? (
                <><CheckCircle2 className="h-4 w-4" style={{ color: '#16A34A' }} /> Completo</>
              ) : (
                <><XCircle className="h-4 w-4" style={{ color: '#F59E0B' }} /> Pendente</>
              )}
            </p>
          </div>
          <div>
            <span className="text-[12px]" style={{ color: '#8A8AA3' }}>Integracoes</span>
            <div className="mt-1 flex gap-2">
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                style={{
                  backgroundColor: trainer.whatsapp_connected ? '#F0FDF4' : '#F6F8FA',
                  color: trainer.whatsapp_connected ? '#16A34A' : '#8A8AA3',
                }}
              >
                <Wifi className="h-3 w-3" /> WhatsApp
              </span>
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                style={{
                  backgroundColor: trainer.google_calendar_connected ? '#F0FDF4' : '#F6F8FA',
                  color: trainer.google_calendar_connected ? '#16A34A' : '#8A8AA3',
                }}
              >
                <Calendar className="h-3 w-3" /> Calendar
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Resumo de uso (auditoria) */}
      <div
        className="flex flex-col gap-4 bg-white p-6"
        style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>
            Resumo de uso
          </h2>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold"
            style={{ backgroundColor: access.bg, color: access.color }}
          >
            {access.icon === 'open' ? (
              <Unlock className="h-3.5 w-3.5" />
            ) : access.icon === 'blocked' ? (
              <Lock className="h-3.5 w-3.5" />
            ) : (
              <Clock className="h-3.5 w-3.5" />
            )}
            Acesso: {access.label}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-y-4 gap-x-4 sm:grid-cols-4 lg:grid-cols-5">
          <div>
            <span className="text-[12px]" style={{ color: '#8A8AA3' }}>Cadastro</span>
            <p className="text-[14px] font-semibold" style={{ color: '#121217' }}>
              {format(new Date(trainer.created_at), 'dd/MM/yyyy', { locale: ptBR })}
            </p>
          </div>
          <div>
            <span className="text-[12px]" style={{ color: '#8A8AA3' }}>Onboarding</span>
            <p className="text-[14px] font-semibold" style={{ color: trainer.onboarding_completed ? '#16A34A' : '#F59E0B' }}>
              {trainer.onboarding_completed ? 'Sim' : 'Não'}
            </p>
          </div>
          <div>
            <span className="text-[12px]" style={{ color: '#8A8AA3' }}>Dias com atividade</span>
            <p className="text-[14px] font-semibold" style={{ color: '#121217' }}>{activeDays}</p>
          </div>
          <div>
            <span className="text-[12px]" style={{ color: '#8A8AA3' }}>Clientes</span>
            <p className="text-[14px] font-semibold" style={{ color: '#121217' }}>{clientsCount}</p>
          </div>
          <div>
            <span className="text-[12px]" style={{ color: '#8A8AA3' }}>Cães</span>
            <p className="text-[14px] font-semibold" style={{ color: '#121217' }}>{dogsCount}</p>
          </div>
          <div>
            <span className="text-[12px]" style={{ color: '#8A8AA3' }}>Sessões</span>
            <p className="text-[14px] font-semibold" style={{ color: '#121217' }}>{sessionsCount}</p>
          </div>
          <div>
            <span className="text-[12px]" style={{ color: '#8A8AA3' }}>Pagamentos</span>
            <p className="text-[14px] font-semibold" style={{ color: '#121217' }}>{paymentsCount}</p>
          </div>
          <div>
            <span className="text-[12px]" style={{ color: '#8A8AA3' }}>Mensagens trocadas</span>
            <p className="text-[14px] font-semibold" style={{ color: '#121217' }}>{messagesCount}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div
          className="flex flex-col gap-1 bg-white p-4"
          style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
        >
          <CalendarDays className="h-4 w-4" style={{ color: '#8A8AA3' }} />
          <span className="text-[24px] font-bold" style={{ color: '#121217' }}>
            {sessionsCount}
          </span>
          <span className="text-[12px]" style={{ color: '#8A8AA3' }}>Sessoes total</span>
        </div>
        <div
          className="flex flex-col gap-1 bg-white p-4"
          style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
        >
          <Users className="h-4 w-4" style={{ color: '#8A8AA3' }} />
          <span className="text-[24px] font-bold" style={{ color: '#121217' }}>
            {clientsCount}
          </span>
          <span className="text-[12px]" style={{ color: '#8A8AA3' }}>Clientes total</span>
        </div>
        <div
          className="flex flex-col gap-1 bg-white p-4"
          style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
        >
          <PawPrint className="h-4 w-4" style={{ color: '#8A8AA3' }} />
          <span className="text-[24px] font-bold" style={{ color: '#121217' }}>
            {dogsCount}
          </span>
          <span className="text-[12px]" style={{ color: '#8A8AA3' }}>Caes total</span>
        </div>
        <div
          className="flex flex-col gap-1 bg-white p-4"
          style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
        >
          <DollarSign className="h-4 w-4" style={{ color: '#8A8AA3' }} />
          <span className="text-[24px] font-bold" style={{ color: '#121217' }}>
            R$ {paymentsTotal.toLocaleString('pt-BR')}
          </span>
          <span className="text-[12px]" style={{ color: '#8A8AA3' }}>Pagamentos total</span>
        </div>
      </div>

      {/* Timeline de marcos */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Milestone className="h-4 w-4" style={{ color: '#244C4E' }} />
          <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>
            Jornada de ativação
          </h2>
        </div>
        <div className="bg-white p-5" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
          <div className="flex flex-col">
            {milestonesTimeline.map((m, i) => (
              <div key={m.key} className="flex gap-3">
                {/* Linha vertical + bolinha */}
                <div className="flex flex-col items-center">
                  {m.date ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: '#16A34A' }} />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0" style={{ color: '#E2E7F1' }} />
                  )}
                  {i < milestonesTimeline.length - 1 && (
                    <div className="w-px flex-1 min-h-[16px]" style={{ backgroundColor: '#E2E7F1' }} />
                  )}
                </div>
                <div className="flex flex-1 items-baseline justify-between gap-2 pb-3">
                  <span
                    className="text-[13px] font-medium"
                    style={{ color: m.date ? '#121217' : '#B0B0C3' }}
                  >
                    {m.label}
                  </span>
                  <span className="text-[12px] whitespace-nowrap" style={{ color: m.date ? '#8A8AA3' : '#D5D5E0' }}>
                    {m.date
                      ? format(new Date(m.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : 'Pendente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Histórico de uso — timeline de auditoria */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4" style={{ color: '#244C4E' }} />
          <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>
            Histórico de uso ({timeline.length} registros)
          </h2>
        </div>
        <div className="bg-white p-5" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
          {timeline.length === 0 ? (
            <p className="py-6 text-center text-[13px]" style={{ color: '#8A8AA3' }}>
              Nenhuma atividade registrada pra esse trainer.
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {timelineGroups.map((group) => (
                <div key={group.day} className="flex flex-col gap-2">
                  {/* Cabeçalho do dia */}
                  <div
                    className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold capitalize"
                    style={{ backgroundColor: '#244C4E', color: '#9EEA6C' }}
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    {group.label}
                  </div>
                  {/* Itens do dia */}
                  <div className="flex flex-col">
                    {group.items.map((item, i) => (
                      <div key={`${group.day}-${i}`} className="flex gap-3">
                        {/* Linha + bolinha */}
                        <div className="flex flex-col items-center">
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px]"
                            style={{ backgroundColor: '#9EEA6C20' }}
                          >
                            {item.icon}
                          </span>
                          {i < group.items.length - 1 && (
                            <div className="w-px flex-1 min-h-[12px]" style={{ backgroundColor: '#E2E7F1' }} />
                          )}
                        </div>
                        {/* Card do item */}
                        <div className="flex flex-1 flex-col pb-3">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                            <span className="text-[13px] font-medium" style={{ color: '#121217' }}>
                              {item.title}
                            </span>
                            <span className="text-[12px] whitespace-nowrap" style={{ color: '#8A8AA3' }}>
                              {format(new Date(item.timestamp), "dd MMM, HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          {item.detail && (
                            <span className="text-[12px]" style={{ color: '#8A8AA3' }}>
                              {item.detail}
                            </span>
                          )}
                          <span
                            className="mt-0.5 w-fit rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                            style={{ backgroundColor: '#F6F8FA', color: '#B0B0C3' }}
                          >
                            {item.source}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>
          Sessoes Recentes
        </h2>
        <div
          className="overflow-hidden bg-white"
          style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#F6F8FA' }}>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                  Data
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                  Status
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                  Notas
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr
                  key={session.id}
                  className="border-t"
                  style={{ borderColor: '#E2E7F1' }}
                >
                  <td className="px-4 py-3 text-[13px]" style={{ color: '#121217' }}>
                    {format(new Date(session.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize"
                      style={{
                        backgroundColor: session.status === 'completed' ? '#F0FDF4' : '#F6F8FA',
                        color: session.status === 'completed' ? '#16A34A' : '#8A8AA3',
                      }}
                    >
                      {session.status || 'scheduled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px]" style={{ color: '#8A8AA3' }}>
                    {session.notes || '-'}
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-[13px]" style={{ color: '#8A8AA3' }}>
                    Nenhuma sessao registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Payments */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>
          Pagamentos Recentes
        </h2>
        <div
          className="overflow-hidden bg-white"
          style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#F6F8FA' }}>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                  Data
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                  Valor
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-t"
                  style={{ borderColor: '#E2E7F1' }}
                >
                  <td className="px-4 py-3 text-[13px]" style={{ color: '#121217' }}>
                    {format(new Date(payment.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-medium" style={{ color: '#121217' }}>
                    R$ {(payment.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize"
                      style={{
                        backgroundColor: payment.status === 'paid' ? '#F0FDF4' : '#FFFBEB',
                        color: payment.status === 'paid' ? '#16A34A' : '#F59E0B',
                      }}
                    >
                      {payment.status || 'pending'}
                    </span>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-[13px]" style={{ color: '#8A8AA3' }}>
                    Nenhum pagamento registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
