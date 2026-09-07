import { StoryBubble } from './StoryBubble'

export interface StoryRailGroup {
  artistId: string
  hasUnseen: boolean
}

export function StoryRail({ groups, onOpen }: { groups: StoryRailGroup[]; onOpen: (artistId: string) => void }) {
  if (groups.length === 0) return null
  return (
    <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
      {groups.map((g) => (
        <StoryBubble key={g.artistId} artistId={g.artistId} hasUnseen={g.hasUnseen} onClick={() => onOpen(g.artistId)} />
      ))}
    </div>
  )
}
