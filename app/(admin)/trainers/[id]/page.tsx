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
} from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getTrainerData(id: string) {
  const supabase = await createServiceClient()

  // Get trainer profile
  const { data: trainer, error } = await supabase
    .from('trainers')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !trainer) return null

  // Get sessions
  const { data: sessions, count: sessionsCount } = await supabase
    .from('sessions')
    .select('*', { count: 'exact' })
    .eq('trainer_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Get clients count
  const { count: clientsCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('trainer_id', id)

  // Get dogs count
  const { count: dogsCount } = await supabase
    .from('dogs')
    .select('*', { count: 'exact', head: true })
    .eq('trainer_id', id)

  // Get payments
  const { data: payments, count: paymentsCount } = await supabase
    .from('payments')
    .select('*', { count: 'exact' })
    .eq('trainer_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Calculate total payments
  const paymentsTotal = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0

  return {
    trainer,
    sessions: sessions || [],
    sessionsCount: sessionsCount || 0,
    clientsCount: clientsCount || 0,
    dogsCount: dogsCount || 0,
    payments: payments || [],
    paymentsCount: paymentsCount || 0,
    paymentsTotal,
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

export default async function TrainerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getTrainerData(id)

  if (!data) notFound()

  const { trainer, sessions, sessionsCount, clientsCount, dogsCount, payments, paymentsTotal } = data
  const plan = (trainer.plan || 'starter') as keyof typeof PLAN_PRICES

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
