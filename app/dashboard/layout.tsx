// app/dashboard/layout.tsx
import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <div className="flex min-h-screen">
      <Sidebar userEmail={user.email} />
      <main className="flex-1 overflow-y-auto p-7">
        {children}
      </main>
    </div>
  )
}
