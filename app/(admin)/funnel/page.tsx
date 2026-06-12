import { createServiceClient } from '@/lib/supabase/server'
import {
  FUNNEL_STEPS,
  countFunnel,
  deriveStage,
  daysBetween,
  median,
  type TrainerMilestones,
} from '@/lib/funnel'
import { Filter, Zap, Timer, CheckCircle2, Send } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

async function getFunnelData() {
  const supabase = await createServiceClient()

  const [{ data: trainers }, stepEventsRes] = await Promise.all([
    supabase.from('trainers').select('*').order('created_at', { ascending: true }),
    supabase
      .from('analytics_events')
      .select('trainer_id, properties')
      .eq('event_name', 'onboarding_step_completed'),
  ])

  const all = (trainers || []) as TrainerMilestones[]
  const counts = countFunnel(all)

  // Breakdown dos steps de onboarding via eventos (complemento ao funil por colunas)
  const stepTrainers: Record<string, Set<string>> = {}
  if (!stepEventsRes.error) {
    for (const e of stepEventsRes.data || []) {
      const props = (e.properties || {}) as Record<string, unknown>
      const step = String(props.step ?? '?')
      if (!stepTrainers[step]) stepTrainers[step] = new Set()
      stepTrainers[step].add(e.trainer_id)
    }
  }
  const onboardingSteps = Object.entries(stepTrainers)
    .map(([step, set]) => ({ step, count: set.size }))
    .sort((a, b) => a.step.localeCompare(b.step, undefined, { numeric: true }))

  // Trainers parados (não completaram o funil), com etapa onde pararam
  const stuck = all
    .map((t) => {
      const stage = deriveStage(t)
      return {
        id: t.id,
        name: (t.full_name as string) || (t.email as string) || '—',
        email: (t.email as string) || '',
        stage,
        daysStuck: daysBetween(stage.lastMilestoneAt, new Date().toISOString()),
        demoFollowupAt: (t.demo_followup_sent_at as string | null) ?? null,
      }
    })
    .filter((t) => t.stage.stuckAt !== null)
    .sort((a, b) => b.daysStuck - a.daysStuck)

  // Métricas do plano de onboarding
  const withAha = all.filter((t) => t.aha_at)
  const ahaD2 = withAha.filter((t) => daysBetween(t.created_at, t.aha_at as string) <= 2)
  const ahaD2Rate = all.length > 0 ? (ahaD2.length / all.length) * 100 : 0
  const medianDaysToAha = median(withAha.map((t) => daysBetween(t.created_at, t.aha_at as string)))

  return { all, counts, onboardingSteps, stuck, ahaD2Rate, ahaD2Count: ahaD2.length, withAhaCount: withAha.length, medianDaysToAha }
}

export default async function FunnelPage() {
  const d = await getFunnelData()
  const total = d.counts[0] || 0

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-bold" style={{ color: '#244C4E' }}>Funil de Ativação</h1>
        <p className="text-[14px]" style={{ color: '#8A8AA3' }}>
          Cadastro → onboarding → aha → hábito → conversão (contado por marcos no banco)
        </p>
      </div>

      {/* Métricas do plano de onboarding */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bg-white p-5 rounded-2xl border border-[#E2E7F1]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#8A8AA3]">Aha em D2 (≤48h)</span>
            <Zap className="h-4 w-4" style={{ color: '#F59E0B' }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: '#121217' }}>{d.ahaD2Rate.toFixed(0)}%</p>
          <p className="text-xs text-[#8A8AA3] mt-1">{d.ahaD2Count} de {total} trainers chegaram ao aha em até 2 dias</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#E2E7F1]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#8A8AA3]">Tempo mediano cadastro → aha</span>
            <Timer className="h-4 w-4" style={{ color: '#3B82F6' }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: '#121217' }}>
            {d.medianDaysToAha !== null ? `${d.medianDaysToAha.toFixed(1)}d` : '—'}
          </p>
          <p className="text-xs text-[#8A8AA3] mt-1">
            {d.withAhaCount > 0 ? `Base: ${d.withAhaCount} trainer(s) com aha` : 'Nenhum trainer chegou ao aha ainda'}
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#E2E7F1]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#8A8AA3]">Completaram o funil</span>
            <CheckCircle2 className="h-4 w-4" style={{ color: '#16A34A' }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: '#121217' }}>
            {d.counts[FUNNEL_STEPS.length - 1]}
          </p>
          <p className="text-xs text-[#8A8AA3] mt-1">Trainers convertidos (pagantes)</p>
        </div>
      </div>

      {/* Funil visual */}
      <div className="flex flex-col gap-4 bg-white p-5" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" style={{ color: '#244C4E' }} />
          <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>Funil (todos os trainers)</h2>
        </div>
        {total > 0 ? (
          <div className="flex flex-col gap-2">
            {FUNNEL_STEPS.map((step, i) => {
              const count = d.counts[i]
              const pctOfTotal = total > 0 ? (count / total) * 100 : 0
              const prev = i > 0 ? d.counts[i - 1] : count
              const convRate = i > 0 && prev > 0 ? (count / prev) * 100 : 100

              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className="w-[150px] shrink-0 text-right">
                    <p className="text-[12px] font-medium leading-tight" style={{ color: '#244C4E' }}>{step.label}</p>
                    {i > 0 && (
                      <p className="text-[10px]" style={{ color: convRate >= 50 ? '#16A34A' : '#DC2626' }}>
                        {convRate.toFixed(0)}% da etapa anterior
                      </p>
                    )}
                  </div>
                  <div className="relative h-8 flex-1 overflow-hidden rounded-lg" style={{ backgroundColor: '#F6F8FA' }}>
                    <div
                      className="flex h-full items-center rounded-lg px-2"
                      style={{
                        width: `${Math.max(pctOfTotal, count > 0 ? 8 : 0)}%`,
                        backgroundColor: i >= FUNNEL_STEPS.length - 2 ? '#244C4E' : '#9EEA6C',
                        transition: 'width .3s',
                      }}
                    >
                      <span className="text-[12px] font-bold" style={{ color: i >= FUNNEL_STEPS.length - 2 ? '#FFFFFF' : '#244C4E' }}>
                        {count}
                      </span>
                    </div>
                    {count === 0 && (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px] font-bold" style={{ color: '#B0B0C3' }}>0</span>
                    )}
                  </div>
                  <span className="w-[44px] shrink-0 text-[12px] font-medium" style={{ color: '#8A8AA3' }}>
                    {pctOfTotal.toFixed(0)}%
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex h-[120px] flex-col items-center justify-center gap-1">
            <span className="text-[13px]" style={{ color: '#8A8AA3' }}>Nenhum trainer cadastrado ainda</span>
          </div>
        )}
      </div>

      {/* Breakdown de steps do onboarding (via eventos) */}
      {d.onboardingSteps.length > 0 && (
        <div className="flex flex-col gap-3 bg-white p-5" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
          <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>Steps do onboarding (eventos)</h2>
          <div className="flex flex-wrap gap-3">
            {d.onboardingSteps.map((s) => (
              <div key={s.step} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: '#F6F8FA' }}>
                <span className="text-[12px] font-medium" style={{ color: '#8A8AA3' }}>Step {s.step}</span>
                <span className="text-[14px] font-bold" style={{ color: '#244C4E' }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trainers parados */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>
          Onde cada trainer parou ({d.stuck.length})
        </h2>
        <div className="overflow-hidden bg-white" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F6F8FA' }}>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Trainer</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Última etapa atingida</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Travado em</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Há quantos dias</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Follow-up demo</th>
                </tr>
              </thead>
              <tbody>
                {d.stuck.map((t) => (
                  <tr key={t.id} className="border-t hover:bg-[#F6F8FA] transition-colors" style={{ borderColor: '#E2E7F1' }}>
                    <td className="px-4 py-3">
                      <Link href={`/trainers/${t.id}`} className="text-[13px] font-medium hover:underline" style={{ color: '#121217' }}>
                        {t.name}
                      </Link>
                      <p className="text-[11px]" style={{ color: '#8A8AA3' }}>{t.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: '#9EEA6C20', color: '#244C4E' }}>
                        {t.stage.reached.short}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: '#FFFBEB', color: '#F59E0B' }}>
                        {t.stage.stuckAt?.short}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-medium" style={{ color: t.daysStuck > 7 ? '#DC2626' : '#121217' }}>
                      {Math.floor(t.daysStuck)}d
                    </td>
                    <td className="px-4 py-3">
                      {t.demoFollowupAt ? (
                        <span className="flex items-center gap-1 text-[12px]" style={{ color: '#16A34A' }}>
                          <Send className="h-3 w-3" />
                          {format(new Date(t.demoFollowupAt), 'dd/MM/yy', { locale: ptBR })}
                        </span>
                      ) : (
                        <span className="text-[12px]" style={{ color: '#B0B0C3' }}>Não enviado</span>
                      )}
                    </td>
                  </tr>
                ))}
                {d.stuck.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center">
                      <p className="text-[13px] font-medium" style={{ color: '#8A8AA3' }}>
                        {d.all.length === 0 ? 'Nenhum trainer cadastrado ainda' : 'Todos os trainers completaram o funil 🎉'}
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
