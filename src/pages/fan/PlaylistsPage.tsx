import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListMusic, Plus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { createPlaylist, subscribeOwnPlaylists } from '@/services/playlistService'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { useToast } from '@/contexts/ToastContext'
import type { PlaylistDoc } from '@/types/playlist'

export function PlaylistsPage() {
  const { firebaseUser } = useAuth()
  const [playlists, setPlaylists] = useState<PlaylistDoc[] | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const { notify } = useToast()

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeOwnPlaylists(firebaseUser.uid, setPlaylists)
  }, [firebaseUser])

  async function handleCreate() {
    if (!firebaseUser || !newTitle.trim()) return
    setCreating(true)
    try {
      const title = newTitle.trim()
      await createPlaylist(firebaseUser.uid, title)
      setNewTitle('')
      notify(`Created ${title}.`)
    } catch {
      notify('Could not create the playlist. Please try again.', 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink-0">Playlists</h1>

      <div className="flex max-w-md gap-2">
        <Input
          placeholder="New playlist or album name"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <Button onClick={handleCreate} loading={creating} disabled={!newTitle.trim()}>
          <Plus className="h-4 w-4" />
          Create
        </Button>
      </div>

      {playlists === null ? (
        <LoadingState />
      ) : playlists.length === 0 ? (
        <EmptyState icon={<ListMusic className="h-8 w-8 text-ink-3" />} title="No playlists yet" description="Create your first playlist above." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {playlists.map((playlist) => (
            <Link
              key={playlist.playlistId}
              to={`/app/playlists/${playlist.playlistId}`}
              className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-1 p-4 hover:bg-surface-2"
            >
              <div className="flex aspect-square items-center justify-center rounded-lg bg-surface-3">
                <ListMusic className="h-8 w-8 text-ink-3" />
              </div>
              <div>
                <p className="truncate text-sm font-medium text-ink-0">{playlist.title}</p>
                <p className="text-xs text-ink-2">{playlist.trackIds.length} tracks</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
