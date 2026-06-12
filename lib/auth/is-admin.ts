// Verificação de admin via banco (trainers.is_admin) com fallback hardcoded.
// Usa fetch REST direto (leve o suficiente pra rodar no middleware) + cache em memória.

export const ADMIN_EMAIL = 'bernardo@dogflow.com.br'

type CacheEntry = { ok: boolean; exp: number }
const adminCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos

export async function isAdminUser(
  userId: string,
  email: string | null | undefined
): Promise<boolean> {
  // Fallback de segurança: email hardcoded sempre é admin
  if (email === ADMIN_EMAIL) return true

  const cached = adminCache.get(userId)
  if (cached && cached.exp > Date.now()) return cached.ok

  let ok = false
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (url && key) {
      const res = await fetch(
        `${url}/rest/v1/trainers?id=eq.${encodeURIComponent(userId)}&select=is_admin`,
        {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
          },
          cache: 'no-store',
        }
      )
      if (res.ok) {
        const rows = (await res.json()) as Array<{ is_admin?: boolean }>
        ok = rows?.[0]?.is_admin === true
      }
      // Se a coluna is_admin ainda não existir (400), ok permanece false
      // e o fallback de email continua valendo.
    }
  } catch {
    ok = false
  }

  adminCache.set(userId, { ok, exp: Date.now() + CACHE_TTL_MS })
  return ok
}
