import { Heart } from 'lucide-react'
import { Link } from 'react-router-dom'

const sizeClasses = {
  sm: 'text-sm px-3 py-1.5 rounded-lg gap-1.5',
  md: 'text-sm px-4 py-2.5 rounded-xl gap-2',
  lg: 'text-base px-6 py-3.5 rounded-xl gap-2',
} as const

/** Routes to the Subscription page, where checkout and artist allocation live. */
export function SupportButton({ size = 'md' }: { size?: keyof typeof sizeClasses }) {
  return (
    <Link
      to="/app/subscription"
      className={`inline-flex items-center justify-center font-medium bg-support-500 text-white hover:bg-support-400 shadow-lg shadow-support-500/20 transition-colors duration-150 ${sizeClasses[size]}`}
    >
      <Heart className="h-4 w-4" />
      Support
    </Link>
  )
}
