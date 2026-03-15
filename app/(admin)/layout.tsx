import { AdminSidebar } from '@/components/layout/admin-sidebar'
import { AdminTopbar } from '@/components/layout/admin-topbar'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F3F4F6' }}>
      <AdminSidebar />
      <AdminTopbar />
      <main className="ml-[240px] pt-14">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
