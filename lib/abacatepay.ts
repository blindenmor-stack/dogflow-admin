// ─────────────────────────────────────────────────────────────
// AbacatePay — consulta direta à API (v2) pelo admin.
// Usado em /revenue como enriquecimento (status dos checkouts de
// assinatura). A fonte primária de receita é o banco:
// tabela abacatepay_events + colunas abacatepay_* dos trainers.
//
// Env: ABACATEPAY_API_KEY (chave DEV abc_dev_* enquanto a conta
// estiver em dev mode; trocar pela live na Vercel ao ir pra prod).
// Gotchas: usar SEMPRE /v2 (a v1 dá "API key version mismatch") e
// mandar User-Agent (o Cloudflare deles bloqueia sem — erro 1010).
// ─────────────────────────────────────────────────────────────

const ABACATEPAY_API_BASE = 'https://api.abacatepay.com/v2'

export type AbacateSubscriptionCheckout = {
  id: string
  externalId: string | null
  url: string
  amount: number // centavos
  paidAmount: number | null
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED' | string
  customerId: string | null
  createdAt: string
  updatedAt: string
  devMode?: boolean
}

/**
 * Lista os checkouts de assinatura criados na loja AbacatePay.
 * Retorna null se a env não estiver configurada ou a API falhar
 * (a página degrada com graça — o resto vem do banco).
 */
export async function listSubscriptionCheckouts(): Promise<AbacateSubscriptionCheckout[] | null> {
  const key = process.env.ABACATEPAY_API_KEY
  if (!key) return null
  try {
    const res = await fetch(`${ABACATEPAY_API_BASE}/subscriptions/list?limit=100`, {
      headers: {
        Authorization: `Bearer ${key}`,
        'User-Agent': 'DogFlowAdmin/1.0 (+https://dogflow.app.br)',
        Accept: 'application/json',
      },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = await res.json()
    if (!json?.success) return null
    return (json.data as AbacateSubscriptionCheckout[]) ?? []
  } catch {
    return null
  }
}
