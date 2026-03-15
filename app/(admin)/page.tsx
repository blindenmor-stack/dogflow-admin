import { createServiceClient } from '@/lib/supabase/server'
import { PLAN_PRICES } from '@/lib/types/admin'
import {
  DollarSign,
  Users,
  UserCheck,
  TrendingDown,
  CalendarDays,
  Calendar,
  PawPrint,
  AlertTriangle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

async function getAdminData() {
  const supabase = await createServiceClient()

  // Get all trainers (profiles)
  const { data: trainers, error: trainersError } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (trainersError) {
    console.error('Error fetching trainers:', trainersError)
  }

  // Get sessions count
  const { count: sessionsCount } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })

  // Get sessions this week
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const { count: sessionsThisWeek } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', weekAgo.toISOString())

  // Get clients count
  const { count: clientsCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })

  // Get trainer stats (sessions count per trainer)
  const { data: trainerSessions } = await supabase
    .from('sessions')
    .select('trainer_id')

  // Get client counts per trainer
  const { data: trainerClients } = await supabase
    .from('clients')
    .select('trainer_id')

  // Build per-trainer stats
  const sessionsByTrainer: Record<string, number> = {}
  trainerSessions?.forEach((s) => {
    sessionsByTrainer[s.trainer_id] = (sessionsByTrainer[s.trainer_id] || 0) + 1
  })

  const clientsByTrainer: Record<string, number> = {}
  trainerClients?.forEach((c) => {
    clientsByTrainer[c.trainer_id] = (clientsByTrainer[c.trainer_id] || 0) + 1
  })

  // Calculate MRR
  let mrr = 0
  const planCounts = { starter: 0, pro: 0, scale: 0 }
  trainers?.forEach((t) => {
    const plan = (t.plan || 'starter') as keyof typeof PLAN_PRICES
    if (PLAN_PRICES[plan]) {
      mrr += PLAN_PRICES[plan]
      planCounts[plan]++
    }
  })

  // Enrich trainers with stats
  const enrichedTrainers = trainers?.map((t) => ({
    ...t,
    sessions_count: sessionsByTrainer[t.id] || 0,
    clients_count: clientsByTrainer[t.id] || 0,
  }))

  // Find inactive trainers (no activity in 7+ days)
  const inactiveTrainers = enrichedTrainers?.filter((t) => {
    const lastActivity = t.updated_at || t.created_at
    const daysSince = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
    return daysSince > 7
  }) || []

  // Find trainers with 0 sessions
  const noSessionTrainers = enrichedTrainers?.filter((t) => t.sessions_count === 0) || []

  return {
    trainers: enrichedTrainers || [],
    totalTrainers: trainers?.length || 0,
    activeTrainers: trainers?.length || 0, // MVP: all trainers
    totalSessions: sessionsCount || 0,
    sessionsThisWeek: sessionsThisWeek || 0,
    totalClients: clientsCount || 0,
    mrr,
    planCounts,
    inactiveTrainers,
    noSessionTrainers,
  }
}

function KPICard({
  icon: Icon,
  label,
  value,
  subtext,
  iconColor,
}: {
  icon: React.ElementType
  label: string
  value: string
  subtext?: string
  iconColor?: string
}) {
  return (
    <div
      className="flex flex-col gap-2 bg-white p-5"
      style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium" style={{ color: '#8A8AA3' }}>
          {label}
        </span>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: '#F6F8FA' }}
        >
          <Icon className="h-4 w-4" style={{ color: iconColor || '#8A8AA3' }} />
        </div>
      </div>
      <span className="text-[28px] font-bold leading-none" style={{ color: '#121217' }}>
        {value}
      </span>
      {subtext && (
        <span className="text-[12px]" style={{ color: '#8A8AA3' }}>
          {subtext}
        </span>
      )}
    </div>
  )
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

function getStatusBadge(updatedAt: string) {
  const daysSince = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSince > 30) {
    return { label: 'Inativo 30d+', color: '#DC2626', bg: '#FEF2F2' }
  }
  if (daysSince > 7) {
    return { label: 'Inativo 7d+', color: '#F59E0B', bg: '#FFFBEB' }
  }
  return { label: 'Ativo', color: '#16A34A', bg: '#F0FDF4' }
}

export default async function OverviewPage() {
  const data = await getAdminData()

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold" style={{ color: '#244C4E' }}>
          Overview
        </h1>
        <p className="text-[14px]" style={{ color: '#8A8AA3' }}>
          Visao geral do DogFlow SaaS
        </p>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          icon={DollarSign}
          label="MRR"
          value={`R$ ${data.mrr.toLocaleString('pt-BR')}`}
          subtext={`${data.planCounts.starter}x Starter, ${data.planCounts.pro}x Pro, ${data.planCounts.scale}x Scale`}
          iconColor="#16A34A"
        />
        <KPICard
          icon={UserCheck}
          label="Trainers Ativos"
          value={String(data.activeTrainers)}
          subtext="Logaram nos ultimos 7 dias"
          iconColor="#9EEA6C"
        />
        <KPICard
          icon={Users}
          label="Total Trainers"
          value={String(data.totalTrainers)}
          iconColor="#244C4E"
        />
        <KPICard
          icon={TrendingDown}
          label="Churn Rate"
          value="0%"
          subtext="Dados insuficientes"
          iconColor="#8A8AA3"
        />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KPICard
          icon={CalendarDays}
          label="NSM: Sessoes/semana"
          value={String(data.sessionsThisWeek)}
          subtext="Ultimos 7 dias"
          iconColor="#9EEA6C"
        />
        <KPICard
          icon={Calendar}
          label="Sessoes Total"
          value={String(data.totalSessions)}
          iconColor="#244C4E"
        />
        <KPICard
          icon={PawPrint}
          label="Clientes Cadastrados"
          value={String(data.totalClients)}
          subtext="Todos os trainers"
          iconColor="#244C4E"
        />
      </div>

      {/* Alerts */}
      {(data.inactiveTrainers.length > 0 || data.noSessionTrainers.length > 0) && (
        <div className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>
            Alertas
          </h2>

          {data.inactiveTrainers.length > 0 && (
            <div
              className="flex items-start gap-3 p-4"
              style={{
                backgroundColor: '#FFFBEB',
                borderRadius: '12px',
                border: '1px solid #FDE68A',
              }}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#F59E0B' }} />
              <div>
                <p className="text-[13px] font-medium" style={{ color: '#92400E' }}>
                  {data.inactiveTrainers.length} trainer(s) inativos ha 7+ dias
                </p>
                <p className="mt-1 text-[12px]" style={{ color: '#A16207' }}>
                  {data.inactiveTrainers.map((t) => t.full_name || t.email).join(', ')}
                </p>
              </div>
            </div>
          )}

          {data.noSessionTrainers.length > 0 && (
            <div
              className="flex items-start gap-3 p-4"
              style={{
                backgroundColor: '#FFFBEB',
                borderRadius: '12px',
                border: '1px solid #FDE68A',
              }}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#F59E0B' }} />
              <div>
                <p className="text-[13px] font-medium" style={{ color: '#92400E' }}>
                  {data.noSessionTrainers.length} trainer(s) com 0 sessoes
                </p>
                <p className="mt-1 text-[12px]" style={{ color: '#A16207' }}>
                  {data.noSessionTrainers.map((t) => t.full_name || t.email).join(', ')}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Trainers Table */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>
            Trainers Recentes
          </h2>
          <Link
            href="/trainers"
            className="text-[13px] font-medium"
            style={{ color: '#9EEA6C' }}
          >
            Ver todos
          </Link>
        </div>

        <div
          className="overflow-hidden bg-white"
          style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#F6F8FA' }}>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                  Nome
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                  Email
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                  Plano
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                  Sessoes
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                  Ultima atividade
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {data.trainers.slice(0, 10).map((trainer) => {
                const status = getStatusBadge(trainer.updated_at || trainer.created_at)
                const planStyle = getPlanBadgeStyle(trainer.plan || 'starter')

                return (
                  <tr
                    key={trainer.id}
                    className="border-t hover:bg-[#F6F8FA] transition-colors cursor-pointer"
                    style={{ borderColor: '#E2E7F1' }}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/trainers/${trainer.id}`} className="text-[13px] font-medium" style={{ color: '#121217' }}>
                        {trainer.full_name || 'Sem nome'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#8A8AA3' }}>
                      {trainer.email || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize"
                        style={planStyle}
                      >
                        {trainer.plan || 'starter'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#121217' }}>
                      {trainer.sessions_count}
                    </td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#8A8AA3' }}>
                      {formatDistanceToNow(new Date(trainer.updated_at || trainer.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                        style={{ backgroundColor: status.bg, color: status.color }}
                      >
                        {status.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {data.trainers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[13px]" style={{ color: '#8A8AA3' }}>
                    Nenhum trainer cadastrado ainda.
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
