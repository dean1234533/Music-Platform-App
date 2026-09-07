import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Star, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeArtistTracks } from '@/services/artistService'
import { createStory, deleteStory, toggleStoryHighlight, uploadStoryMedia } from '@/services/storyService'
import { useMediaUpload } from '@/hooks/useMediaUpload'
import { UploadProgress } from '@/components/common/UploadProgress'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { STORY_DEFAULT_DURATION_HOURS, STORY_MAX_DURATION_HOURS } from '@/constants/mediaConfig'
import type { TrackDoc } from '@/types/track'
import type { StoryCategory, StoryCtaType, StoryDoc, StoryMediaKind, StoryVisibility } from '@/types/story'
import { subscribeArtistStories } from '@/services/storyService'

const MEDIA_KINDS: { value: StoryMediaKind; label: string }[] = [
  { value: 'image', label: 'Photo' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio clip' },
  { value: 'text', label: 'Text only' },
  { value: 'poll', label: 'Poll' },
]

const CATEGORIES: { value: StoryCategory; label: string }[] = [
  { value: 'studio_clip', label: 'Studio clip' },
  { value: 'gig_announcement', label: 'Gig announcement' },
  { value: 'new_song_teaser', label: 'New song teaser' },
  { value: 'behind_the_scenes', label: 'Behind the scenes' },
  { value: 'shoutout', label: 'Shoutout' },
  { value: 'poll_question', label: 'Poll question' },
  { value: 'other', label: 'Other' },
]

const VISIBILITIES: { value: StoryVisibility; label: string }[] = [
  { value: 'public', label: 'Public — anyone' },
  { value: 'followers', label: 'Followers only' },
  { value: 'supporters', label: 'Supporters only' },
  { value: 'dj', label: 'DJs only (requires DJ Stories enabled in Settings)' },
]

export function StoriesPage() {
  const { firebaseUser } = useAuth()
  const [tracks, setTracks] = useState<TrackDoc[]>([])
  const [stories, setStories] = useState<StoryDoc[] | null>(null)

  const [mediaKind, setMediaKind] = useState<StoryMediaKind>('image')
  const [storyCategory, setStoryCategory] = useState<StoryCategory>('studio_clip')
  const [visibility, setVisibility] = useState<StoryVisibility>('public')
  const [caption, setCaption] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [expiresInHours, setExpiresInHours] = useState(STORY_DEFAULT_DURATION_HOURS)
  const [ctaType, setCtaType] = useState<StoryCtaType | ''>('')
  const [ctaTargetId, setCtaTargetId] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mediaUpload = useMediaUpload()

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeArtistTracks(firebaseUser.uid, setTracks)
  }, [firebaseUser])

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeArtistStories(firebaseUser.uid, setStories)
  }, [firebaseUser])

  function resetForm() {
    setCaption('')
    setFile(null)
    setCtaType('')
    setCtaTargetId('')
    setPollOptions(['', ''])
    mediaUpload.reset()
  }

  async function handleSubmit() {
    if (!firebaseUser) return
    setSubmitting(true)
    setError(null)
    try {
      let mediaUrl: string | undefined
      if (mediaKind === 'image' || mediaKind === 'video' || mediaKind === 'audio') {
        if (!file) throw new Error('Choose a file first.')
        mediaUpload.setProcessing(0)
        mediaUrl = await uploadStoryMedia(firebaseUser.uid, visibility, mediaKind, file, (pct) =>
          mediaUpload.setUploadProgress(pct),
        )
        mediaUpload.setDone()
      }

      await createStory({
        mediaKind,
        storyCategory,
        mediaUrl,
        caption,
        visibility,
        expiresInHours,
        ctaType: ctaType || undefined,
        ctaTargetId: ctaType === 'track' ? ctaTargetId : undefined,
        pollOptions: mediaKind === 'poll' ? pollOptions.filter((o) => o.trim()) : undefined,
      })
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post this Story.')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit =
    !submitting &&
    (mediaKind === 'text' || mediaKind === 'poll' || !!file) &&
    (mediaKind !== 'poll' || pollOptions.filter((o) => o.trim()).length >= 2) &&
    (ctaType !== 'track' || !!ctaTargetId)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-0">Stories</h1>
          <p className="mt-1 text-sm text-ink-2">Share something that disappears after 24 hours — or pin it as a highlight.</p>
        </div>
        <Link to="/dashboard/artist/stories/analytics" className="text-sm font-medium text-brand-400 hover:underline">
          Analytics →
        </Link>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-surface-border p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Type</Label>
            <select
              value={mediaKind}
              onChange={(e) => setMediaKind(e.target.value as StoryMediaKind)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-ink-0"
            >
              {MEDIA_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Category</Label>
            <select
              value={storyCategory}
              onChange={(e) => setStoryCategory(e.target.value as StoryCategory)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-ink-0"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {mediaKind === 'image' || mediaKind === 'video' || mediaKind === 'audio' ? (
          <div>
            <Label>File</Label>
            <input
              type="file"
              accept={mediaKind === 'image' ? 'image/*' : mediaKind === 'video' ? 'video/*' : 'audio/*'}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-ink-2 file:mr-4 file:rounded-full file:border-0 file:bg-white/[0.06] file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink-0 hover:file:bg-white/[0.09]"
            />
          </div>
        ) : null}

        {mediaKind === 'poll' ? (
          <div className="flex flex-col gap-2">
            <Label>Poll options (2-4)</Label>
            {pollOptions.map((opt, i) => (
              <Input
                key={i}
                value={opt}
                onChange={(e) => setPollOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))}
                placeholder={`Option ${i + 1}`}
              />
            ))}
            {pollOptions.length < 4 ? (
              <button
                type="button"
                onClick={() => setPollOptions((prev) => [...prev, ''])}
                className="self-start text-xs text-brand-400 hover:underline"
              >
                + Add option
              </button>
            ) : null}
          </div>
        ) : null}

        <div>
          <Label>Caption</Label>
          <TextArea rows={2} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What's happening?" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Visibility</Label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as StoryVisibility)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-ink-0"
            >
              {VISIBILITIES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{`Visible for (hours, 1-${STORY_MAX_DURATION_HOURS})`}</Label>
            <Input
              type="number"
              min={1}
              max={STORY_MAX_DURATION_HOURS}
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Call to action (optional)</Label>
            <select
              value={ctaType}
              onChange={(e) => setCtaType(e.target.value as StoryCtaType | '')}
              className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-ink-0"
            >
              <option value="">None</option>
              <option value="track">Listen to a track</option>
              <option value="follow">Follow me</option>
              <option value="support">Support me</option>
            </select>
          </div>
          {ctaType === 'track' ? (
            <div>
              <Label>Track</Label>
              <select
                value={ctaTargetId}
                onChange={(e) => setCtaTargetId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-ink-0"
              >
                <option value="">Choose a track</option>
                {tracks.map((t) => (
                  <option key={t.trackId} value={t.trackId}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <UploadProgress state={mediaUpload.state} />
        {error ? <p className="text-sm text-danger-500">{error}</p> : null}

        <Button onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
          Post Story
        </Button>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-ink-0">Your Stories</h2>
        {stories === null ? (
          <LoadingState />
        ) : stories.length === 0 ? (
          <EmptyState title="No Stories yet" description="Post one above to see it here." />
        ) : (
          <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
            {stories.map((s) => (
              <div key={s.storyId} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-0">{s.caption || s.storyCategory}</p>
                  <p className="text-xs text-ink-2">
                    {s.visibility} · {s.uniqueViewerCount} views · {s.reactionCount} reactions
                  </p>
                </div>
                <button
                  onClick={() => toggleStoryHighlight({ storyId: s.storyId, isHighlight: !s.isHighlight })}
                  className={`rounded-full p-2 ${s.isHighlight ? 'text-brand-400' : 'text-ink-3 hover:text-ink-0'}`}
                  title={s.isHighlight ? 'Remove from highlights' : 'Pin as highlight'}
                >
                  <Star className="h-4 w-4" fill={s.isHighlight ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={() => deleteStory(s.storyId)}
                  className="rounded-full p-2 text-ink-3 hover:text-danger-500"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
