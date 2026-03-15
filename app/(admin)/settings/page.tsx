import { PLAN_PRICES } from '@/lib/types/admin'
import { Settings, DollarSign, Shield, Info } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold" style={{ color: '#244C4E' }}>
          Configuracoes
        </h1>
        <p className="text-[14px]" style={{ color: '#8A8AA3' }}>
          Configuracoes do painel admin
        </p>
      </div>

      {/* Admin Info */}
      <div
        className="flex flex-col gap-4 bg-white p-6"
        style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
      >
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" style={{ color: '#244C4E' }} />
          <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>
            Administrador
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className="text-[12px]" style={{ color: '#8A8AA3' }}>Email</span>
            <p className="text-[14px] font-medium" style={{ color: '#121217' }}>
              bernardo@dogflow.com.br
            </p>
          </div>
          <div>
            <span className="text-[12px]" style={{ color: '#8A8AA3' }}>Acesso</span>
            <p className="text-[14px] font-medium" style={{ color: '#121217' }}>
              Super Admin
            </p>
          </div>
        </div>
      </div>

      {/* Plan Pricing */}
      <div
        className="flex flex-col gap-4 bg-white p-6"
        style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
      >
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" style={{ color: '#244C4E' }} />
          <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>
            Precos dos Planos
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(Object.keys(PLAN_PRICES) as Array<keyof typeof PLAN_PRICES>).map((plan) => (
            <div
              key={plan}
              className="flex flex-col gap-2 p-4"
              style={{ borderRadius: '12px', border: '1px solid #E2E7F1', backgroundColor: '#F6F8FA' }}
            >
              <span className="text-[14px] font-semibold capitalize" style={{ color: '#244C4E' }}>
                {plan}
              </span>
              <span className="text-[24px] font-bold" style={{ color: '#121217' }}>
                R$ {PLAN_PRICES[plan]}
                <span className="text-[13px] font-normal" style={{ color: '#8A8AA3' }}>/mes</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div
        className="flex items-start gap-3 p-4"
        style={{ borderRadius: '12px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#3B82F6' }} />
        <div>
          <p className="text-[13px] font-medium" style={{ color: '#1E40AF' }}>
            Sobre este painel
          </p>
          <p className="mt-1 text-[12px]" style={{ color: '#3B82F6' }}>
            Este e o painel admin do DogFlow SaaS. Ele usa o service_role key do Supabase para acessar
            dados de todos os trainers, bypassando RLS. Todas as metricas sao calculadas em tempo real
            a partir do banco de dados.
          </p>
        </div>
      </div>
    </div>
  )
}
