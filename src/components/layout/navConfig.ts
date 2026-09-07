import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Bell,
  Compass,
  CreditCard,
  Disc3,
  FileClock,
  Heart,
  Home,
  Library,
  ListMusic,
  MessageSquare,
  Music4,
  Radar,
  Search,
  Settings,
  Sliders,
  UploadCloud,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
}

export const fanNavItems: NavItem[] = [
  { label: 'Home', to: '/app/home', icon: Home, end: true },
  { label: 'Discover', to: '/app/discover', icon: Compass },
  { label: 'Search', to: '/app/search', icon: Search },
  { label: 'Following', to: '/app/following', icon: Users },
  { label: 'Supported', to: '/app/supported', icon: Heart },
  { label: 'Library', to: '/app/library', icon: Library },
  { label: 'Playlists', to: '/app/playlists', icon: ListMusic },
  { label: 'Notifications', to: '/app/notifications', icon: Bell },
  { label: 'Subscription', to: '/app/subscription', icon: CreditCard },
  { label: 'Profile', to: '/app/profile', icon: User },
  { label: 'Settings', to: '/app/settings', icon: Settings },
]

export const fanMobileNavItems: NavItem[] = [
  { label: 'Home', to: '/app/home', icon: Home, end: true },
  { label: 'Discover', to: '/app/discover', icon: Compass },
  { label: 'Search', to: '/app/search', icon: Search },
  { label: 'Following', to: '/app/following', icon: Users },
  { label: 'You', to: '/app/profile', icon: User },
]

export const artistDashboardNavItems: NavItem[] = [
  { label: 'Overview', to: '/dashboard/artist', icon: BarChart3, end: true },
  { label: 'Music', to: '/dashboard/artist/music', icon: Disc3 },
  { label: 'Upload', to: '/dashboard/artist/upload', icon: UploadCloud },
  { label: 'Community', to: '/dashboard/artist/community', icon: Users },
  { label: 'DJ Requests', to: '/dashboard/artist/dj-requests', icon: MessageSquare },
  { label: 'Revenue', to: '/dashboard/artist/revenue', icon: Wallet },
  { label: 'Settings', to: '/dashboard/artist/settings', icon: Settings },
]

export const djNavItems: NavItem[] = [
  { label: 'Discover', to: '/dj/discover', icon: Radar, end: true },
  { label: 'Requests', to: '/dj/requests', icon: MessageSquare },
  { label: 'Profile', to: '/dj/profile', icon: Music4 },
]

export const adminNavItems: NavItem[] = [
  { label: 'Users', to: '/admin/users', icon: Users, end: true },
  { label: 'Verification', to: '/admin/verification', icon: BadgeCheck },
  { label: 'Reports', to: '/admin/reports', icon: AlertTriangle },
  { label: 'Plans & fees', to: '/admin/settings', icon: Sliders },
  { label: 'Audit log', to: '/admin/audit-log', icon: FileClock },
]
