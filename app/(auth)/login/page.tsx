'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShieldCheck, Loader2 } from 'lucide-react'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const unauthorizedError = searchParams.get('error') === 'unauthorized'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (email !== 'bernardo@dogflow.com.br') {
      setError('Acesso restrito. Apenas administradores podem acessar.')
      setLoading(false)
      return
    }

    const supabase = createClient()

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
      <div
        className="w-full max-w-[400px] bg-white p-8"
        style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
      >
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center"
            style={{ backgroundColor: '#9EEA6C', borderRadius: '12px' }}
          >
            <ShieldCheck className="h-6 w-6" style={{ color: '#244C4E' }} />
          </div>
          <div className="text-center">
            <h1 className="text-[20px] font-semibold" style={{ color: '#244C4E' }}>
              DogFlow Admin
            </h1>
            <p className="mt-1 text-[13px]" style={{ color: '#8A8AA3' }}>
              Painel de gerenciamento SaaS
            </p>
          </div>
        </div>

        {/* Error messages */}
        {(error || unauthorizedError) && (
          <div
            className="mb-4 rounded-lg px-4 py-3 text-[13px]"
            style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
          >
            {unauthorizedError
              ? 'Acesso negado. Apenas administradores podem acessar este painel.'
              : error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-[13px] font-medium" style={{ color: '#244C4E' }}>
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="bernardo@dogflow.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 text-[14px]"
              style={{ borderRadius: '8px', borderColor: '#E2E7F1' }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="text-[13px] font-medium" style={{ color: '#244C4E' }}>
              Senha
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-10 text-[14px]"
              style={{ borderRadius: '8px', borderColor: '#E2E7F1' }}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="mt-2 h-10 w-full text-[14px] font-medium"
            style={{
              backgroundColor: '#9EEA6C',
              color: '#244C4E',
              borderRadius: '8px',
              border: 'none',
            }}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
