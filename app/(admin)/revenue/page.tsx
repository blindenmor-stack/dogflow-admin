import { createServiceClient } from '@/lib/supabase/server'
import { PLAN_PRICES } from '@/lib/types/admin'
import { DollarSign, TrendingUp, Users } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

async function getRevenueData() {
  const supabase = await createServiceClient()

  const { data: trainers } = await supabase
    .from('trainers')
    .select('id, full_name, plan')

  let mrr = 0
  const planCounts = { starter: 0, pro: 0, scale: 0 }
  trainers?.forEach((t) => {
    const plan = (t.plan || 'starter') as keyof typeof PLAN_PRICES
    if (PLAN_PRICES[plan]) {
      mrr += PLAN_PRICES[plan]
      planCounts[plan]++
    }
  })

  const arr = mrr * 12
  const activeTrainers = trainers?.length || 1
  const arpu = mrr / activeTrainers

  const { data: payments } = await supabase
    .from('payments')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(20)

  return { mrr, arr, arpu, planCounts, totalTrainers: trainers?.length || 0, payments: payments || [] }
}

export default async function RevenuePage() {
  const data = await getRevenueData()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-bold" style={{ color: '#244C4E' }}>Receita</h1>
        <p className="text-[14px]" style={{ color: '#8A8AA3' }}>Metricas financeiras do DogFlow SaaS</p>
      </div>

      {/* Big KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { icon: DollarSign, label: 'MRR', value: `R$ ${data.mrr.toLocaleString('pt-BR')}`, sub: `${data.totalTrainers} trainers ativos` },
          { icon: TrendingUp, label: 'ARR', value: `R$ ${data.arr.toLocaleString('pt-BR')}`, sub: 'MRR x 12' },
          { icon: Users, label: 'ARPU', value: `R$ ${data.arpu.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: 'MRR / trainers ativos' },
        ].map((kpi) => (
          <div key={kpi.label} className="flex flex-col gap-3 bg-white p-6" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: '#9EEA6C20' }}>
                <kpi.icon className="h-4 w-4" style={{ color: '#244C4E' }} />
              </div>
              <span className="text-[13px] font-medium" style={{ color: '#8A8AA3' }}>{kpi.label}</span>
            </div>
            <span className="text-[32px] font-bold leading-none" style={{ color: '#121217' }}>{kpi.value}</span>
            <span className="text-[12px]" style={{ color: '#8A8AA3' }}>{kpi.sub}</span>
          </div>
        ))}
      </div>

      {/* Plan Breakdown */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>Breakdown por Plano</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(Object.keys(PLAN_PRICES) as Array<keyof typeof PLAN_PRICES>).map((plan) => (
            <div key={plan} className="flex items-center justify-between bg-white p-5" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
              <div className="flex flex-col gap-1">
                <span className="text-[14px] font-semibold capitalize" style={{ color: '#244C4E' }}>{plan}</span>
                <span className="text-[12px]" style={{ color: '#8A8AA3' }}>R$ {PLAN_PRICES[plan]}/mes</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[20px] font-bold" style={{ color: '#121217' }}>{data.planCounts[plan]}</span>
                <span className="text-[12px]" style={{ color: '#8A8AA3' }}>R$ {(data.planCounts[plan] * PLAN_PRICES[plan]).toLocaleString('pt-BR')}/mes</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue Bar */}
      <div className="bg-white p-5" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
        <span className="text-[13px] font-medium" style={{ color: '#8A8AA3' }}>Distribuicao de receita por plano</span>
        <div className="mt-3 flex h-8 overflow-hidden" style={{ borderRadius: '8px' }}>
          {data.mrr > 0 ? (
            <>
              {data.planCounts.starter > 0 && (
                <div className="flex items-center justify-center text-[11px] font-medium" style={{ width: `${(data.planCounts.starter * PLAN_PRICES.starter / data.mrr) * 100}%`, backgroundColor: '#E2E7F1', color: '#8A8AA3' }}>Starter</div>
              )}
              {data.planCounts.pro > 0 && (
                <div className="flex items-center justify-center text-[11px] font-medium" style={{ width: `${(data.planCounts.pro * PLAN_PRICES.pro / data.mrr) * 100}%`, backgroundColor: '#9EEA6C', color: '#244C4E' }}>Pro</div>
              )}
              {data.planCounts.scale > 0 && (
                <div className="flex items-center justify-center text-[11px] font-medium" style={{ width: `${(data.planCounts.scale * PLAN_PRICES.scale / data.mrr) * 100}%`, backgroundColor: '#244C4E', color: '#FFFFFF' }}>Scale</div>
              )}
            </>
          ) : (
            <div className="flex w-full items-center justify-center text-[11px] font-medium" style={{ backgroundColor: '#F6F8FA', color: '#8A8AA3' }}>Sem receita ainda</div>
          )}
        </div>
      </div>

      {/* Recent Payments */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>Pagamentos Recentes</h2>
        <div className="overflow-hidden bg-white" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#F6F8FA' }}>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Data</th>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Trainer</th>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Valor</th>
                <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((payment) => (
                <tr key={payment.id} className="border-t" style={{ borderColor: '#E2E7F1' }}>
                  <td className="px-4 py-3 text-[13px]" style={{ color: '#121217' }}>{format(new Date(payment.created_at), 'dd/MM/yyyy', { locale: ptBR })}</td>
                  <td className="px-4 py-3 text-[13px]" style={{ color: '#8A8AA3' }}>{(payment.profiles as { full_name: string } | null)?.full_name || '-'}</td>
                  <td className="px-4 py-3 text-[13px] font-medium" style={{ color: '#121217' }}>R$ {(payment.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize" style={{ backgroundColor: payment.status === 'paid' ? '#F0FDF4' : '#FFFBEB', color: payment.status === 'paid' ? '#16A34A' : '#F59E0B' }}>{payment.status || 'pending'}</span>
                  </td>
                </tr>
              ))}
              {data.payments.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-[13px]" style={{ color: '#8A8AA3' }}>Nenhum pagamento registrado ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
