import { createServiceClient } from '@/lib/supabase/server'
import {
  DollarSign,
  Users,
  UserCheck,
  CalendarDays,
  MessageSquare,
  Wifi,
  Calendar,
  CheckCircle,
  XCircle,
  PawPrint,
  Clock,
  TrendingUp,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

async function getAdminData() {
  const supabase = await createServiceClient()

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const [
    { data: trainers },
    { data: messages },
  ] = await Promise.all([
    supabase.from('trainers').select('*').order('created_at', { ascending: false }),
    supabase.from('messages').select('trainer_id, direction, created_at').gte('created_at', weekAgo.toISOString()),
  ])

  // Per-trainer stats
  const msgByTrainer: Record<string, number> = {}
  messages?.forEach(m => { msgByTrainer[m.trainer_id] = (msgByTrainer[m.trainer_id] || 0) + 1 })

  const { data: clientsByTrainer } = await supabase.from('clients').select('trainer_id')
  const clientCount: Record<string, number> = {}
  clientsByTrainer?.forEach(c => { clientCount[c.trainer_id] = (clientCount[c.trainer_id] || 0) + 1 })

  const { data: dogsByTrainer } = await supabase.from('dogs').select('trainer_id')
  const dogCount: Record<string, number> = {}
  dogsByTrainer?.forEach(d => { dogCount[d.trainer_id] = (dogCount[d.trainer_id] || 0) + 1 })

  const { data: sessionsByTrainer } = await supabase.from('sessions').select('trainer_id')
  const sessionCount: Record<string, number> = {}
  sessionsByTrainer?.forEach(s => { sessionCount[s.trainer_id] = (sessionCount[s.trainer_id] || 0) + 1 })

  const activeTrainerIds = new Set(messages?.map(m => m.trainer_id) || [])

  // Categorize trainers
  const allTrainers = (trainers || []).map(t => ({
    ...t,
    messages_week: msgByTrainer[t.id] || 0,
    clients_count: clientCount[t.id] || 0,
    dogs_count: dogCount[t.id] || 0,
    sessions_count: sessionCount[t.id] || 0,
    is_active_7d: activeTrainerIds.has(t.id),
  }))

  const trial = allTrainers.filter(t => t.subscription_status === 'trial')
  const paying = allTrainers.filter(t => t.subscription_status === 'active')
  const cancelled = allTrainers.filter(t => t.subscription_status === 'cancelled')
  const onboarded = allTrainers.filter(t => t.onboarding_completed)
  const withWhatsapp = allTrainers.filter(t => t.messages_week > 0)
  const withCalendar = allTrainers.filter(t => t.google_calendar_connected)
  const with3Dogs = allTrainers.filter(t => t.dogs_count >= 3)

  // MRR (Monthly Recurring Revenue) — only paying customers
  const planPrices: Record<string, number> = { starter: 39, pro: 97, scale: 197 }
  const mrr = paying.reduce((sum, t) => sum + (planPrices[t.plan] || 0), 0)

  return {
    trainers: allTrainers,
    total: allTrainers.length,
    trial: trial.length,
    paying: paying.length,
    cancelled: cancelled.length,
    active7d: withWhatsapp.length,
    onboarded: onboarded.length,
    withCalendar: withCalendar.length,
    with3Dogs: with3Dogs.length,
    mrr,
    totalMessages: messages?.length || 0,
  }
}

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export default async function AdminPage() {
  const d = await getAdminData()
  const activationRate = d.total > 0 ? Math.round((d.active7d / d.total) * 100) : 0
  const onboardingRate = d.total > 0 ? Math.round((d.onboarded / d.total) * 100) : 0

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold" style={{ color: '#121217' }}>DogFlow Admin</h1>

      {/* Revenue */}
      <div>
        <h2 className="text-sm font-semibold text-[#8A8AA3] mb-3 uppercase tracking-wide">Receita</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPI icon={DollarSign} label="MRR" value={fmt(d.mrr)} sub={`${d.paying} pagante(s)`} color="#16A34A" />
          <KPI icon={Users} label="Trial" value={String(d.trial)} sub="Testando o app" color="#F59E0B" />
          <KPI icon={UserCheck} label="Pagantes" value={String(d.paying)} sub="Assinatura ativa" color="#16A34A" />
          <KPI icon={XCircle} label="Cancelados" value={String(d.cancelled)} color="#DC2626" />
        </div>
      </div>

      {/* Engagement */}
      <div>
        <h2 className="text-sm font-semibold text-[#8A8AA3] mb-3 uppercase tracking-wide">Engajamento (7 dias)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPI icon={MessageSquare} label="Usando WhatsApp" value={`${d.active7d}/${d.total}`} sub={`${activationRate}% ativação`} color="#8B5CF6" />
          <KPI icon={CheckCircle} label="Onboarding completo" value={`${d.onboarded}/${d.total}`} sub={`${onboardingRate}%`} color="#3B82F6" />
          <KPI icon={Calendar} label="Google Calendar" value={String(d.withCalendar)} sub="Conectaram" color="#0EA5E9" />
          <KPI icon={PawPrint} label="3+ cães cadastrados" value={String(d.with3Dogs)} sub="Engajamento alto" color="#9EEA6C" />
        </div>
      </div>

      {/* Trainers Table */}
      <div className="bg-white rounded-2xl border border-[#E2E7F1] overflow-hidden">
        <div className="p-5 border-b border-[#E2E7F1] flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: '#121217' }}>Adestradores ({d.total})</h2>
          <span className="text-xs text-[#8A8AA3]">{d.totalMessages} mensagens na semana</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E7F1] bg-[#F9FAFB]">
                <th className="text-left p-3 font-medium text-[#8A8AA3]">Adestrador</th>
                <th className="text-center p-3 font-medium text-[#8A8AA3]">Plano</th>
                <th className="text-center p-3 font-medium text-[#8A8AA3]">Onboarding</th>
                <th className="text-center p-3 font-medium text-[#8A8AA3]">WhatsApp</th>
                <th className="text-center p-3 font-medium text-[#8A8AA3]">Calendar</th>
                <th className="text-center p-3 font-medium text-[#8A8AA3]">Tutores</th>
                <th className="text-center p-3 font-medium text-[#8A8AA3]">Cães</th>
                <th className="text-center p-3 font-medium text-[#8A8AA3]">Sessões</th>
                <th className="text-center p-3 font-medium text-[#8A8AA3]">Msgs (7d)</th>
                <th className="text-center p-3 font-medium text-[#8A8AA3]">Status</th>
                <th className="text-right p-3 font-medium text-[#8A8AA3]">Desde</th>
              </tr>
            </thead>
            <tbody>
              {d.trainers.map((t) => {
                const statusColor = t.subscription_status === 'active' ? '#16A34A' : t.subscription_status === 'trial' ? '#F59E0B' : '#DC2626'
                const statusLabel = t.subscription_status === 'active' ? 'Pagante' : t.subscription_status === 'trial' ? 'Trial' : 'Cancelado'

                return (
                  <tr key={t.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                    <td className="p-3">
                      <div>
                        <p className="font-medium" style={{ color: '#121217' }}>{t.full_name || '—'}</p>
                        <p className="text-xs text-[#8A8AA3]">{t.email || '—'}</p>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                        backgroundColor: t.plan === 'pro' ? '#9EEA6C20' : t.plan === 'scale' ? '#3B82F620' : '#F3F4F6',
                        color: t.plan === 'pro' ? '#244C4E' : t.plan === 'scale' ? '#1D4ED8' : '#6B7280',
                      }}>
                        {(t.plan || 'starter').charAt(0).toUpperCase() + (t.plan || 'starter').slice(1)}
                      </span>
                    </td>
                    <td className="p-3 text-center">{t.onboarding_completed ? <CheckCircle className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-gray-300 mx-auto" />}</td>
                    <td className="p-3 text-center">
                      {t.messages_week > 0
                        ? <Wifi className="h-4 w-4 text-green-500 mx-auto" />
                        : <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
                      }
                    </td>
                    <td className="p-3 text-center">{t.google_calendar_connected ? <Calendar className="h-4 w-4 text-blue-500 mx-auto" /> : <XCircle className="h-4 w-4 text-gray-300 mx-auto" />}</td>
                    <td className="p-3 text-center font-medium">{t.clients_count}</td>
                    <td className="p-3 text-center font-medium">{t.dogs_count}</td>
                    <td className="p-3 text-center font-medium">{t.sessions_count}</td>
                    <td className="p-3 text-center font-medium" style={{ color: t.messages_week > 10 ? '#16A34A' : t.messages_week > 0 ? '#F59E0B' : '#DC2626' }}>
                      {t.messages_week}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: statusColor + '15', color: statusColor }}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="p-3 text-right text-[#8A8AA3] text-xs">
                      {t.created_at ? formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: ptBR }) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KPI({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string; sub?: string; color: string }) {
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
