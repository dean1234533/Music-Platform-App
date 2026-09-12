import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { BrandMark } from '@/components/common/BrandMark'
import { Button } from '@/components/common/Button'
import { useAuth } from '@/contexts/AuthContext'
import { hasAcceptedLegal, recordLegalAcceptance } from '@/services/legalService'
import { getDataRetentionSettings } from '@/services/platformSettingsService'
import { DEFAULT_DATA_RETENTION, type DataRetentionSettings } from '@/types/platformSettings'

const DOC_VERSION = '2026-09-12'

const terms = [
  ['Using BackTheVibes', 'You must provide accurate account information, keep your sign-in details secure, and use the platform lawfully. You are responsible for activity carried out through your account.'],
  ['What BackTheVibes is', 'BackTheVibes is an artist discovery, fan support, and artist/DJ/business collaboration platform. It is not a music-streaming or music-download service: BackTheVibes does not host, store, or distribute audio files. Music is played through the official YouTube player, embedded from a YouTube link the artist provides.'],
  ['YouTube playback', 'Playback of any track uses YouTube\'s own embedded player and is subject to YouTube\'s Terms of Service and Google\'s Privacy Policy. BackTheVibes does not download, extract, cache, or redistribute YouTube audio or video in any form.'],
  ['Artist content and links', 'Artists retain ownership of the music and material they link to. By adding a YouTube link, an artist confirms they have the rights and permissions needed to promote that content through BackTheVibes, and that they are not knowingly submitting content they do not have permission to share. BackTheVibes does not verify copyright ownership of linked content and does not provide legal advice.'],
  ['Artist Membership', 'Publishing tracks as an artist requires an active Artist Membership subscription, billed on the stated interval until cancelled. Prices are shown before purchase; cancellation applies at the end of the current billing period unless the checkout terms state otherwise.'],
  ['Supporting an artist', 'A support payment is a one-off, voluntary payment from a fan directly to an artist, made through Stripe. BackTheVibes charges a platform/application fee (shown before you pay) on each support payment; the remainder is paid directly to the artist\'s own Stripe account. A support payment is not a purchase of goods or services, does not create a subscription, and does not grant the supporter any rights to the artist\'s work.'],
  ['Collaboration and deal proposals', 'The proposal/agreement tools let an artist and a DJ or business record collaboration or licensing terms and track their status. A proposal is not a legal agreement until both parties deliberately accept its terms, and an accepted agreement is not automatically enforceable legal advice or a guarantee that its terms are legally sufficient. Payment of a fee under an agreement does not automatically transfer copyright or grant any right not expressly stated in that agreement. BackTheVibes is not a party to the agreement and does not provide legal advice — parties are encouraged to seek independent legal advice and may use external e-signature or legal services for a binding agreement. BackTheVibes does not host, store, or transfer master recordings, stems, or other production files; any such exchange between the parties happens entirely outside the platform.'],
  ['Acceptable use', 'Do not infringe intellectual property, bypass access controls, scrape the service, upload harmful material, impersonate others, manipulate engagement, or interfere with the platform’s operation.'],
  ['Suspension and termination', 'We may restrict or close accounts that breach these terms, create risk for other users, or must be acted on for legal or security reasons. You may stop using BackTheVibes at any time.'],
  ['Liability', 'BackTheVibes is provided with reasonable care, but availability is not guaranteed. BackTheVibes does not guarantee that any proposal, agreement, or linked content is legally sufficient or rights-cleared. Nothing in these terms excludes liability that cannot lawfully be excluded.'],
  ['Changes', 'We may update these terms as the service evolves. Material changes will be communicated through the service or another appropriate channel before they take effect.'],
]

const privacy = [
  ['What we collect', 'We collect account details, profile information, artist/DJ/business profile content (including YouTube links you add), listening and engagement activity, follows and support relationships, messages connected to collaboration/licensing proposals, transaction records, device information, and support communications.'],
  ['How we use information', 'We use information to operate accounts, personalise discovery, present linked content, process Artist Membership billing and one-off support payments, facilitate collaboration/licensing proposals, prevent abuse, provide support, and meet legal obligations.'],
  ['YouTube', 'Track playback loads the official YouTube embedded player. Where possible this uses YouTube\'s privacy-enhanced (youtube-nocookie.com) mode and only loads after you choose to play a track, but YouTube/Google may still process technical and usage information under their own privacy policy once you do. See Google\'s Privacy Policy for details on how YouTube handles that information.'],
  ['Stripe (payments and payouts)', 'Payments (Artist Membership, one-off artist support, collaboration/licence fees) and artist payouts are processed by Stripe, including Stripe Connect for artists\' own connected accounts. BackTheVibes stores only the identifiers and status information needed to operate the service (such as a Stripe customer ID or connected-account ID) — it never stores card numbers, bank account details, or other sensitive payment credentials, which are held entirely by Stripe.'],
  ['Firebase and Cloudflare', 'BackTheVibes runs on Firebase (Authentication, Firestore database, Storage, Cloud Functions) and is served/deployed via Cloudflare. These providers process data on our behalf as necessary to operate the service.'],
  ['Who receives information', 'Information is shared only where needed with service providers (Firebase, Stripe, Cloudflare, and similar infrastructure), with artists, DJs, or businesses as part of a user-requested interaction (a follow, a support payment, a collaboration proposal), for a business transfer, or when law and safety require it. We do not sell personal information.'],
  ['Retention', 'We keep information only for as long as it serves the purposes described here, or satisfies legal, accounting, fraud-prevention, and dispute requirements. The table below shows the configured periods our automated cleanup jobs use — kept here rather than restated separately, so this page can never drift from what the backend actually does.'],
  ['Account deletion', 'You can permanently delete your account from Settings → Account at any time, after re-confirming your identity. This removes your profile, linked content, follows/support relationships, and other personal data we are not legally required to retain, on a best-efforts and idempotent basis — a repeated deletion request completes any step a prior attempt did not finish. Signed collaboration/licence agreements you are a party to, and the minimum payment/transaction records needed for accounting, tax, or dispute purposes, are kept for the periods below rather than destroyed — deleting your account never destroys the other party’s agreement evidence or required financial records. Deletion is not necessarily instantaneous: some data may remain briefly in backups or in-flight processing before being purged.'],
  ['Your rights and data export', 'You can update profile information and notification choices in your account, and download a copy of your account, content, and activity data at any time from Settings → Privacy → Download my data. Depending on where you live, you may also have rights to correct, restrict, or object to certain processing — use the contact method below to make a request.'],
  ['Legal retention exceptions', 'Some information is kept beyond normal account activity where the law, an open dispute, or a signed agreement requires it — for example an active copyright claim, a payment dispute, or a collaboration/licence agreement under legal hold. That information is restricted to authorised backend/admin access, excluded from discovery, marketing, and ordinary analytics, and deleted once the applicable retention period ends.'],
  ['Cookies and local storage', 'BackTheVibes uses essential browser storage for sign-in, security, preferences, and reliable service operation. Playing a track loads a YouTube embed, which may set its own cookies/local storage under Google\'s control once you choose to play it. Any optional analytics or marketing technologies should be presented with appropriate controls before use.'],
  ['Questions and requests', 'Use the support options available inside your account for privacy questions or requests. We may need to verify your identity before completing a request.'],
]

const RETENTION_ROWS: { label: string; key: keyof DataRetentionSettings; unit: string }[] = [
  { label: 'Notifications', key: 'notificationsDays', unit: 'days' },
  { label: 'Unsaved Story recovery buffer', key: 'storyRecoveryDays', unit: 'days' },
  { label: 'Inactive chat threads', key: 'inactiveChatMonths', unit: 'months' },
  { label: 'Abandoned/rejected DJ requests', key: 'abandonedRequestMonths', unit: 'months' },
  { label: 'Unsigned draft offers', key: 'draftOfferMonths', unit: 'months' },
  { label: 'Security/audit logs', key: 'auditLogMonths', unit: 'months' },
  { label: 'Signed DJ licence contracts (after they end)', key: 'contractYears', unit: 'years' },
  { label: 'Resolved copyright claims', key: 'copyrightClaimYears', unit: 'years' },
]

export function LegalPage({ type }: { type: 'terms' | 'privacy' }) {
  const isTerms = type === 'terms'
  const sections = isTerms ? terms : privacy
  const docType = isTerms ? 'terms' : 'privacy'
  const { firebaseUser } = useAuth()
  const [accepted, setAccepted] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [retention, setRetention] = useState<DataRetentionSettings>(DEFAULT_DATA_RETENTION)

  useEffect(() => {
    if (!isTerms) void getDataRetentionSettings().then(setRetention)
  }, [isTerms])

  useEffect(() => {
    if (!firebaseUser) {
      setAccepted(false)
      return
    }
    hasAcceptedLegal(firebaseUser.uid, docType, DOC_VERSION).then(setAccepted)
  }, [firebaseUser, docType])

  async function handleAccept() {
    if (!firebaseUser) return
    setAccepting(true)
    try {
      await recordLegalAcceptance(docType, DOC_VERSION, firebaseUser.uid)
      setAccepted(true)
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div className="min-h-svh bg-surface-0 text-ink-0">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-surface-0/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8"><Link to="/"><BrandMark /></Link><Link to="/" className="flex items-center gap-2 text-sm text-ink-2 transition hover:text-ink-0"><ArrowLeft className="h-4 w-4" /> Back home</Link></div>
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-24 pt-16 sm:px-8 sm:pt-24">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-4 text-5xl font-medium tracking-[-0.055em] sm:text-7xl">{isTerms ? 'Terms & conditions' : 'Privacy policy'}</h1>
        <p className="mt-6 text-sm text-ink-3">Last updated 7 September 2026</p>
        {firebaseUser ? (
          accepted ? (
            <p className="mt-6 flex items-center gap-2 text-sm text-support-400">
              <Check className="h-4 w-4" /> You've accepted this version.
            </p>
          ) : (
            <Button size="sm" className="mt-6" onClick={handleAccept} loading={accepting}>
              I agree to these {isTerms ? 'terms' : 'this policy'}
            </Button>
          )
        ) : (
          <p className="mt-6 text-sm text-ink-3">
            <Link to="/sign-in" className="text-brand-400 hover:underline">Sign in</Link> to record your acceptance.
          </p>
        )}
        <div className="mt-16 divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {sections.map(([title, copy], index) => <section key={title} className="grid gap-4 py-8 sm:grid-cols-[3rem_1fr_2fr]"><span className="text-xs text-brand-400">{String(index + 1).padStart(2, '0')}</span><h2 className="text-lg font-medium">{title}</h2><p className="text-base leading-7 text-ink-2">{copy}</p></section>)}
        </div>
        {!isTerms ? (
          <div className="mt-12">
            <h2 className="mb-4 text-lg font-medium">Retention periods</h2>
            <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-xs uppercase tracking-wide text-ink-3">
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Kept for</th>
                  </tr>
                </thead>
                <tbody>
                  {RETENTION_ROWS.map((row) => (
                    <tr key={row.key} className="border-b border-white/[0.05] last:border-0">
                      <td className="px-4 py-3 text-ink-1">{row.label}</td>
                      <td className="px-4 py-3 text-ink-0">{retention[row.key]} {row.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-5 text-ink-3">
              These are the actual configured values our scheduled cleanup jobs use, not just suggested figures — an
              admin change to these settings updates this table too. They are suggested defaults pending review by a
              qualified solicitor/accountant, not a final legal determination.
            </p>
          </div>
        ) : null}
        <p className="mt-8 text-xs leading-5 text-ink-3">This page is a product-ready general policy template and should be reviewed against the operating company, jurisdiction, payment model, and final data practices before a public launch.</p>
      </main>
    </div>
  )
}
