import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Clock, FileSignature, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  respondToLicenceRequest,
  subscribeAgreement,
  subscribeLicenceRequest,
  subscribeOffersForRequest,
} from '@/services/licenceService'
import { getUserProfile } from '@/services/userService'
import { getTrack } from '@/services/trackService'
import { getDealsByIds } from '@/services/dealService'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateViews'
import { Button } from '@/components/common/Button'
import { OfferCard } from '@/components/licence/OfferCard'
import { OfferFormModal } from '@/components/licence/OfferFormModal'
import { formatCurrency } from '@/utils/format'
import type { LicenceAgreementDoc, LicenceOfferDoc, LicenceRequestDoc } from '@/types/licence'
import type { TrackDoc } from '@/types/track'
import type { DjDealDoc } from '@/types/deal'

/**
 * /dj-requests/{requestId} — the replacement for the removed chat thread.
 * Everything here is read from real backend events (the request doc, the
 * append-only offer history, and the resulting agreement) — nothing here is
 * user-editable free text, and nothing is ever inferred or fabricated on the
 * client. This is the single place either party can see: what was
 * requested, every offer/counter in order, who changed what, the current
 * status, and exactly whose turn it is next.
 */
export function RequestTimelinePage() {
  const { requestId } = useParams<{ requestId: string }>()
  const navigate = useNavigate()
  const { firebaseUser } = useAuth()
  const [licenceRequest, setLicenceRequest] = useState<LicenceRequestDoc | null | undefined>(undefined)
  const [offers, setOffers] = useState<LicenceOfferDoc[]>([])
  const [agreement, setAgreement] = useState<LicenceAgreementDoc | null>(null)
  const [track, setTrack] = useState<TrackDoc | null>(null)
  const [djName, setDjName] = useState<string>('DJ')
  const [sourceDeal, setSourceDeal] = useState<DjDealDoc | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [counterTarget, setCounterTarget] = useState<LicenceOfferDoc | null>(null)
  const [showSendOffer, setShowSendOffer] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const artist = useArtistSummary(licenceRequest?.artistId ?? null)

  useEffect(() => {
    if (!requestId) return
    return subscribeLicenceRequest(requestId, setLicenceRequest, () => setLoadError(true))
  }, [requestId])

  useEffect(() => {
    if (!requestId) return
    return subscribeOffersForRequest(requestId, setOffers)
  }, [requestId])

  useEffect(() => {
    if (!licenceRequest?.currentAgreementId) {
      setAgreement(null)
      return
    }
    return subscribeAgreement(licenceRequest.currentAgreementId, setAgreement)
  }, [licenceRequest?.currentAgreementId])

  useEffect(() => {
    if (!licenceRequest) return
    void getTrack(licenceRequest.trackId).then(setTrack)
    void getUserProfile(licenceRequest.djId).then((profile) => setDjName(profile?.displayName || 'DJ'))
  }, [licenceRequest])

  useEffect(() => {
    if (!licenceRequest?.dealId) {
      setSourceDeal(null)
      return
    }
    void getDealsByIds([licenceRequest.dealId]).then((rows) => setSourceDeal(rows[0] ?? null))
  }, [licenceRequest?.dealId])

  if (licenceRequest === undefined && loadError) {
    return <ErrorState title="Something went wrong" description="Couldn't load this request. Try refreshing." />
  }
  if (licenceRequest === undefined) return <LoadingState label="Loading request…" />
  if (licenceRequest === null || !firebaseUser) return <EmptyState title="Request not found" />

  const isArtist = licenceRequest.artistId === firebaseUser.uid
  const isDj = licenceRequest.djId === firebaseUser.uid
  if (!isArtist && !isDj) return <EmptyState title="You don't have access to this request" />

  async function cancelOrReject() {
    setBusy(true)
    setActionError(null)
    try {
      await respondToLicenceRequest(requestId!, isDj ? 'cancel' : 'reject')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update this request.')
    } finally {
      setBusy(false)
    }
  }

  const events = buildTimelineEvents(licenceRequest, offers, agreement, track?.title ?? 'this track', djName, artist?.name ?? 'the artist')

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex w-fit items-center gap-2 text-sm text-ink-2 hover:text-ink-0">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-3">DJ licence request</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink-0">{track?.title ?? 'Track'}</h1>
        <p className="mt-1 text-sm text-ink-2">
          {isDj ? `Artist: ${artist?.name ?? 'Loading…'}` : `DJ: ${djName}`} · Request ID: {licenceRequest.requestId}
        </p>
      </div>

      <NextActionBanner licenceRequest={licenceRequest} agreement={agreement} isArtist={isArtist} />

      {actionError ? <p className="rounded-xl border border-danger-500/25 bg-danger-500/5 px-4 py-3 text-sm text-danger-500">{actionError}</p> : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-0">Original request</h2>
        <dl className="grid grid-cols-1 gap-3 rounded-2xl border border-surface-border bg-surface-1 p-4 text-sm sm:grid-cols-2">
          <Field label="Intended use" value={licenceRequest.intendedUse.replaceAll('_', ' ')} />
          <Field label="Territory" value={licenceRequest.territory ?? '—'} />
          <Field label="Venue" value={licenceRequest.venue || '—'} />
          <Field label="Event date" value={licenceRequest.expectedDate || '—'} />
          <Field label="Recording requested" value={licenceRequest.recordingIntention ? 'Yes' : 'No'} />
          <Field label="Streaming requested" value={licenceRequest.streamingIntention ? 'Yes' : 'No'} />
        </dl>
      </section>

      {licenceRequest.currentAgreementId ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-0">Contract</h2>
          <Link
            to={`/agreements/${licenceRequest.currentAgreementId}`}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-surface-0 hover:bg-brand-400"
          >
            <FileSignature className="h-4 w-4" /> View & sign contract
          </Link>
        </section>
      ) : licenceRequest.currentOfferId ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-0">Current offer</h2>
          <OfferCard
            offerId={licenceRequest.currentOfferId}
            requestId={licenceRequest.requestId}
            uid={firebaseUser.uid}
            onCounter={(offer) => setCounterTarget(offer)}
            onSendNew={isArtist ? () => setShowSendOffer(true) : undefined}
          />
        </section>
      ) : isArtist ? (
        <section>
          <Button size="sm" onClick={() => setShowSendOffer(true)}>
            Send terms
          </Button>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-0">Offer history</h2>
        {offers.length === 0 ? (
          <p className="text-sm text-ink-2">No offers have been made yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {offers.map((offer) => (
              <div key={offer.offerId} className="rounded-xl border border-surface-border bg-surface-1 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-ink-0">
                    v{offer.version} · {offer.createdByRole === 'artist' ? 'Artist' : 'DJ'} ·{' '}
                    {offer.priceMinor > 0 ? formatCurrency(offer.priceMinor, offer.currency) : 'Free'}
                  </p>
                  <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs text-ink-2">{offer.status}</span>
                </div>
                <p className="mt-1 text-xs text-ink-2">{[offer.permittedUse, offer.territory, offer.startDate].filter(Boolean).join(' · ')}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-0">Activity timeline</h2>
        <ol className="flex flex-col gap-3">
          {events.map((event, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-ink-2">
                {event.icon}
              </span>
              <div>
                <p className="text-ink-0">{event.label}</p>
                <p className="text-xs text-ink-3">{event.date}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {['submitted', 'artist_review', 'negotiating', 'offer_sent', 'counter_offer', 'agreement_ready'].includes(licenceRequest.status) ? (
        <section className="border-t border-surface-border pt-4">
          <Button size="sm" variant="danger" loading={busy} onClick={() => void cancelOrReject()}>
            {isDj ? 'Cancel request' : 'Reject request'}
          </Button>
        </section>
      ) : null}

      {counterTarget ? (
        <OfferFormModal requestId={licenceRequest.requestId} mode="counter" previousOffer={counterTarget} onClose={() => setCounterTarget(null)} />
      ) : null}
      {showSendOffer ? (
        <OfferFormModal requestId={licenceRequest.requestId} mode="send" previousOffer={null} sourceDeal={sourceDeal} onClose={() => setShowSendOffer(false)} />
      ) : null}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="text-ink-0">{value}</dd>
    </div>
  )
}

/** Always states, in plain language, whose turn it is — the core replacement for a chat thread telling you "waiting on a reply". */
function NextActionBanner({
  licenceRequest,
  agreement,
  isArtist,
}: {
  licenceRequest: LicenceRequestDoc
  agreement: LicenceAgreementDoc | null
  isArtist: boolean
}) {
  let message: string | null = null
  let urgent = false

  if (agreement) {
    const hasSigned = isArtist ? Boolean(agreement.artistAcceptedAt) : Boolean(agreement.djAcceptedAt)
    if (agreement.status === 'pending' && !hasSigned) {
      message = 'Your action required — sign the agreement.'
      urgent = true
    } else if (agreement.status === 'pending') {
      message = `Waiting for the ${isArtist ? 'DJ' : 'artist'} to sign.`
    } else if (agreement.status === 'awaiting_payment' && !isArtist) {
      message = `Payment required — pay ${formatCurrency(agreement.licenceFeeMinor, agreement.currency)} to activate the licence.`
      urgent = true
    } else if (agreement.status === 'awaiting_payment') {
      message = 'Waiting for the DJ to complete payment.'
    } else if (agreement.status === 'active') {
      message = isArtist ? 'Licence active — the DJ may now download the track.' : 'Licence active — you may now download the track.'
    } else if (agreement.status === 'void' || agreement.status === 'cancelled' || agreement.status === 'expired') {
      message = `This agreement is ${agreement.status}.`
    }
  } else if (['submitted', 'artist_review'].includes(licenceRequest.status)) {
    message = isArtist ? 'Your action required — review this request and send terms.' : 'Waiting for the artist to review your request.'
    urgent = isArtist
  } else if (['offer_sent', 'counter_offer'].includes(licenceRequest.status)) {
    const lastOfferByArtist = licenceRequest.status === 'offer_sent'
    // offer_sent means the artist just sent one (DJ's turn); counter_offer means whoever last countered is waiting on the other.
    message = isArtist
      ? lastOfferByArtist
        ? 'Waiting for the DJ to respond to your offer.'
        : 'Your action required — respond to the DJ’s counter-offer.'
      : lastOfferByArtist
        ? 'Your action required — respond to the artist’s offer.'
        : 'Waiting for the artist to respond to your counter-offer.'
    urgent = (isArtist && !lastOfferByArtist) || (!isArtist && lastOfferByArtist)
  } else if (licenceRequest.status === 'rejected') {
    message = 'This request was rejected.'
  } else if (licenceRequest.status === 'cancelled') {
    message = 'This request was cancelled.'
  } else if (licenceRequest.status === 'expired') {
    message = 'This request expired with no resolution.'
  }

  if (!message) return null

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${urgent ? 'border-brand-400/40 bg-brand-500/[0.08] text-ink-0' : 'border-surface-border bg-surface-2 text-ink-1'}`}>
      {message}
    </div>
  )
}

interface TimelineEvent {
  label: string
  date: string
  icon: React.ReactNode
}

function formatEventDate(value: unknown): string {
  const ts = value as { toDate?: () => Date } | null
  if (!ts?.toDate) return ''
  return ts.toDate().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Builds the read-only activity feed purely from real backend records — the request doc, offers, and agreement. Nothing here is user-editable. */
function buildTimelineEvents(
  req: LicenceRequestDoc,
  offers: LicenceOfferDoc[],
  agreement: LicenceAgreementDoc | null,
  trackTitle: string,
  djName: string,
  artistName: string,
): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      label: req.dealId ? `${djName} accepted an artist deal for "${trackTitle}"` : `${djName} requested access to "${trackTitle}"`,
      date: formatEventDate(req.createdAt),
      icon: <Clock className="h-3.5 w-3.5" />,
    },
  ]

  for (const offer of offers) {
    const who = offer.createdByRole === 'artist' ? artistName : djName
    const verb = offer.version === 1 ? 'sent an offer' : 'sent a counter-offer'
    events.push({
      label: `${who} ${verb}: ${offer.priceMinor > 0 ? formatCurrency(offer.priceMinor, offer.currency) : 'Free'}`,
      date: formatEventDate(offer.createdAt),
      icon: <FileSignature className="h-3.5 w-3.5" />,
    })
    if (offer.status === 'accepted') {
      events.push({ label: `Offer v${offer.version} accepted — contract generated`, date: formatEventDate(offer.createdAt), icon: <Check className="h-3.5 w-3.5" /> })
    }
    if (offer.status === 'withdrawn') {
      events.push({ label: `Offer v${offer.version} withdrawn`, date: '', icon: <X className="h-3.5 w-3.5" /> })
    }
  }

  if (agreement) {
    if (agreement.artistAcceptedAt) {
      events.push({ label: 'Artist signed the agreement', date: formatEventDate(agreement.artistAcceptedAt), icon: <Check className="h-3.5 w-3.5" /> })
    }
    if (agreement.djAcceptedAt) {
      events.push({ label: 'DJ signed the agreement', date: formatEventDate(agreement.djAcceptedAt), icon: <Check className="h-3.5 w-3.5" /> })
    }
    if (agreement.paidAt) {
      events.push({ label: 'Payment completed', date: formatEventDate(agreement.paidAt), icon: <Check className="h-3.5 w-3.5" /> })
    }
    if (agreement.status === 'active') {
      events.push({ label: 'Licence activated — track unlocked', date: formatEventDate(agreement.finalisedAt), icon: <Check className="h-3.5 w-3.5" /> })
    }
    if (agreement.status === 'void') {
      events.push({ label: 'Agreement voided', date: '', icon: <X className="h-3.5 w-3.5" /> })
    }
  }

  if (req.status === 'rejected') events.push({ label: 'Request rejected', date: formatEventDate(req.updatedAt), icon: <X className="h-3.5 w-3.5" /> })
  if (req.status === 'cancelled') events.push({ label: 'Request cancelled', date: formatEventDate(req.updatedAt), icon: <X className="h-3.5 w-3.5" /> })
  if (req.status === 'expired') events.push({ label: 'Request expired', date: formatEventDate(req.updatedAt), icon: <X className="h-3.5 w-3.5" /> })

  return events
}
