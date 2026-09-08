import { useEffect, useState } from 'react'
import { Gift } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { createFanOffer, deleteFanOffer, subscribeArtistFanOffers } from '@/services/fanOfferService'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { FanOfferCard } from '@/components/music/FanOfferCard'
import type { FanOfferAudience, FanOfferDoc, FanOfferKind } from '@/types/fanOffer'

export function FanOffersPage() {
  const { firebaseUser } = useAuth()
  const { notify } = useToast()
  const [offers, setOffers] = useState<FanOfferDoc[] | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [redemption, setRedemption] = useState('')
  const [audience, setAudience] = useState<FanOfferAudience>('supporters')
  const [kind, setKind] = useState<FanOfferKind>('exclusive')
  const [expiresOn, setExpiresOn] = useState('')
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeArtistFanOffers(firebaseUser.uid, setOffers)
  }, [firebaseUser])

  async function publishOffer() {
    if (!firebaseUser || !title.trim() || !description.trim() || !redemption.trim()) return
    setPublishing(true)
    try {
      await createFanOffer(firebaseUser.uid, {
        title: title.trim(),
        description: description.trim(),
        redemption: redemption.trim(),
        audience,
        kind,
        expiresAt: expiresOn ? new Date(`${expiresOn}T23:59:59`) : null,
      })
      notify(`Published “${title.trim()}” to ${audience}.`)
      setTitle('')
      setDescription('')
      setRedemption('')
      setExpiresOn('')
    } catch {
      notify('Could not publish this offer. Please try again.', 'error')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="eyebrow">Reward your community</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-ink-0">Fan offers</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">Give followers or paying supporters early access, discounts, event perks, merch offers, and exclusive rewards.</p>
      </div>

      <section className="rounded-[1.5rem] border border-white/[0.09] bg-white/[0.025] p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-400"><Gift size={19} strokeWidth={1.8} /></span>
          <div><h2 className="font-semibold text-ink-0">Create an offer</h2><p className="text-xs text-ink-3">Fans see the redemption details only after claiming.</p></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Offer title</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="20% off limited vinyl" /></div>
          <div className="sm:col-span-2"><Label>What fans receive</Label><TextArea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the benefit clearly." /></div>
          <div><Label>Offer type</Label><select value={kind} onChange={(event) => setKind(event.target.value as FanOfferKind)} className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-ink-0"><option value="exclusive">Exclusive</option><option value="early_access">Early access</option><option value="discount">Discount</option><option value="event">Event</option><option value="merch">Merch</option><option value="other">Other</option></select></div>
          <div><Label>Who can claim</Label><select value={audience} onChange={(event) => setAudience(event.target.value as FanOfferAudience)} className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-ink-0"><option value="everyone">Everyone</option><option value="followers">Followers</option><option value="supporters">Paying supporters</option></select></div>
          <div><Label>Expiry date (optional)</Label><Input type="date" value={expiresOn} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setExpiresOn(event.target.value)} /></div>
          <div><Label>How to redeem</Label><Input value={redemption} onChange={(event) => setRedemption(event.target.value)} placeholder="Code, link, or instructions" /></div>
        </div>
        <Button className="mt-5" onClick={publishOffer} loading={publishing} disabled={!title.trim() || !description.trim() || !redemption.trim()}><Gift size={17} /> Publish offer</Button>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold text-ink-0">Your offers</h2><span className="text-sm text-ink-3">{offers?.length ?? 0} live or scheduled</span></div>
        {offers === null ? <LoadingState /> : offers.length === 0 ? <EmptyState icon={<Gift className="h-8 w-8 text-brand-400" />} title="No offers yet" description="Create a reward your fans can claim." /> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{offers.map((offer) => <FanOfferCard key={offer.offerId} offer={offer} ownerView onDelete={async () => { if (!window.confirm(`Delete “${offer.title}”?`)) return; try { await deleteFanOffer(offer.offerId); notify(`Deleted “${offer.title}”.`, 'info') } catch { notify('Could not delete this offer.', 'error') } }} />)}</div>
        )}
      </section>
    </div>
  )
}
