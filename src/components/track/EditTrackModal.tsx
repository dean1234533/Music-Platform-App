import { useState, type ChangeEvent, type ReactNode } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'
import { useToast } from '@/contexts/ToastContext'
import { compressImage } from '@/services/imageProcessing'
import { updateTrackDetails, uploadTrackArtwork } from '@/services/trackService'
import { validateImageFile, MAX_IMAGE_MB } from '@/utils/uploadLimits'
import { CAMELOT_KEYS, GENRES, MOODS } from '@/constants/musicTaxonomy'
import type { TrackDoc } from '@/types/track'

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

export function EditTrackModal({ track, onClose }: { track: TrackDoc; onClose: () => void }) {
  const { notify } = useToast()
  const [title, setTitle] = useState(track.title)
  const [genre, setGenre] = useState(track.genre)
  const [subgenre, setSubgenre] = useState(track.subgenre ?? '')
  const [bpm, setBpm] = useState(track.bpm != null ? String(track.bpm) : '')
  const [mood, setMood] = useState(track.mood ?? '')
  const [trackKey, setTrackKey] = useState(track.key ?? '')
  const [description, setDescription] = useState(track.description)
  const [explicit, setExplicit] = useState(track.explicit)
  const [songwriters, setSongwriters] = useState(track.credits.songwriters.join(', '))
  const [producers, setProducers] = useState(track.credits.producers.join(', '))
  const [featuredArtists, setFeaturedArtists] = useState(track.credits.featuredArtists.join(', '))
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [artworkError, setArtworkError] = useState<string | null>(null)
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleArtworkChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (!file) {
      setArtworkFile(null)
      setArtworkPreview(null)
      return
    }
    const validationError = validateImageFile(file)
    setArtworkError(validationError ?? null)
    if (validationError) {
      setArtworkFile(null)
      setArtworkPreview(null)
      return
    }
    setArtworkFile(file)
    setArtworkPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      let artworkURL: string | undefined
      if (artworkFile) {
        const compressed = await compressImage(artworkFile, 'artwork')
        artworkURL = await uploadTrackArtwork(track.artistId, track.trackId, compressed.file)
      }
      await updateTrackDetails(
        track.trackId,
        {
          title: title.trim(),
          genre,
          subgenre: subgenre.trim() || null,
          bpm: bpm ? Number(bpm) : null,
          mood: mood || null,
          key: trackKey || null,
          description: description.trim(),
          explicit,
          credits: {
            songwriters: splitList(songwriters),
            producers: splitList(producers),
            featuredArtists: splitList(featuredArtists),
          },
        },
        artworkURL,
      )
      notify('Track details saved.')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save these changes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Edit "${track.title}"`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Genre">
            <select
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
            <Input value={subgenre} onChange={(e) => setSubgenre(e.target.value)} placeholder="Optional" />
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="BPM">
            <Input type="number" min={0} value={bpm} onChange={(e) => setBpm(e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Key (Camelot)">
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

        <Field label="Cover artwork">
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-2">
              {(artworkPreview ?? track.artworkURL) ? (
                <img src={artworkPreview ?? track.artworkURL ?? ''} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleArtworkChange}
              className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-3 file:px-3 file:py-2 file:text-ink-0"
            />
          </div>
          <p className="mt-1 text-xs text-ink-3">Up to {MAX_IMAGE_MB}MB — resized and compressed automatically. Leave blank to keep the current artwork.</p>
          {artworkError ? <p className="mt-1 text-xs text-danger-500">{artworkError}</p> : null}
        </Field>

        {error ? <p className="text-sm text-danger-500">{error}</p> : null}
        <Button onClick={handleSave} loading={saving} className="w-fit">
          Save changes
        </Button>
      </div>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  )
}
