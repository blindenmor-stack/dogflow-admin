import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Users, ShieldCheck } from 'lucide-react'
import { deriveStage, type TrainerMilestones } from '@/lib/funnel'

export const dynamic = 'force-dynamic'

async function getTrainersData() {
  const supabase = await createServiceClient()

  const { data: trainers } = await supabase
    .from('trainers')
    .select('*')
    .order('created_at', { ascending: false })

  // Get sessions count per trainer
  const { data: trainerSessions } = await supabase
    .from('sessions')
    .select('trainer_id')

  // Get client counts per trainer
  const { data: trainerClients } = await supabase
    .from('clients')
    .select('trainer_id')

  const sessionsByTrainer: Record<string, number> = {}
  trainerSessions?.forEach((s) => {
    sessionsByTrainer[s.trainer_id] = (sessionsByTrainer[s.trainer_id] || 0) + 1
  })

  const clientsByTrainer: Record<string, number> = {}
  trainerClients?.forEach((c) => {
    clientsByTrainer[c.trainer_id] = (clientsByTrainer[c.trainer_id] || 0) + 1
  })

  const enriched = trainers?.map((t) => ({
    ...t,
    sessions_count: sessionsByTrainer[t.id] || 0,
    clients_count: clientsByTrainer[t.id] || 0,
    stage: deriveStage(t as TrainerMilestones),
  })) || []

  return enriched
}

function trialBadge(trialEndsAt: string | null | undefined) {
  if (!trialEndsAt) return null
  const days = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0) return { label: 'Trial expirado', color: '#DC2626', bg: '#FEF2F2' }
  if (days <= 7) return { label: `Expira em ${days}d`, color: '#F59E0B', bg: '#FFFBEB' }
  return { label: `Expira em ${days}d`, color: '#16A34A', bg: '#F0FDF4' }
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

export default async function TrainersPage() {
  const trainers = await getTrainersData()

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: '#244C4E' }}>
            Trainers
          </h1>
          <p className="text-[14px]" style={{ color: '#8A8AA3' }}>
            {trainers.length} adestradores cadastrados
          </p>
        </div>
        <div
          className="flex h-10 items-center gap-2 rounded-lg px-4"
          style={{ backgroundColor: '#F6F8FA', border: '1px solid #E2E7F1' }}
        >
          <Users className="h-4 w-4" style={{ color: '#8A8AA3' }} />
          <span className="text-[14px] font-semibold" style={{ color: '#244C4E' }}>
            {trainers.length}
          </span>
        </div>
      </div>

      {/* Table */}
      <div
        className="overflow-hidden bg-white"
        style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
      >
        <div className="overflow-x-auto">
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
                Etapa do funil
              </th>
              <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                Trial
              </th>
              <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                Cupom
              </th>
              <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                Criado em
              </th>
              <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                Sessoes
              </th>
              <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                Clientes
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
            {trainers.map((trainer) => {
              const status = getStatusBadge(trainer.updated_at || trainer.created_at)
              const planStyle = getPlanBadgeStyle(trainer.plan || 'starter')
              const trial = trainer.subscription_status === 'trial' ? trialBadge(trainer.trial_ends_at) : null

              return (
                <tr
                  key={trainer.id}
                  className="border-t hover:bg-[#F6F8FA] transition-colors"
                  style={{ borderColor: '#E2E7F1' }}
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <Link
                        href={`/trainers/${trainer.id}`}
                        className="text-[13px] font-medium hover:underline"
                        style={{ color: '#121217' }}
                      >
                        {trainer.full_name || 'Sem nome'}
                      </Link>
                      {trainer.is_admin === true && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: '#244C4E', color: '#9EEA6C' }}
                        >
                          <ShieldCheck className="h-3 w-3" /> Admin
                        </span>
                      )}
                    </span>
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
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: '#9EEA6C20', color: '#244C4E' }}
                    >
                      {trainer.stage.reached.short}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {trial ? (
                      <span
                        className="inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                        style={{ backgroundColor: trial.bg, color: trial.color }}
                      >
                        {trial.label}
                      </span>
                    ) : (
                      <span className="text-[12px]" style={{ color: '#B0B0C3' }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {typeof trainer.partner_code === 'string' && trainer.partner_code ? (
                      <code className="rounded px-1.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: '#9EEA6C20', color: '#244C4E' }}>
                        {trainer.partner_code}
                      </code>
                    ) : (
                      <span className="text-[12px]" style={{ color: '#B0B0C3' }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[13px] whitespace-nowrap" style={{ color: '#8A8AA3' }}>
                    {format(new Date(trainer.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-medium" style={{ color: '#121217' }}>
                    {trainer.sessions_count}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-medium" style={{ color: '#121217' }}>
                    {trainer.clients_count}
                  </td>
                  <td className="px-4 py-3 text-[13px] whitespace-nowrap" style={{ color: '#8A8AA3' }}>
                    {formatDistanceToNow(new Date(trainer.updated_at || trainer.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: status.bg, color: status.color }}
                    >
                      {status.label}
                    </span>
                  </td>
                </tr>
              )
            })}
            {trainers.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-[13px]" style={{ color: '#8A8AA3' }}>
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
