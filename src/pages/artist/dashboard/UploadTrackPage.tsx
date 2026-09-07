import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { createTrack, newTrackId, uploadTrackAssets } from '@/services/trackService'
import { getArtistProfile } from '@/services/artistService'
import { deriveAudioAssets } from '@/services/audioProcessing'
import { compressImage } from '@/services/imageProcessing'
import { recordRightsDeclaration } from '@/services/legalService'
import { useMediaUpload } from '@/hooks/useMediaUpload'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'
import { UploadProgress } from '@/components/common/UploadProgress'
import { formatFileSize, MAX_AUDIO_MB, MAX_IMAGE_MB, validateAudioFile, validateImageFile } from '@/utils/uploadLimits'
import { PREVIEW_MAX_DURATION_SEC, PREVIEW_MIN_DURATION_SEC, SUGGESTED_PREVIEW_DURATIONS_SEC } from '@/constants/mediaConfig'
import type { LicenceMode, TrackRightsMetadata, TrackVisibility } from '@/types/track'
import { CAMELOT_KEYS, GENRES, MOODS } from '@/constants/musicTaxonomy'

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

const OWNERSHIP_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'shared', label: 'Shared ownership' },
  { value: 'licensed', label: 'Licensed to me' },
] as const

const COMPOSITION_OWNERSHIP_OPTIONS = [...OWNERSHIP_OPTIONS, { value: 'not_sure', label: 'Not sure' }] as const

const RIGHTS_DECLARATION_TEXT =
  'I confirm that I own, control, or have obtained the necessary rights and permissions to upload, distribute, stream, preview, and offer this recording through this platform.'
const RIGHTS_CONSEQUENCES_TEXT =
  "I understand that uploading music without the necessary rights may result in content removal, account restriction, withheld payouts where legally appropriate, and further action under the platform Terms."

export function UploadTrackPage() {
  const { firebaseUser } = useAuth()
  const navigate = useNavigate()
  const mediaUpload = useMediaUpload()

  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState<string>(GENRES[0])
  const [subgenre, setSubgenre] = useState('')
  const [bpm, setBpm] = useState('')
  const [mood, setMood] = useState('')
  const [trackKey, setTrackKey] = useState('')
  const [artistLocation, setArtistLocation] = useState<string | null>(null)
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
  const [embargoDate, setEmbargoDate] = useState('')

  useEffect(() => {
    if (!firebaseUser) return
    getArtistProfile(firebaseUser.uid).then((profile) => setArtistLocation(profile?.location ?? null))
  }, [firebaseUser])

  const [masterFile, setMasterFile] = useState<File | null>(null)
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [fileErrors, setFileErrors] = useState<{ master?: string; artwork?: string }>({})

  // Rights & Ownership.
  const [ownsMaster, setOwnsMaster] = useState<TrackRightsMetadata['ownsMasterRecording']>('yes')
  const [ownsComposition, setOwnsComposition] = useState<TrackRightsMetadata['ownsComposition']>('yes')
  const [containsSamples, setContainsSamples] = useState(false)
  const [isCoverOrInterpolation, setIsCoverOrInterpolation] = useState(false)
  const [hasLabelInvolvement, setHasLabelInvolvement] = useState(false)
  const [hasPublisherInvolvement, setHasPublisherInvolvement] = useState(false)
  const [hasOtherRightsHolders, setHasOtherRightsHolders] = useState(false)
  const [masterOwner, setMasterOwner] = useState('')
  const [publisher, setPublisher] = useState('')
  const [label, setLabel] = useState('')
  const [pro, setPro] = useState('')
  const [isrc, setIsrc] = useState('')
  const [iswc, setIswc] = useState('')
  const [copyrightNotice, setCopyrightNotice] = useState('')

  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [understandsConsequences, setUnderstandsConsequences] = useState(false)
  const [sampleClearanceConfirmed, setSampleClearanceConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function masterFileHandler(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    const validationError = file ? validateAudioFile(file) : null
    setFileErrors((prev) => ({ ...prev, master: validationError ?? undefined }))
    setMasterFile(validationError ? null : file)
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
    if (!masterFile) {
      setError('A master audio file is required.')
      return
    }
    if (!rightsConfirmed || !understandsConsequences) {
      setError('You must confirm both rights declaration statements.')
      return
    }
    if (containsSamples && !sampleClearanceConfirmed) {
      setError('You must confirm you have the necessary permission/licence for any samples used.')
      return
    }

    setSubmitting(true)
    setError(null)
    mediaUpload.reset()
    try {
      const trackId = newTrackId()

      mediaUpload.setProcessing(0)
      const audio = await deriveAudioAssets(masterFile, {
        previewStartSec,
        previewDurationSec,
        onProgress: (_stage, ratio) => mediaUpload.setProcessing(Math.round(ratio * 100)),
      })

      let processedArtwork = artworkFile
      if (artworkFile) {
        const compressed = await compressImage(artworkFile, 'artwork')
        processedArtwork = compressed.file
      }

      mediaUpload.setProcessed(masterFile.size, audio.streaming.sizeBytes, audio.degraded)

      const assets = await uploadTrackAssets(
        firebaseUser.uid,
        trackId,
        { master: masterFile, streaming: audio.streaming.file, preview: audio.preview.file, artwork: processedArtwork },
        (percent) => mediaUpload.setUploadProgress(percent),
      )

      await recordRightsDeclaration({ trackId, agreed: true })

      const rightsMetadata: TrackRightsMetadata = {
        ownsMasterRecording: ownsMaster,
        ownsComposition,
        containsSamples,
        hasFeaturedArtists: featuredArtists.trim().length > 0,
        hasProducers: producers.trim().length > 0,
        hasSongwriters: songwriters.trim().length > 0,
        isCoverOrInterpolation,
        hasLabelInvolvement,
        hasPublisherInvolvement,
        hasOtherRightsHolders,
        masterOwner: masterOwner || null,
        publisher: publisher || null,
        label: label || null,
        pro: pro || null,
        isrc: isrc || null,
        iswc: iswc || null,
        copyrightNotice: copyrightNotice || null,
      }

      await createTrack(firebaseUser.uid, trackId, assets, {
        title,
        genre,
        subgenre: subgenre || null,
        bpm: bpm ? Number(bpm) : null,
        mood: mood || null,
        key: trackKey || null,
        location: artistLocation,
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
        djPromoTier: 'all',
        embargoUntil: embargoDate ? new Date(embargoDate) : null,
        rightsMetadata,
      })
      mediaUpload.setDone()
      navigate('/dashboard/artist/music')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
      mediaUpload.setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-ink-0">Upload a track</h1>
      <p className="mt-1 text-sm text-ink-2">
        Upload one master file — we'll automatically create an optimised streaming version and a
        preview clip. The master stays private.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
        <fieldset disabled={submitting} className="contents">
        <Field label="Track title">
          <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Genre">
            <select
              required
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink-0 outline-none focus:border-brand-500"
            >
              {GENRES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </Field>
          <Field label="Subgenre">
            <Input value={subgenre} onChange={(e) => setSubgenre(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="BPM">
            <Input type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} />
          </Field>
          <Field label="Key">
            <select
              value={trackKey}
              onChange={(e) => setTrackKey(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink-0 outline-none focus:border-brand-500"
            >
              <option value="">Not set</option>
              {CAMELOT_KEYS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </Field>
          <Field label="Mood">
            <select
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink-0 outline-none focus:border-brand-500"
            >
              <option value="">Not set</option>
              {MOODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
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
          <h2 className="mb-3 text-sm font-semibold text-ink-0">Audio</h2>
          <p className="mb-3 text-xs text-ink-2">
            MP3, AAC/M4A, or OGG only, up to {MAX_AUDIO_MB}MB — export uncompressed masters
            (WAV/FLAC/AIFF) as MP3 320kbps first. We'll derive a compressed streaming version and a
            preview clip from this file automatically.
          </p>
          <div className="flex flex-col gap-4">
            <Field label="Master audio (never public)">
              <input
                type="file"
                accept="audio/mpeg,audio/mp4,audio/aac,audio/x-m4a,audio/ogg,audio/opus,audio/webm,.mp3,.m4a,.aac,.ogg,.opus"
                required
                onChange={masterFileHandler}
                className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-3 file:px-3 file:py-2 file:text-ink-0"
              />
              {masterFile && !fileErrors.master ? (
                <p className="mt-1 text-xs text-ink-3">{formatFileSize(masterFile.size)}</p>
              ) : null}
              {fileErrors.master ? <p className="mt-1 text-xs text-danger-500">{fileErrors.master}</p> : null}
            </Field>
            <Field label="Cover artwork">
              <input
                type="file"
                accept="image/*"
                onChange={artworkFileHandler}
                className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-3 file:px-3 file:py-2 file:text-ink-0"
              />
              <p className="mt-1 text-xs text-ink-3">Up to {MAX_IMAGE_MB}MB — resized and compressed automatically.</p>
              {fileErrors.artwork ? <p className="mt-1 text-xs text-danger-500">{fileErrors.artwork}</p> : null}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Preview start (seconds)">
                <Input type="number" min={0} value={previewStartSec} onChange={(e) => setPreviewStartSec(Number(e.target.value))} />
              </Field>
              <Field label="Preview duration (seconds)">
                <Input
                  type="number"
                  min={PREVIEW_MIN_DURATION_SEC}
                  max={PREVIEW_MAX_DURATION_SEC}
                  value={previewDurationSec}
                  onChange={(e) => setPreviewDurationSec(Number(e.target.value))}
                />
              </Field>
            </div>
            <div className="flex gap-2">
              {SUGGESTED_PREVIEW_DURATIONS_SEC.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setPreviewDurationSec(sec)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    previewDurationSec === sec
                      ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                      : 'border-surface-border text-ink-2 hover:text-ink-0'
                  }`}
                >
                  {sec}s
                </button>
              ))}
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
          <div className="mt-4 border-t border-dj-500/20 pt-4">
            <Field label="Embargo until (optional)">
              <Input type="date" value={embargoDate} onChange={(e) => setEmbargoDate(e.target.value)} />
            </Field>
          </div>
          <p className="mt-3 text-xs text-ink-2">
            DJs can request access, discuss terms, sign an agreement, pay any licence fee, and download approved tracks.
            Access to a downloaded file never transfers copyright ownership.
          </p>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-1 p-4">
          <h2 className="mb-1 text-sm font-semibold text-ink-0">Rights & ownership</h2>
          <p className="mb-4 text-xs text-ink-2">
            This is context, not proof of ownership. It helps us and rights holders understand your
            release if a question ever comes up.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Do you own the master recording?">
              <select
                value={ownsMaster}
                onChange={(e) => setOwnsMaster(e.target.value as TrackRightsMetadata['ownsMasterRecording'])}
                className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink-0 outline-none focus:border-brand-500"
              >
                {OWNERSHIP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Do you own/control the composition?">
              <select
                value={ownsComposition}
                onChange={(e) => setOwnsComposition(e.target.value as TrackRightsMetadata['ownsComposition'])}
                className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink-0 outline-none focus:border-brand-500"
              >
                {COMPOSITION_OWNERSHIP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <p className="mb-2 mt-4 text-xs font-medium text-ink-1">Does this recording contain any of the following?</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <RightsCheckbox label="Samples" checked={containsSamples} onChange={setContainsSamples} />
            <RightsCheckbox label="Cover / interpolation" checked={isCoverOrInterpolation} onChange={setIsCoverOrInterpolation} />
            <RightsCheckbox label="Label involvement" checked={hasLabelInvolvement} onChange={setHasLabelInvolvement} />
            <RightsCheckbox label="Publisher involvement" checked={hasPublisherInvolvement} onChange={setHasPublisherInvolvement} />
            <RightsCheckbox label="Other rights holders" checked={hasOtherRightsHolders} onChange={setHasOtherRightsHolders} />
          </div>

          {containsSamples ? (
            <label className="mt-3 flex items-start gap-2 rounded-lg border border-warning-500/30 bg-warning-500/5 p-3 text-xs text-ink-1">
              <input
                type="checkbox"
                checked={sampleClearanceConfirmed}
                onChange={(e) => setSampleClearanceConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand-500"
              />
              I confirm I have obtained the necessary permission/licence for any samples used in this
              recording. We don't automatically tell you whether a particular use is legally
              permitted — that's on you to clear.
            </label>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Master owner"><Input value={masterOwner} onChange={(e) => setMasterOwner(e.target.value)} /></Field>
            <Field label="Publisher"><Input value={publisher} onChange={(e) => setPublisher(e.target.value)} /></Field>
            <Field label="Label"><Input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
            <Field label="PRO"><Input value={pro} onChange={(e) => setPro(e.target.value)} /></Field>
            <Field label="ISRC"><Input value={isrc} onChange={(e) => setIsrc(e.target.value)} /></Field>
            <Field label="ISWC"><Input value={iswc} onChange={(e) => setIswc(e.target.value)} /></Field>
          </div>
          <Field label="Copyright notice">
            <Input value={copyrightNotice} onChange={(e) => setCopyrightNotice(e.target.value)} placeholder="© 2026 Artist Name" />
          </Field>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-1 p-4">
          <label className="flex items-start gap-2 text-sm text-ink-1">
            <input
              type="checkbox"
              checked={rightsConfirmed}
              onChange={(e) => setRightsConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand-500"
            />
            {RIGHTS_DECLARATION_TEXT}
          </label>
          <label className="flex items-start gap-2 text-sm text-ink-1">
            <input
              type="checkbox"
              checked={understandsConsequences}
              onChange={(e) => setUnderstandsConsequences(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand-500"
            />
            {RIGHTS_CONSEQUENCES_TEXT}
          </label>
        </div>

        {mediaUpload.state.stage !== 'idle' ? <UploadProgress state={mediaUpload.state} /> : null}
        {error ? <p className="text-sm text-danger-500">{error}</p> : null}

        <Button type="submit" loading={submitting} className="w-fit">
          Publish track
        </Button>
        </fieldset>
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

function RightsCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-ink-1">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-brand-500" />
      {label}
    </label>
  )
}
