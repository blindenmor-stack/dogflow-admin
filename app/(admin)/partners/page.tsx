import { createServiceClient } from '@/lib/supabase/server'
import { Handshake, Ticket, Users, Gift } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

type Partner = { id: string; name?: string | null; slug?: string | null }
type Coupon = {
  id: string
  partner_id?: string | null
  code?: string | null
  trial_days?: number | null
  active?: boolean | null
  max_redemptions?: number | null
  redemptions_count?: number | null
}

async function getPartnersData() {
  const supabase = await createServiceClient()

  // Tabelas novas — podem ainda não existir; degrada com empty state
  const [partnersRes, couponsRes, trainersRes] = await Promise.all([
    supabase.from('partners').select('*'),
    supabase.from('partner_coupons').select('*'),
    supabase.from('trainers').select('*').order('created_at', { ascending: false }),
  ])

  const partners: Partner[] = partnersRes.error ? [] : partnersRes.data || []
  const coupons: Coupon[] = couponsRes.error ? [] : couponsRes.data || []
  const allTrainers = trainersRes.data || []

  const partnerById = new Map(partners.map((p) => [p.id, p]))

  // Trainers que vieram por cupom (coluna partner_code pode não existir ainda — filtra no JS)
  const fromCoupon = allTrainers.filter(
    (t) => typeof t.partner_code === 'string' && t.partner_code.length > 0
  )

  // Resgates por parceiro
  const redemptionsByPartner = new Map<string, number>()
  for (const c of coupons) {
    const pid = c.partner_id || '_'
    redemptionsByPartner.set(pid, (redemptionsByPartner.get(pid) || 0) + (c.redemptions_count || 0))
  }
  const partnerTotals = partners
    .map((p) => ({
      id: p.id,
      name: p.name || p.slug || '—',
      redemptions: redemptionsByPartner.get(p.id) || 0,
      coupons: coupons.filter((c) => c.partner_id === p.id).length,
    }))
    .sort((a, b) => b.redemptions - a.redemptions)

  return {
    partners,
    coupons,
    partnerById,
    fromCoupon,
    partnerTotals,
    totalRedemptions: coupons.reduce((s, c) => s + (c.redemptions_count || 0), 0),
    tablesExist: !partnersRes.error && !couponsRes.error,
  }
}

export default async function PartnersPage() {
  const d = await getPartnersData()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-bold" style={{ color: '#244C4E' }}>Parceiros</h1>
        <p className="text-[14px]" style={{ color: '#8A8AA3' }}>
          Cupons de parceria e trainers que vieram por indicação
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bg-white p-5 rounded-2xl border border-[#E2E7F1]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#8A8AA3]">Parceiros</span>
            <Handshake className="h-4 w-4" style={{ color: '#244C4E' }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: '#121217' }}>{d.partners.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#E2E7F1]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#8A8AA3]">Resgates totais</span>
            <Gift className="h-4 w-4" style={{ color: '#16A34A' }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: '#121217' }}>{d.totalRedemptions}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#E2E7F1]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#8A8AA3]">Trainers via cupom</span>
            <Users className="h-4 w-4" style={{ color: '#8B5CF6' }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: '#121217' }}>{d.fromCoupon.length}</p>
        </div>
      </div>

      {/* Resgates por parceiro */}
      {d.partnerTotals.length > 0 && (
        <div className="flex flex-col gap-3 bg-white p-5" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
          <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>Resgates por parceiro</h2>
          <div className="flex flex-wrap gap-3">
            {d.partnerTotals.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: '#F6F8FA' }}>
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: '#244C4E' }}>{p.name}</p>
                  <p className="text-[11px]" style={{ color: '#8A8AA3' }}>{p.coupons} cupom(ns)</p>
                </div>
                <span className="text-[20px] font-bold" style={{ color: '#244C4E' }}>{p.redemptions}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cupons */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4" style={{ color: '#244C4E' }} />
          <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>Cupons</h2>
        </div>
        <div className="overflow-hidden bg-white" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F6F8FA' }}>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Parceiro</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Código</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Dias de trial</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Resgates</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Ativo</th>
                </tr>
              </thead>
              <tbody>
                {d.coupons.map((c) => {
                  const partner = c.partner_id ? d.partnerById.get(c.partner_id) : null
                  return (
                    <tr key={c.id} className="border-t" style={{ borderColor: '#E2E7F1' }}>
                      <td className="px-4 py-3 text-[13px] font-medium" style={{ color: '#121217' }}>
                        {partner?.name || partner?.slug || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded px-2 py-0.5 text-[12px] font-bold" style={{ backgroundColor: '#9EEA6C20', color: '#244C4E' }}>
                          {c.code || '—'}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-[13px]" style={{ color: '#8A8AA3' }}>
                        {c.trial_days != null ? `${c.trial_days} dias` : '—'}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-medium" style={{ color: '#121217' }}>
                        {c.redemptions_count ?? 0}
                        {c.max_redemptions != null && (
                          <span style={{ color: '#8A8AA3' }}> / {c.max_redemptions}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                          style={{
                            backgroundColor: c.active ? '#F0FDF4' : '#F6F8FA',
                            color: c.active ? '#16A34A' : '#8A8AA3',
                          }}
                        >
                          {c.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {d.coupons.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center">
                      <p className="text-[13px] font-medium" style={{ color: '#8A8AA3' }}>Nenhum cupom criado ainda</p>
                      <p className="mt-1 text-[12px]" style={{ color: '#B0B0C3' }}>
                        Crie cupons de parceria (ex.: MalhaCão) pra estender o trial de quem vem por indicação.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Trainers via cupom */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>
          Trainers que vieram por cupom ({d.fromCoupon.length})
        </h2>
        <div className="overflow-hidden bg-white" style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F6F8FA' }}>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Trainer</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Cupom</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Resgatado em</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Fim do trial</th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {d.fromCoupon.map((t) => (
                  <tr key={t.id} className="border-t hover:bg-[#F6F8FA] transition-colors" style={{ borderColor: '#E2E7F1' }}>
                    <td className="px-4 py-3">
                      <Link href={`/trainers/${t.id}`} className="text-[13px] font-medium hover:underline" style={{ color: '#121217' }}>
                        {t.full_name || '—'}
                      </Link>
                      <p className="text-[11px]" style={{ color: '#8A8AA3' }}>{t.email || ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded px-2 py-0.5 text-[12px] font-bold" style={{ backgroundColor: '#9EEA6C20', color: '#244C4E' }}>
                        {t.partner_code}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#8A8AA3' }}>
                      {t.coupon_redeemed_at
                        ? format(new Date(t.coupon_redeemed_at), 'dd/MM/yyyy', { locale: ptBR })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: '#8A8AA3' }}>
                      {t.trial_ends_at
                        ? format(new Date(t.trial_ends_at), 'dd/MM/yyyy', { locale: ptBR })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize"
                        style={{
                          backgroundColor:
                            t.subscription_status === 'active'
                              ? '#F0FDF4'
                              : t.subscription_status === 'trial'
                                ? '#FFFBEB'
                                : '#F6F8FA',
                          color:
                            t.subscription_status === 'active'
                              ? '#16A34A'
                              : t.subscription_status === 'trial'
                                ? '#F59E0B'
                                : '#8A8AA3',
                        }}
                      >
                        {t.subscription_status || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
                {d.fromCoupon.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center">
                      <p className="text-[13px] font-medium" style={{ color: '#8A8AA3' }}>Nenhum trainer veio por cupom ainda</p>
                      <p className="mt-1 text-[12px]" style={{ color: '#B0B0C3' }}>
                        Quando alguém se cadastrar com código de parceiro, aparece aqui.
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
