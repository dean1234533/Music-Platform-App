import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, Compass, LayoutDashboard, Radar, ShieldCheck } from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '@/contexts/AuthContext'

interface Workspace {
  label: string
  to: string
  icon: typeof Compass
  isActive: (path: string) => boolean
}

/** Every signed-in user can reach the fan side; artist/DJ/admin appear only once that role exists on the account. */
function useWorkspaces(): Workspace[] {
  const { hasRole } = useAuth()
  const workspaces: Workspace[] = [
    { label: 'Fan', to: '/app/home', icon: Compass, isActive: (p) => p.startsWith('/app') },
  ]
  if (hasRole('artist')) {
    workspaces.push({ label: 'Artist', to: '/dashboard/artist', icon: LayoutDashboard, isActive: (p) => p.startsWith('/dashboard/artist') })
  }
  if (hasRole('dj')) {
    workspaces.push({ label: 'DJ', to: '/dj/discover', icon: Radar, isActive: (p) => p.startsWith('/dj') })
  }
  if (hasRole('admin')) {
    workspaces.push({ label: 'Admin', to: '/admin/users', icon: ShieldCheck, isActive: (p) => p.startsWith('/admin') })
  }
  return workspaces
}

/** Compact dropdown for the mobile TopBar. */
export function DashboardSwitcherCompact() {
  const location = useLocation()
  const workspaces = useWorkspaces()
  const [open, setOpen] = useState(false)
  if (workspaces.length < 2) return null
  const current = workspaces.find((w) => w.isActive(location.pathname)) ?? workspaces[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-full border border-surface-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink-1"
      >
        <current.icon className="h-3.5 w-3.5" />
        {current.label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-xl border border-surface-border bg-surface-1 shadow-xl">
            {workspaces.map((w) => (
              <Link
                key={w.to}
                to={w.to}
                onClick={() => setOpen(false)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2.5 text-sm',
                  w.isActive(location.pathname) ? 'bg-brand-400/[0.09] text-brand-400' : 'text-ink-1 hover:bg-surface-2',
                )}
              >
                <w.icon className="h-4 w-4" />
                {w.label}
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

/** Full-width row list for the desktop Sidebar. */
export function DashboardSwitcherSidebar() {
  const location = useLocation()
  const workspaces = useWorkspaces()
  if (workspaces.length < 2) return null

  return (
    <div className="mb-4 flex flex-col gap-1 border-b border-white/[0.06] pb-4">
      {workspaces.map((w) => (
        <Link
          key={w.to}
          to={w.to}
          className={clsx(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold',
            w.isActive(location.pathname) ? 'bg-white/[0.06] text-ink-0' : 'text-ink-3 hover:bg-white/[0.03] hover:text-ink-1',
          )}
        >
          <w.icon className="h-3.5 w-3.5" />
          {w.label}
        </Link>
      ))}
    </div>
  )
}
