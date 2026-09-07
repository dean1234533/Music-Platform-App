import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { createTrack, newTrackId, uploadTrackAssets } from '@/services/trackService'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'
import { formatFileSize, MAX_AUDIO_MB, MAX_IMAGE_MB, validateAudioFile, validateImageFile } from '@/utils/uploadLimits'
import type { LicenceMode, TrackVisibility } from '@/types/track'

const VISIBILITY_OPTIONS: { value: TrackVisibility; label: string }[] = [
  { value: 'public', label: 'Public stream' },
  { value: 'followers', label: 'Followers only' },
  { value: 'supporters', label: 'Supporters only' },
  { value: 'early_access', label: 'Early access' },
  { value: 'dj_only', label: 'DJ only' },
  { value: 'private', label: 'Private' },
]

const LICENCE_OPTIONS: { value: LicenceMode; label: string }[] = [
  { value: 'not_available', label: 'Not available for DJ use' },
  { value: 'free', label: 'Free' },
  { value: 'fixed_price', label: 'Fixed price' },
  { value: 'custom_price', label: 'Custom price' },
  { value: 'negotiated', label: 'Negotiated' },
]

export function UploadTrackPage() {
  const { firebaseUser } = useAuth()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [subgenre, setSubgenre] = useState('')
  const [bpm, setBpm] = useState('')
  const [mood, setMood] = useState('')
  const [description, setDescription] = useState('')
  const [explicit, setExplicit] = useState(false)
  const [songwriters, setSongwriters] = useState('')
  const [producers, setProducers] = useState('')
  const [featuredArtists, setFeaturedArtists] = useState('')
  const [visibility, setVisibility] = useState<TrackVisibility>('public')
  const [previewStartSec, setPreviewStartSec] = useState(0)
  const [previewDurationSec, setPreviewDurationSec] = useState(30)
  const [djPromotion, setDjPromotion] = useState(false)
  const [djLicenceMode, setDjLicenceMode] = useState<LicenceMode>('not_available')
  const [djFixedPrice, setDjFixedPrice] = useState('')

  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [fileErrors, setFileErrors] = useState<{ preview?: string; original?: string; artwork?: string }>({})

  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function audioFileHandler(field: 'preview' | 'original', setter: (file: File | null) => void) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null
      const validationError = file ? validateAudioFile(file) : null
      setFileErrors((prev) => ({ ...prev, [field]: validationError ?? undefined }))
      setter(validationError ? null : file)
    }
  }

  function artworkFileHandler(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    const validationError = file ? validateImageFile(file) : null
    setFileErrors((prev) => ({ ...prev, artwork: validationError ?? undefined }))
    setArtworkFile(validationError ? null : file)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!firebaseUser) return
    if (!previewFile || !originalFile) {
      setError('A preview clip and the full-quality original are both required.')
      return
    }
    if (!rightsConfirmed) {
      setError('You must confirm you own or control the rights to this content.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const trackId = newTrackId()
      const assets = await uploadTrackAssets(firebaseUser.uid, trackId, {
        preview: previewFile,
        original: originalFile,
        artwork: artworkFile,
      })
      await createTrack(firebaseUser.uid, trackId, assets, {
        title,
        genre,
        subgenre: subgenre || null,
        bpm: bpm ? Number(bpm) : null,
        mood: mood || null,
        description,
        explicit,
        albumId: null,
        credits: {
          songwriters: splitList(songwriters),
          producers: splitList(producers),
          featuredArtists: splitList(featuredArtists),
        },
        visibility,
        previewStartSec,
        previewDurationSec,
        djPromotion,
        djLicenceMode,
        djFixedPrice: djLicenceMode === 'fixed_price' && djFixedPrice ? Math.round(Number(djFixedPrice) * 100) : null,
      })
      navigate('/dashboard/artist/music')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-ink-0">Upload a track</h1>
      <p className="mt-1 text-sm text-ink-2">
        The original file stays private — only your configured preview is ever public.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
        <Field label="Track title">
          <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Genre">
            <Input required value={genre} onChange={(e) => setGenre(e.target.value)} />
          </Field>
          <Field label="Subgenre">
            <Input value={subgenre} onChange={(e) => setSubgenre(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="BPM">
            <Input type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} />
          </Field>
          <Field label="Mood">
            <Input value={mood} onChange={(e) => setMood(e.target.value)} />
          </Field>
        </div>

        <Field label="Description">
          <TextArea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Songwriters (comma separated)">
            <Input value={songwriters} onChange={(e) => setSongwriters(e.target.value)} />
          </Field>
          <Field label="Producers (comma separated)">
            <Input value={producers} onChange={(e) => setProducers(e.target.value)} />
          </Field>
          <Field label="Featured artists (comma separated)">
            <Input value={featuredArtists} onChange={(e) => setFeaturedArtists(e.target.value)} />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-1">
          <input type="checkbox" checked={explicit} onChange={(e) => setExplicit(e.target.checked)} className="h-4 w-4 accent-brand-500" />
          Contains explicit content
        </label>

        <div className="rounded-xl border border-surface-border bg-surface-1 p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-0">Audio files</h2>
          <p className="mb-3 text-xs text-ink-2">
            MP3, AAC/M4A, or OGG only, up to {MAX_AUDIO_MB}MB each — export uncompressed masters
            (WAV/FLAC/AIFF) as MP3 320kbps first.
          </p>
          <div className="flex flex-col gap-4">
            <Field label="Preview clip (public)">
              <input
                type="file"
                accept="audio/mpeg,audio/mp4,audio/aac,audio/x-m4a,audio/ogg,audio/opus,audio/webm,.mp3,.m4a,.aac,.ogg,.opus"
                required
                onChange={audioFileHandler('preview', setPreviewFile)}
                className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-3 file:px-3 file:py-2 file:text-ink-0"
              />
              {previewFile && !fileErrors.preview ? (
                <p className="mt-1 text-xs text-ink-3">{formatFileSize(previewFile.size)}</p>
              ) : null}
              {fileErrors.preview ? <p className="mt-1 text-xs text-danger-500">{fileErrors.preview}</p> : null}
            </Field>
            <Field label="Full-quality original (never public)">
              <input
                type="file"
                accept="audio/mpeg,audio/mp4,audio/aac,audio/x-m4a,audio/ogg,audio/opus,audio/webm,.mp3,.m4a,.aac,.ogg,.opus"
                required
                onChange={audioFileHandler('original', setOriginalFile)}
                className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-3 file:px-3 file:py-2 file:text-ink-0"
              />
              {originalFile && !fileErrors.original ? (
                <p className="mt-1 text-xs text-ink-3">{formatFileSize(originalFile.size)}</p>
              ) : null}
              {fileErrors.original ? <p className="mt-1 text-xs text-danger-500">{fileErrors.original}</p> : null}
            </Field>
            <Field label="Cover artwork">
              <input
                type="file"
                accept="image/*"
                onChange={artworkFileHandler}
                className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-3 file:px-3 file:py-2 file:text-ink-0"
              />
              <p className="mt-1 text-xs text-ink-3">Up to {MAX_IMAGE_MB}MB.</p>
              {fileErrors.artwork ? <p className="mt-1 text-xs text-danger-500">{fileErrors.artwork}</p> : null}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Preview start (seconds)">
                <Input type="number" min={0} value={previewStartSec} onChange={(e) => setPreviewStartSec(Number(e.target.value))} />
              </Field>
              <Field label="Preview duration (seconds)">
                <Input type="number" min={5} max={90} value={previewDurationSec} onChange={(e) => setPreviewDurationSec(Number(e.target.value))} />
              </Field>
            </div>
          </div>
        </div>

        <Field label="Who can stream this track?">
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as TrackVisibility)}
            className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink-0 outline-none focus:border-brand-500"
          >
            {VISIBILITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="rounded-xl border border-dj-500/30 bg-dj-500/5 p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-0">DJ access</h2>
          <label className="mb-3 flex items-center gap-2 text-sm text-ink-1">
            <input
              type="checkbox"
              checked={djPromotion}
              onChange={(e) => setDjPromotion(e.target.checked)}
              className="h-4 w-4 accent-brand-500"
            />
            Available for DJ promotion — list this track in the DJ discovery feed
          </label>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Licence terms">
              <select
                value={djLicenceMode}
                onChange={(e) => setDjLicenceMode(e.target.value as LicenceMode)}
                className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink-0 outline-none focus:border-brand-500"
              >
                {LICENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
            {djLicenceMode === 'fixed_price' ? (
              <Field label="Price (GBP)">
                <Input type="number" min={0} step="0.01" value={djFixedPrice} onChange={(e) => setDjFixedPrice(e.target.value)} />
              </Field>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-ink-2">
            DJ requests, negotiation, digital agreements, and paid licence downloads unlock in a
            later phase — this only controls discoverability for now.
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm text-ink-1">
          <input
            type="checkbox"
            checked={rightsConfirmed}
            onChange={(e) => setRightsConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-500"
          />
          I confirm that I own or control the rights necessary to upload and distribute this
          content.
        </label>

        {error ? <p className="text-sm text-danger-500">{error}</p> : null}

        <Button type="submit" loading={submitting} className="w-fit">
          Publish track
        </Button>
      </form>
    </div>
  )
}

function splitList(value: string): string[] {
  return value.split(',').map((v) => v.trim()).filter(Boolean)
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  )
}
