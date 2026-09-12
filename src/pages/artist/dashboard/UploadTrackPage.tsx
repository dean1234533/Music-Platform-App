import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { createTrack, newTrackId, uploadTrackArtworkAsset } from '@/services/trackService'
import { getArtistProfile, subscribeArtistProfile } from '@/services/artistService'
import { getPlatformSettings } from '@/services/platformSettingsService'
import { compressImage } from '@/services/imageProcessing'
import { recordRightsDeclaration } from '@/services/legalService'
import { subscribeToOwnSubscription, subscribeToPlan } from '@/services/subscriptionService'
import { extractYoutubeVideoId, youtubeThumbnailUrl } from '@/utils/youtube'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'
import { validateImageFile, MAX_IMAGE_MB } from '@/utils/uploadLimits'
import { ACCESS_SUMMARY, VISIBILITY_OPTIONS } from '@/utils/trackAccess'
import type { LicenceMode, TrackRightsMetadata, TrackVisibility } from '@/types/track'
import type { SubscriptionDoc } from '@/types/subscription'
import { CAMELOT_KEYS, GENRES, MOODS } from '@/constants/musicTaxonomy'
import { MAX_STORED_TRACKS_PER_ARTIST } from '@/constants/platformLimits'

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
  'I confirm that I have the necessary rights and permissions to promote this link through BackTheVibes, and that I am not knowingly submitting content I do not have permission to share.'
const RIGHTS_CONSEQUENCES_TEXT =
  'I understand BackTheVibes does not verify copyright ownership or provide legal advice, and that sharing content without the necessary rights may result in removal, account restriction, or further action under the platform Terms.'

export function UploadTrackPage() {
  const { firebaseUser } = useAuth()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState<string>(GENRES[0])
  const [subgenre, setSubgenre] = useState('')
  const [bpm, setBpm] = useState('')
  const [mood, setMood] = useState('')
  const [trackKey, setTrackKey] = useState('')
  const [artistLocation, setArtistLocation] = useState<string | null>(null)
  const [storedTrackCount, setStoredTrackCount] = useState<number | null>(null)
  const [description, setDescription] = useState('')
  const [explicit, setExplicit] = useState(false)
  const [songwriters, setSongwriters] = useState('')
  const [producers, setProducers] = useState('')
  const [featuredArtists, setFeaturedArtists] = useState('')
  const [visibility, setVisibility] = useState<TrackVisibility>('followers')
  const [djPromotion, setDjPromotion] = useState(false)
  const [djLicenceMode, setDjLicenceMode] = useState<LicenceMode>('not_available')
  const [djFixedPrice, setDjFixedPrice] = useState('')
  const [embargoDate, setEmbargoDate] = useState('')
  const [followerReleaseDate, setFollowerReleaseDate] = useState('')
  const [publicReleaseDate, setPublicReleaseDate] = useState('')

  // Platform-configurable default visibility (admin-set, not hard-coded) —
  // only applied once, before the artist has had a chance to touch it.
  useEffect(() => {
    void getPlatformSettings().then((settings) => {
      if (settings?.defaultTrackVisibility) setVisibility(settings.defaultTrackVisibility)
    })
  }, [])

  useEffect(() => {
    if (!firebaseUser) return
    // A live subscription, not a one-shot fetch — this badge previously only ever fetched once
    // on mount, so it kept showing the pre-upload count until the page was fully remounted
    // (user-reported: "i have uploaded a track but the allowance still says 0 of 10").
    return subscribeArtistProfile(firebaseUser.uid, (profile) => {
      setArtistLocation(profile?.location ?? null)
      setStoredTrackCount(profile?.trackCount ?? 0)
    })
  }, [firebaseUser])

  const [membership, setMembership] = useState<SubscriptionDoc | null | undefined>(undefined)
  const [membershipCheckoutLoading, setMembershipCheckoutLoading] = useState(false)
  const [membershipError, setMembershipError] = useState<string | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeToOwnSubscription(firebaseUser.uid, setMembership, undefined, 'artist')
  }, [firebaseUser])

  const hasActiveMembership = membership?.status === 'active' || membership?.status === 'trialing'

  async function handleSubscribeToMembership() {
    setMembershipCheckoutLoading(true)
    setMembershipError(null)
    try {
      await subscribeToPlan('artist_membership', 'artist', '/dashboard/artist/upload')
    } catch (err) {
      setMembershipError(err instanceof Error ? err.message : 'Could not start checkout. Please try again.')
      setMembershipCheckoutLoading(false)
    }
  }

  const [youtubeInput, setYoutubeInput] = useState('')
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null)
  const [youtubeError, setYoutubeError] = useState<string | null>(null)
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [artworkError, setArtworkError] = useState<string | null>(null)

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

  function handleYoutubeInputChange(value: string) {
    setYoutubeInput(value)
    if (!value.trim()) {
      setYoutubeVideoId(null)
      setYoutubeError(null)
      return
    }
    const videoId = extractYoutubeVideoId(value)
    if (!videoId) {
      setYoutubeVideoId(null)
      setYoutubeError('This does not look like a supported YouTube link (youtube.com/watch, youtu.be, or youtube.com/shorts).')
      return
    }
    setYoutubeVideoId(videoId)
    setYoutubeError(null)
  }

  function artworkFileHandler(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    const validationError = file ? validateImageFile(file) : null
    setArtworkError(validationError ?? null)
    setArtworkFile(validationError ? null : file)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!firebaseUser) return
    if (!hasActiveMembership) {
      setError('An active Artist Membership is required to publish tracks.')
      return
    }
    const artistProfile = await getArtistProfile(firebaseUser.uid)
    const currentTrackCount = artistProfile?.trackCount
    if (currentTrackCount === undefined) {
      setError('We could not verify your track allowance. Please refresh and try again.')
      return
    }
    setStoredTrackCount(currentTrackCount)
    if (currentTrackCount >= MAX_STORED_TRACKS_PER_ARTIST) {
      setError(`Your account can list up to ${MAX_STORED_TRACKS_PER_ARTIST} tracks. Remove an existing track before adding another.`)
      return
    }
    if (!youtubeVideoId) {
      setError('A valid YouTube link is required.')
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
    try {
      const trackId = newTrackId()

      let processedArtwork = artworkFile
      if (artworkFile) {
        const compressed = await compressImage(artworkFile, 'artwork')
        processedArtwork = compressed.file
      }
      const artworkURL = await uploadTrackArtworkAsset(firebaseUser.uid, trackId, processedArtwork)

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

      await createTrack(firebaseUser.uid, trackId, artworkURL, {
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
        youtubeVideoId,
        djPromotion,
        djLicenceMode,
        djFixedPrice: djLicenceMode === 'fixed_price' && djFixedPrice ? Math.round(Number(djFixedPrice) * 100) : null,
        djPromoTier: 'all',
        embargoUntil: embargoDate ? new Date(embargoDate) : null,
        followerReleaseAt: visibility === 'early_access' && followerReleaseDate ? new Date(followerReleaseDate) : null,
        publicReleaseAt: visibility === 'early_access' && publicReleaseDate ? new Date(publicReleaseDate) : null,
        rightsMetadata,
      })
      navigate('/dashboard/artist/music')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this track. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-ink-0">Add a track</h1>
      <p className="mt-1 text-sm text-ink-2">
        Add a link to your official YouTube upload — BackTheVibes plays it through YouTube's own
        player. We never host, download, or extract audio.
      </p>

      {membership !== undefined && !hasActiveMembership ? (
        <div className="mt-5 rounded-xl border border-warning-500/25 bg-warning-500/[0.06] px-4 py-4 text-sm leading-6 text-ink-1">
          <p className="font-medium text-ink-0">Artist Membership required to publish</p>
          <p className="mt-1 text-ink-2">
            Your dashboard stays open, but publishing a track needs an active Artist Membership — 14 days free, then £29.99/year.
          </p>
          {membershipError ? <p className="mt-2 text-danger-500">{membershipError}</p> : null}
          <Button className="mt-3" size="sm" loading={membershipCheckoutLoading} onClick={handleSubscribeToMembership}>
            Start 14-day free trial
          </Button>
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between rounded-xl border border-surface-border bg-surface-1 px-4 py-3 text-sm">
        <span className="text-ink-1">Stored track allowance</span>
        <span className="font-semibold text-ink-0">
          {storedTrackCount === null ? 'Checking…' : `${storedTrackCount} of ${MAX_STORED_TRACKS_PER_ARTIST}`}
        </span>
      </div>
      {storedTrackCount !== null && storedTrackCount >= MAX_STORED_TRACKS_PER_ARTIST ? (
        <p className="mt-2 text-sm text-ink-2">Remove an existing track from Music before adding another.</p>
      ) : null}

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
              className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-base sm:text-sm text-ink-0 outline-none focus:border-brand-500"
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
              className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-base sm:text-sm text-ink-0 outline-none focus:border-brand-500"
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
              className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-base sm:text-sm text-ink-0 outline-none focus:border-brand-500"
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
          <h2 className="mb-3 text-sm font-semibold text-ink-0">YouTube link</h2>
          <p className="mb-3 text-xs text-ink-2">
            Paste the link to your official YouTube upload of this track. Playback uses the
            official YouTube player — we never download, extract, proxy, or cache the audio/video.
          </p>
          <Field label="YouTube URL">
            <Input
              required
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeInput}
              onChange={(e) => handleYoutubeInputChange(e.target.value)}
            />
            {youtubeError ? <p className="mt-1 text-xs text-danger-500">{youtubeError}</p> : null}
          </Field>
          {youtubeVideoId ? (
            <div className="mt-3 flex items-center gap-3">
              <img src={youtubeThumbnailUrl(youtubeVideoId)} alt="" className="h-14 w-24 rounded-md object-cover" />
              <p className="text-xs text-ink-2">Link recognised — video ID <span className="font-mono text-ink-1">{youtubeVideoId}</span></p>
            </div>
          ) : null}
          <Field label="Cover artwork">
            <input
              type="file"
              accept="image/*"
              onChange={artworkFileHandler}
              className="mt-1 block w-full text-sm text-ink-2 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-3 file:px-3 file:py-2 file:text-ink-0"
            />
            <p className="mt-1 text-xs text-ink-3">Up to {MAX_IMAGE_MB}MB — resized and compressed automatically.</p>
            {artworkError ? <p className="mt-1 text-xs text-danger-500">{artworkError}</p> : null}
          </Field>
        </div>

        <Field label="Who can see this track's YouTube link?">
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as TrackVisibility)}
            className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-base sm:text-sm text-ink-0 outline-none focus:border-brand-500"
          >
            {VISIBILITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg border border-surface-border bg-surface-2 p-3 text-xs text-ink-2">
            {(() => {
              const summary = ACCESS_SUMMARY[visibility] ?? ACCESS_SUMMARY.public
              return (
                <>
                  <div><p className="font-semibold text-ink-1">Public</p><p className="mt-0.5">{summary.public}</p></div>
                  <div><p className="font-semibold text-ink-1">Followers</p><p className="mt-0.5">{summary.followers}</p></div>
                  <div><p className="font-semibold text-ink-1">Supporters</p><p className="mt-0.5">{summary.supporters}</p></div>
                </>
              )
            })()}
          </div>
        </Field>

        {visibility === 'early_access' ? (
          <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink-0">Early access schedule</h2>
            <p className="mb-3 text-xs text-ink-2">Supporters always get the link immediately. Set when followers (and, optionally, everyone) get it too.</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Followers get access on">
                <Input type="date" value={followerReleaseDate} onChange={(e) => setFollowerReleaseDate(e.target.value)} />
              </Field>
              <Field label="Public gets access on (optional)">
                <Input type="date" value={publicReleaseDate} onChange={(e) => setPublicReleaseDate(e.target.value)} />
              </Field>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-dj-500/30 bg-dj-500/5 p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-0">DJ / business collaboration</h2>
          <label className="mb-3 flex items-center gap-2 text-sm text-ink-1">
            <input
              type="checkbox"
              checked={djPromotion}
              onChange={(e) => setDjPromotion(e.target.checked)}
              className="h-4 w-4 accent-brand-500"
            />
            Open to DJ/business collaboration proposals — list this track in DJ discovery
          </label>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Terms">
              <select
                value={djLicenceMode}
                onChange={(e) => setDjLicenceMode(e.target.value as LicenceMode)}
                className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-base sm:text-sm text-ink-0 outline-none focus:border-brand-500"
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
            A DJ/business can propose a collaboration, negotiate terms, and sign an agreement.
            Master audio/stems are exchanged directly between the parties outside BackTheVibes —
            an agreement never transfers copyright and is not legal advice.
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
                className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-base sm:text-sm text-ink-0 outline-none focus:border-brand-500"
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
                className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-base sm:text-sm text-ink-0 outline-none focus:border-brand-500"
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

        {error ? <p className="text-sm text-danger-500">{error}</p> : null}

        <Button type="submit" loading={submitting} disabled={storedTrackCount === null || storedTrackCount >= MAX_STORED_TRACKS_PER_ARTIST || !hasActiveMembership} className="w-fit">
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
