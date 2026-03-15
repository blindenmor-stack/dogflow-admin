import { createServiceClient } from '@/lib/supabase/server'
import { Activity, CalendarDays, Wifi, Calendar, Users, Trophy } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

async function getEngagementData() {
  const supabase = await createServiceClient()

  // Sessions per day (last 30 days)
  const thirtyDaysAgo = subDays(new Date(), 30)
  const { data: recentSessions } = await supabase
    .from('sessions')
    .select('created_at')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: true })

  // Group sessions by day
  const sessionsByDay: Record<string, number> = {}
  recentSessions?.forEach((s) => {
    const day = format(new Date(s.created_at), 'dd/MM', { locale: ptBR })
    sessionsByDay[day] = (sessionsByDay[day] || 0) + 1
  })

  // Active trainers (logged in last 7 days)
  const sevenDaysAgo = subDays(new Date(), 7)
  const { data: activeTrainers } = await supabase
    .from('profiles')
    .select('id, full_name, updated_at')
    .gte('updated_at', sevenDaysAgo.toISOString())

  // Total trainers
  const { count: totalTrainers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  // Feature adoption
  const { count: whatsappCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('whatsapp_connected', true)

  const { count: calendarCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('google_calendar_connected', true)

  const { count: onboardingCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('onboarding_completed', true)

  // Top trainers by session count
  const { data: allSessions } = await supabase
    .from('sessions')
    .select('trainer_id')

  const sessionsByTrainer: Record<string, number> = {}
  allSessions?.forEach((s) => {
    sessionsByTrainer[s.trainer_id] = (sessionsByTrainer[s.trainer_id] || 0) + 1
  })

  // Get trainer names for top trainers
  const topTrainerIds = Object.entries(sessionsByTrainer)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([id]) => id)

  const { data: topTrainerProfiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, plan')
    .in('id', topTrainerIds.length > 0 ? topTrainerIds : ['_'])

  const topTrainers = topTrainerIds.map((id) => {
    const profile = topTrainerProfiles?.find((p) => p.id === id)
    return {
      id,
      full_name: profile?.full_name || 'Sem nome',
      email: profile?.email || '',
      plan: profile?.plan || 'starter',
      sessions_count: sessionsByTrainer[id] || 0,
    }
  })

  return {
    sessionsByDay,
    activeTrainers: activeTrainers?.length || 0,
    totalTrainers: totalTrainers || 0,
    whatsappCount: whatsappCount || 0,
    calendarCount: calendarCount || 0,
    onboardingCount: onboardingCount || 0,
    topTrainers,
    totalSessionsLast30: recentSessions?.length || 0,
  }
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

export default async function EngagementPage() {
  const data = await getEngagementData()

  const adoptionRate = (count: number) =>
    data.totalTrainers > 0
      ? `${Math.round((count / data.totalTrainers) * 100)}%`
      : '0%'

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold" style={{ color: '#244C4E' }}>
          Engajamento
        </h1>
        <p className="text-[14px]" style={{ color: '#8A8AA3' }}>
          Metricas de uso e adocao de features
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div
          className="flex flex-col gap-2 bg-white p-5"
          style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
        >
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" style={{ color: '#9EEA6C' }} />
            <span className="text-[13px] font-medium" style={{ color: '#8A8AA3' }}>
              Sessoes (30 dias)
            </span>
          </div>
          <span className="text-[28px] font-bold" style={{ color: '#121217' }}>
            {data.totalSessionsLast30}
          </span>
        </div>

        <div
          className="flex flex-col gap-2 bg-white p-5"
          style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" style={{ color: '#244C4E' }} />
            <span className="text-[13px] font-medium" style={{ color: '#8A8AA3' }}>
              Trainers Ativos (7d)
            </span>
          </div>
          <span className="text-[28px] font-bold" style={{ color: '#121217' }}>
            {data.activeTrainers}
            <span className="ml-1 text-[14px] font-normal" style={{ color: '#8A8AA3' }}>
              / {data.totalTrainers}
            </span>
          </span>
        </div>

        <div
          className="flex flex-col gap-2 bg-white p-5"
          style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
        >
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" style={{ color: '#244C4E' }} />
            <span className="text-[13px] font-medium" style={{ color: '#8A8AA3' }}>
              Media sessoes/dia
            </span>
          </div>
          <span className="text-[28px] font-bold" style={{ color: '#121217' }}>
            {data.totalSessionsLast30 > 0
              ? (data.totalSessionsLast30 / 30).toFixed(1)
              : '0'}
          </span>
        </div>
      </div>

      {/* Sessions per day */}
      <div
        className="flex flex-col gap-4 bg-white p-5"
        style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
      >
        <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>
          Sessoes por Dia (30 dias)
        </h2>
        {Object.keys(data.sessionsByDay).length > 0 ? (
          <div className="flex items-end gap-1" style={{ height: '120px' }}>
            {Object.entries(data.sessionsByDay).map(([day, count]) => {
              const maxCount = Math.max(...Object.values(data.sessionsByDay))
              const height = maxCount > 0 ? (count / maxCount) * 100 : 0

              return (
                <div key={day} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] font-medium" style={{ color: '#121217' }}>
                    {count}
                  </span>
                  <div
                    className="w-full min-h-[4px]"
                    style={{
                      height: `${height}%`,
                      backgroundColor: '#9EEA6C',
                      borderRadius: '4px 4px 0 0',
                    }}
                  />
                  <span className="text-[9px]" style={{ color: '#8A8AA3' }}>
                    {day}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex h-[120px] items-center justify-center">
            <span className="text-[13px]" style={{ color: '#8A8AA3' }}>
              Sem sessoes nos ultimos 30 dias
            </span>
          </div>
        )}
      </div>

      {/* Feature Adoption */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>
          Feature Adoption
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div
            className="flex items-center gap-4 bg-white p-5"
            style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: '#F0FDF4' }}
            >
              <Wifi className="h-5 w-5" style={{ color: '#16A34A' }} />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold" style={{ color: '#121217' }}>
                WhatsApp
              </span>
              <span className="text-[12px]" style={{ color: '#8A8AA3' }}>
                {data.whatsappCount} trainers ({adoptionRate(data.whatsappCount)})
              </span>
            </div>
          </div>

          <div
            className="flex items-center gap-4 bg-white p-5"
            style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: '#EFF6FF' }}
            >
              <Calendar className="h-5 w-5" style={{ color: '#3B82F6' }} />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold" style={{ color: '#121217' }}>
                Google Calendar
              </span>
              <span className="text-[12px]" style={{ color: '#8A8AA3' }}>
                {data.calendarCount} trainers ({adoptionRate(data.calendarCount)})
              </span>
            </div>
          </div>

          <div
            className="flex items-center gap-4 bg-white p-5"
            style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: '#FFFBEB' }}
            >
              <Activity className="h-5 w-5" style={{ color: '#F59E0B' }} />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold" style={{ color: '#121217' }}>
                Onboarding Completo
              </span>
              <span className="text-[12px]" style={{ color: '#8A8AA3' }}>
                {data.onboardingCount} trainers ({adoptionRate(data.onboardingCount)})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Trainers */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4" style={{ color: '#F59E0B' }} />
          <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>
            Top Trainers por Sessoes
          </h2>
        </div>
        <div
          className="overflow-hidden bg-white"
          style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#F6F8FA' }}>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                  #
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                  Trainer
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                  Plano
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                  Sessoes
                </th>
              </tr>
            </thead>
            <tbody>
              {data.topTrainers.map((trainer, idx) => (
                <tr
                  key={trainer.id}
                  className="border-t"
                  style={{ borderColor: '#E2E7F1' }}
                >
                  <td className="px-4 py-3 text-[13px] font-medium" style={{ color: '#8A8AA3' }}>
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium" style={{ color: '#121217' }}>
                        {trainer.full_name}
                      </span>
                      <span className="text-[11px]" style={{ color: '#8A8AA3' }}>
                        {trainer.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize"
                      style={getPlanBadgeStyle(trainer.plan)}
                    >
                      {trainer.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] font-bold" style={{ color: '#121217' }}>
                    {trainer.sessions_count}
                  </td>
                </tr>
              ))}
              {data.topTrainers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[13px]" style={{ color: '#8A8AA3' }}>
                    Nenhuma sessao registrada ainda.
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
