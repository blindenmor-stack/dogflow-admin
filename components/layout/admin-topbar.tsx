'use client'

import { useRouter } from 'next/navigation'
import { LogOut, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function AdminTopbar() {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header
      className="fixed top-0 left-[240px] right-0 z-30 flex h-14 items-center justify-between border-b bg-white px-6"
      style={{ borderColor: '#E2E7F1' }}
    >
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-[#8A8AA3]" />
        <span className="text-[13px] text-[#8A8AA3]">Admin Panel</span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        className="text-[13px] text-[#8A8AA3] hover:text-[#244C4E]"
      >
        <LogOut className="mr-2 h-4 w-4" />
        Sair
      </Button>
    </header>
  )
}
