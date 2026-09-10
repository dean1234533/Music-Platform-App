import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { BrandMark } from '@/components/common/BrandMark'
import { Button } from '@/components/common/Button'
import { useAuth } from '@/contexts/AuthContext'
import { hasAcceptedLegal, recordLegalAcceptance } from '@/services/legalService'
import { getDataRetentionSettings } from '@/services/platformSettingsService'
import { DEFAULT_DATA_RETENTION, type DataRetentionSettings } from '@/types/platformSettings'

const DOC_VERSION = '2026-09-07'

const terms = [
  ['Using BackTheVibes', 'You must provide accurate account information, keep your sign-in details secure, and use the platform lawfully. You are responsible for activity carried out through your account.'],
  ['Subscriptions and payments', 'Paid memberships renew on the stated billing interval until cancelled. Prices and applicable charges are shown before purchase. Cancellation applies at the end of the current billing period unless the checkout terms state otherwise.'],
  ['Artist content', 'Artists retain ownership of the music and material they upload. Uploading content gives BackTheVibes the limited permission needed to host, process, preview, and present it through the service. Artists must have the rights required to upload and license their content.'],
  ['DJ licensing', 'A licence exists only when the relevant artist and DJ have agreed its terms. Payment, permitted uses, territory, duration, and download access are governed by that agreement. BackTheVibes provides the workflow but is not a party to creative negotiations unless expressly stated.'],
  ['Acceptable use', 'Do not infringe intellectual property, bypass access controls, scrape the service, upload harmful material, impersonate others, manipulate engagement, or interfere with the platform’s operation.'],
  ['Suspension and termination', 'We may restrict or close accounts that breach these terms, create risk for other users, or must be acted on for legal or security reasons. You may stop using BackTheVibes at any time.'],
  ['Liability', 'BackTheVibes is provided with reasonable care, but availability is not guaranteed. Nothing in these terms excludes liability that cannot lawfully be excluded.'],
  ['Changes', 'We may update these terms as the service evolves. Material changes will be communicated through the service or another appropriate channel before they take effect.'],
]

const privacy = [
  ['What we collect', 'We collect account details, profile information, content you upload, listening and engagement activity, messages connected to licensing requests, transaction records, device information, and support communications.'],
  ['How we use information', 'We use information to operate accounts, personalise discovery, play and protect content, process subscriptions and licences, allocate artist support, prevent abuse, provide support, and meet legal obligations.'],
  ['Payments', 'Payments and payouts are processed by specialist payment providers. BackTheVibes receives identifiers and transaction status information needed to operate the service, but does not store full payment-card details.'],
  ['Who receives information', 'Information is shared only where needed with service providers, with artists or DJs as part of a user-requested interaction, for a business transfer, or when law and safety require it. We do not sell personal information.'],
  ['Retention', 'We keep information only for as long as it serves the purposes described here, or satisfies legal, accounting, fraud-prevention, and dispute requirements. The table below shows the configured periods our automated cleanup jobs use — kept here rather than restated separately, so this page can never drift from what the backend actually does.'],
  ['Account deletion', 'You can permanently delete your account from Settings → Account at any time, after re-confirming your identity. This removes your profile, uploaded content, and other personal data we are not legally required to retain. Signed DJ licence agreements you are a party to, and the minimum records needed for accounting, tax, or dispute purposes, are kept for the periods below rather than destroyed — deleting your account never destroys the other party’s licence evidence.'],
  ['Your rights and data export', 'You can update profile information and notification choices in your account, and download a copy of your account, content, and activity data at any time from Settings → Privacy → Download my data. Depending on where you live, you may also have rights to correct, restrict, or object to certain processing — use the contact method below to make a request.'],
  ['Legal retention exceptions', 'Some information is kept beyond normal account activity where the law, an open dispute, or a signed contract requires it — for example an active copyright claim, a payment dispute, or a licence agreement under legal hold. That information is restricted to authorised backend/admin access, excluded from discovery, marketing, and ordinary analytics, and deleted once the applicable retention period ends.'],
  ['Cookies and local storage', 'BackTheVibes uses essential browser storage for sign-in, security, preferences, and reliable service operation. Any optional analytics or marketing technologies should be presented with appropriate controls before use.'],
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
