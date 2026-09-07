import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createArtistPost, subscribeArtistPosts } from '@/services/artistPostService'
import { Button } from '@/components/common/Button'
import { Input, TextArea } from '@/components/common/Input'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { ArtistPost } from '@/types/artist'

export function CommunityPage() {
  const { firebaseUser } = useAuth()
  const [posts, setPosts] = useState<ArtistPost[] | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [visibility, setVisibility] = useState<ArtistPost['visibility']>('everyone')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeArtistPosts(firebaseUser.uid, setPosts)
  }, [firebaseUser])

  async function handlePost() {
    if (!firebaseUser || !title.trim()) return
    setPosting(true)
    try {
      await createArtistPost(firebaseUser.uid, { title, body, visibility })
      setTitle('')
      setBody('')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink-0">Community</h1>
        <p className="mt-1 text-sm text-ink-2">
          Post updates to everyone, just your followers, or just your paying supporters.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-1 p-4">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextArea placeholder="What's new?" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex items-center justify-between">
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as ArtistPost['visibility'])}
            className="rounded-lg border border-surface-border bg-surface-2 px-3 py-2 text-sm text-ink-0"
          >
            <option value="everyone">Everyone</option>
            <option value="followers">Followers only</option>
            <option value="supporters">Supporters only</option>
          </select>
          <Button size="sm" onClick={handlePost} loading={posting} disabled={!title.trim()}>
            Post
          </Button>
        </div>
      </div>

      {posts === null ? (
        <LoadingState />
      ) : posts.length === 0 ? (
        <EmptyState title="No posts yet" description="Share your first update with your followers." />
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <div key={post.postId} className="rounded-xl border border-surface-border bg-surface-1 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-ink-0">{post.title}</h3>
                <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs text-ink-2">
                  {post.visibility === 'everyone' ? 'Everyone' : post.visibility === 'followers' ? 'Followers' : 'Supporters'}
                </span>
              </div>
              {post.body ? <p className="mt-2 text-sm text-ink-1">{post.body}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
