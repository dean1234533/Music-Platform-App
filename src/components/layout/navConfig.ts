import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Bell,
  Compass,
  CreditCard,
  Disc3,
  FileClock,
  FileText,
  Handshake,
  Heart,
  Home,
  Layers,
  Library,
  LineChart,
  ListMusic,
  MessageSquare,
  Music4,
  Radar,
  Search,
  Settings,
  ShieldAlert,
  Sliders,
  UploadCloud,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MusicGlyph } from '@/components/common/MusicGlyph'
import type { ComponentType, SVGProps } from 'react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon | ComponentType<SVGProps<SVGSVGElement>>
  end?: boolean
}

// Order matters: MobileNav shows the first `mobilePrimaryCount` items as
// persistent bottom tabs and puts the rest behind a "More" sheet, so the
// most-used destinations for that role should come first. Desktop's
// Sidebar shows the full list in this same order regardless.
export const fanNavItems: NavItem[] = [
  { label: 'Home', to: '/app/home', icon: Home, end: true },
  { label: 'Discover', to: '/app/discover', icon: Compass },
  { label: 'Search', to: '/app/search', icon: Search },
  { label: 'Library', to: '/app/library', icon: Library },
  { label: 'Following', to: '/app/following', icon: Users },
  { label: 'Supported', to: '/app/supported', icon: Heart },
  { label: 'Playlists', to: '/app/playlists', icon: ListMusic },
  { label: 'Subscription', to: '/app/subscription', icon: CreditCard },
  { label: 'Notifications', to: '/app/notifications', icon: Bell },
  { label: 'Profile', to: '/app/profile', icon: User },
  { label: 'Settings', to: '/app/settings', icon: Settings },
]
/** Notifications/Profile already have a persistent shortcut in TopBar on mobile — no need for them in the "More" sheet too. */
export const fanMobileMoreExclude = ['/app/notifications', '/app/profile']

export const artistDashboardNavItems: NavItem[] = [
  { label: 'Overview', to: '/dashboard/artist', icon: BarChart3, end: true },
  { label: 'Music', to: '/dashboard/artist/music', icon: Disc3 },
  { label: 'Upload', to: '/dashboard/artist/upload', icon: UploadCloud },
  { label: 'Revenue', to: '/dashboard/artist/revenue', icon: Wallet },
  { label: 'Stories', to: '/dashboard/artist/stories', icon: MusicGlyph },
  { label: 'Community', to: '/dashboard/artist/community', icon: Users },
  { label: 'DJ Requests', to: '/dashboard/artist/dj-requests', icon: MessageSquare },
  { label: 'DJ Deals', to: '/dashboard/artist/deals', icon: Handshake },
  { label: 'Agreements', to: '/agreements', icon: FileText },
  { label: 'Settings', to: '/dashboard/artist/settings', icon: Settings },
]

export const djNavItems: NavItem[] = [
  { label: 'Discover', to: '/dj/discover', icon: Radar, end: true },
  { label: 'Requests', to: '/dj/requests', icon: MessageSquare },
  { label: 'Crates', to: '/dj/crates', icon: Layers },
  { label: 'Analytics', to: '/dj/analytics', icon: LineChart },
  { label: 'Agreements', to: '/agreements', icon: FileText },
  { label: 'Profile', to: '/dj/profile', icon: Music4 },
]

export const adminNavItems: NavItem[] = [
  { label: 'Users', to: '/admin/users', icon: Users, end: true },
  { label: 'Verification', to: '/admin/verification', icon: BadgeCheck },
  { label: 'Reports', to: '/admin/reports', icon: AlertTriangle },
  { label: 'Plans & fees', to: '/admin/settings', icon: Sliders },
  { label: 'Audit log', to: '/admin/audit-log', icon: FileClock },
  { label: 'Security incidents', to: '/admin/security-incidents', icon: ShieldAlert },
]
