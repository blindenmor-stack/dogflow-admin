'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  DollarSign,
  Activity,
  FileText,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Trainers', href: '/trainers', icon: Users },
  { label: 'Receita', href: '/revenue', icon: DollarSign },
  { label: 'Engajamento', href: '/engagement', icon: Activity },
  { label: 'Blog', href: '/blog', icon: FileText },
  { label: 'Configurações', href: '/settings', icon: Settings },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[240px] border-r bg-white"
      style={{ borderColor: '#E2E7F1' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b" style={{ borderColor: '#E2E7F1' }}>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: '#9EEA6C' }}
        >
          <ShieldCheck className="h-4 w-4" style={{ color: '#244C4E' }} />
        </div>
        <span className="text-[15px] font-semibold" style={{ color: '#244C4E' }}>
          DogFlow Admin
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors',
                isActive
                  ? 'text-[#244C4E]'
                  : 'text-[#8A8AA3] hover:text-[#244C4E]'
              )}
              style={
                isActive
                  ? { backgroundColor: '#9EEA6C20' }
                  : undefined
              }
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
