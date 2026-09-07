import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeArtistStories } from '@/services/storyService'
import { LoadingState } from '@/components/common/StateViews'
import type { StoryDoc } from '@/types/story'

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-1 p-4">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink-0">{value}</p>
    </div>
  )
}

function BarList({ rows }: { rows: [string, number][] }) {
  if (rows.length === 0) return <p className="text-xs text-ink-3">No data yet.</p>
  const max = Math.max(...rows.map(([, count]) => count), 1)
  return (
    <div className="flex flex-col gap-2">
      {rows.map(([label, count]) => (
        <div key={label} className="flex items-center gap-3 text-xs">
          <span className="w-40 shrink-0 truncate text-ink-2">{label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right text-ink-1">{count}</span>
        </div>
      ))}
    </div>
  )
}

export function StoryAnalyticsPage() {
  const { firebaseUser } = useAuth()
  const [stories, setStories] = useState<StoryDoc[] | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeArtistStories(firebaseUser.uid, setStories)
  }, [firebaseUser])

  if (stories === null) return <LoadingState />

  const totalViews = stories.reduce((sum, s) => sum + s.uniqueViewerCount, 0)
  const totalReactions = stories.reduce((sum, s) => sum + s.reactionCount, 0)
  const totalCtaClicks = stories.reduce((sum, s) => sum + s.ctaClickCount, 0)
  const totalPollVotes = stories.reduce((sum, s) => sum + Object.values(s.pollVoteCounts).reduce((a, b) => a + b, 0), 0)

  const topByViews: [string, number][] = [...stories]
    .sort((a, b) => b.uniqueViewerCount - a.uniqueViewerCount)
    .slice(0, 10)
    .map((s) => [s.caption || s.storyCategory, s.uniqueViewerCount])

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink-0">Story analytics</h1>
        <p className="mt-1 text-sm text-ink-2">Real counts only — views, reactions, CTA clicks, and poll responses.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Stories posted" value={String(stories.length)} />
        <StatCard label="Total unique views" value={String(totalViews)} />
        <StatCard label="Total reactions" value={String(totalReactions)} />
        <StatCard label="CTA clicks" value={String(totalCtaClicks)} />
      </div>

      {totalPollVotes > 0 ? (
        <div>
          <StatCard label="Poll responses" value={String(totalPollVotes)} />
        </div>
      ) : null}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink-0">Top Stories by views</h2>
        <BarList rows={topByViews} />
      </div>
    </div>
  )
}
