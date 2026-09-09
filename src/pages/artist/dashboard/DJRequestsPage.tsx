import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileSignature, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { acceptExistingDeal, dismissLicenceRequest, respondToLicenceRequest, subscribeRequestsForArtist } from '@/services/licenceService'
import { getTrack } from '@/services/trackService'
import { getDealsByIds } from '@/services/dealService'
import { Button } from '@/components/common/Button'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { OfferCard } from '@/components/licence/OfferCard'
import { OfferFormModal } from '@/components/licence/OfferFormModal'
import type { LicenceOfferDoc, LicenceRequestDoc, LicenceRequestStatus } from '@/types/licence'
import type { DjDealDoc } from '@/types/deal'

const CLOSED_STATUSES: LicenceRequestStatus[] = ['rejected', 'expired', 'cancelled']

const GROUPS: { status: LicenceRequestStatus[]; label: string }[] = [
  { status: ['submitted', 'artist_review', 'negotiating'], label: 'Needs your review' },
  { status: ['offer_sent', 'counter_offer'], label: 'Terms sent' },
  { status: ['agreement_ready', 'awaiting_signatures'], label: 'Needs signatures' },
  { status: ['awaiting_payment'], label: 'Waiting for DJ payment' },
  { status: ['approved'], label: 'Active' },
  { status: CLOSED_STATUSES, label: 'Closed' },
]

export function DJRequestsPage() {
  const { firebaseUser } = useAuth()
  const [allRequests, setRequests] = useState<LicenceRequestDoc[] | null>(null)
  const [trackTitles, setTrackTitles] = useState<Record<string, string>>({})
  const [deals, setDeals] = useState<Record<string, DjDealDoc>>({})
  const [offerModal, setOfferModal] = useState<{
    requestId: string
    mode: 'send' | 'counter'
    previousOffer: LicenceOfferDoc | null
    sourceDeal: DjDealDoc | null
  } | null>(null)
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showClosed, setShowClosed] = useState(false)

  const requests = allRequests?.filter((r) => !r.dismissedBy?.includes(firebaseUser?.uid ?? '')) ?? null

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeRequestsForArtist(firebaseUser.uid, setRequests)
  }, [firebaseUser])

  useEffect(() => {
    if (!requests) return
    const missing = requests.map((request) => request.trackId).filter((id) => !(id in trackTitles))
    if (missing.length === 0) return
    void Promise.all(missing.map((id) => getTrack(id).then((track) => [id, track?.title ?? 'Track'] as const))).then((entries) => {
      setTrackTitles((previous) => ({ ...previous, ...Object.fromEntries(entries) }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests])

  useEffect(() => {
    if (!requests) return
    const missing = [...new Set(requests.map((request) => request.dealId).filter((id): id is string => Boolean(id) && !(id! in deals)))]
    if (missing.length === 0) return
    void getDealsByIds(missing).then((rows) => {
      setDeals((previous) => ({ ...previous, ...Object.fromEntries(rows.map((deal) => [deal.dealId, deal])) }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests])

  async function declineRequest(requestId: string) {
    setBusyRequestId(requestId)
    setError(null)
    try {
      await respondToLicenceRequest(requestId, 'reject', 'artist')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not decline this request.')
    } finally {
      setBusyRequestId(null)
    }
  }

  async function acceptPublishedDeal(requestId: string) {
    setBusyRequestId(requestId)
    setError(null)
    try {
      await acceptExistingDeal({ requestId, actingRole: 'artist' })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not accept this deal.')
    } finally {
      setBusyRequestId(null)
    }
  }

  async function deleteRequest(requestId: string) {
    setBusyRequestId(requestId)
    setError(null)
    try {
      await dismissLicenceRequest({ requestId })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove this request.')
    } finally {
      setBusyRequestId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-0">DJ licensing</h1>
        <p className="mt-1 text-sm text-ink-2">Review requests, set terms, sign contracts and track payment in one place.</p>
      </div>
      {error ? <p className="rounded-xl border border-danger-500/25 bg-danger-500/5 px-4 py-3 text-sm text-danger-500">{error}</p> : null}

      {requests === null ? (
        <LoadingState />
      ) : requests.length === 0 ? (
        <EmptyState title="No DJ requests yet" description="Requests and accepted artist deals will appear here." />
      ) : (
        <div className="flex flex-col gap-8">
          {(() => {
            const closedCount = requests.filter((r) => CLOSED_STATUSES.includes(r.status)).length
            return closedCount > 0 ? (
              <button
                type="button"
                onClick={() => setShowClosed((v) => !v)}
                className="w-fit rounded-full border border-surface-border bg-surface-1 px-3.5 py-1.5 text-xs font-medium text-ink-2 transition hover:text-ink-0"
              >
                {showClosed ? 'Hide' : 'Show'} closed requests ({closedCount})
              </button>
            ) : null
          })()}
          {GROUPS.map((group) => {
            const isClosedGroup = group.label === 'Closed'
            if (isClosedGroup && !showClosed) return null
            const items = requests.filter((request) => group.status.includes(request.status))
            if (items.length === 0) return null
            return (
              <section key={group.label}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-3">
                  {group.label} ({items.length})
                </h2>
                <div className="grid gap-3 lg:grid-cols-2">
                  {items.map((request) => {
                    const sourceDeal = request.dealId ? (deals[request.dealId] ?? null) : null
                    const selectedPriceType = request.selectedDealSnapshot?.priceType ?? sourceDeal?.priceType
                    const canAcceptPublishedDeal = request.status === 'submitted' && Boolean(request.dealId) && ['free', 'fixed'].includes(selectedPriceType ?? '')
                    return (
                    <article key={request.requestId} className="flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface-1 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-base font-semibold text-ink-0">{trackTitles[request.trackId] ?? 'Track'}</h3>
                          <p className="mt-1 text-sm text-ink-2">
                            {request.dealId
                              ? request.currentAgreementId
                                ? `Your published deal "${sourceDeal?.name ?? 'deal'}" was accepted.`
                                : `Requested against your deal "${sourceDeal?.name ?? 'Loading…'}"${sourceDeal ? ` (${sourceDeal.priceType.replaceAll('_', ' ')})` : ''} — set final terms below.`
                              : `Requested use: ${request.intendedUse.replaceAll('_', ' ')}`}
                          </p>
                          {!request.dealId && request.territory ? <p className="mt-1 text-xs text-ink-3">Territory: {request.territory}</p> : null}
                        </div>
                        {request.dealId ? (
                          <span className="shrink-0 rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-400">Deal</span>
                        ) : null}
                      </div>

                      <Link to={`/dj-requests/${request.requestId}?as=artist`} className="w-fit text-xs font-medium text-brand-400 hover:text-brand-300">
                        View request details & activity
                      </Link>

                      {request.currentAgreementId ? (
                        <Link
                          to={`/agreements/${request.currentAgreementId}?as=artist`}
                          className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-surface-0 hover:bg-brand-400"
                        >
                          <FileSignature className="h-4 w-4" /> Review & sign contract
                        </Link>
                      ) : ['rejected', 'expired', 'cancelled'].includes(request.status) ? null : request.currentOfferId ? (
                        <OfferCard
                          offerId={request.currentOfferId}
                          requestId={request.requestId}
                          actingRole="artist"
                          onCounter={(offer) => setOfferModal({ requestId: request.requestId, mode: 'counter', previousOffer: offer, sourceDeal: null })}
                          onSendNew={() => setOfferModal({ requestId: request.requestId, mode: 'send', previousOffer: null, sourceDeal })}
                        />
                      ) : request.status === 'submitted' ? (
                        <div className="flex flex-wrap gap-2">
                          {canAcceptPublishedDeal ? (
                            <Button size="sm" loading={busyRequestId === request.requestId} onClick={() => void acceptPublishedDeal(request.requestId)}>
                              Accept existing deal
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            onClick={() => setOfferModal({ requestId: request.requestId, mode: 'send', previousOffer: null, sourceDeal })}
                          >
                            <SlidersHorizontal className="h-4 w-4" /> {sourceDeal ? 'Send revised offer' : 'Approve & set contract terms'}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            loading={busyRequestId === request.requestId}
                            onClick={() => void declineRequest(request.requestId)}
                          >
                            Decline
                          </Button>
                        </div>
                      ) : request.status === 'awaiting_payment' ? (
                        <p className="text-sm text-ink-2">Both parties signed. The DJ must pay before the track download unlocks.</p>
                      ) : request.status === 'approved' ? (
                        <p className="text-sm text-support-400">Complete. The DJ can download the licensed track.</p>
                      ) : null}
                      {CLOSED_STATUSES.includes(request.status) ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busyRequestId === request.requestId}
                          onClick={() => void deleteRequest(request.requestId)}
                          className="w-fit"
                        >
                          Delete
                        </Button>
                      ) : null}
                    </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {offerModal ? (
        <OfferFormModal
          requestId={offerModal.requestId}
          mode={offerModal.mode}
          previousOffer={offerModal.previousOffer}
          sourceDeal={offerModal.sourceDeal}
          actingRole="artist"
          onClose={() => setOfferModal(null)}
        />
      ) : null}
    </div>
  )
}
