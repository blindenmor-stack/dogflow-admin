import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getTrainersData() {
  const supabase = await createServiceClient()

  const { data: trainers } = await supabase
    .from('profiles')
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
  })) || []

  return enriched
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
                Telefone
              </th>
              <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                Plano
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

              return (
                <tr
                  key={trainer.id}
                  className="border-t hover:bg-[#F6F8FA] transition-colors"
                  style={{ borderColor: '#E2E7F1' }}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/trainers/${trainer.id}`}
                      className="text-[13px] font-medium hover:underline"
                      style={{ color: '#121217' }}
                    >
                      {trainer.full_name || 'Sem nome'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[13px]" style={{ color: '#8A8AA3' }}>
                    {trainer.email || '-'}
                  </td>
                  <td className="px-4 py-3 text-[13px]" style={{ color: '#8A8AA3' }}>
                    {trainer.phone || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize"
                      style={planStyle}
                    >
                      {trainer.plan || 'starter'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px]" style={{ color: '#8A8AA3' }}>
                    {format(new Date(trainer.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-medium" style={{ color: '#121217' }}>
                    {trainer.sessions_count}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-medium" style={{ color: '#121217' }}>
                    {trainer.clients_count}
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
            {trainers.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[13px]" style={{ color: '#8A8AA3' }}>
                  Nenhum trainer cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
