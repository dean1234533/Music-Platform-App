import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { listPendingVerificationRequests, reviewVerificationRequest } from '@/services/adminService'
import { getArtistProfile } from '@/services/artistService'
import { getDJProfile } from '@/services/djService'
import { Button } from '@/components/common/Button'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { VerificationRequestDoc } from '@/types/moderation'
import type { ArtistProfile, SocialLinks } from '@/types/artist'
import type { DJProfile } from '@/types/dj'

type Subject = { name: string; photoURL: string | null; bio: string; genres: string[]; location: string; socialLinks: SocialLinks; link: string; extra: string }

function toSubject(req: VerificationRequestDoc, profile: ArtistProfile | DJProfile | null): Subject | null {
  if (!profile) return null
  if (req.profileType === 'artist') {
    const p = profile as ArtistProfile
    return {
      name: p.name,
      photoURL: p.photoURL,
      bio: p.bio,
      genres: p.genres,
      location: p.location,
      socialLinks: p.socialLinks,
      link: `/artist/${p.slug}`,
      extra: `${p.trackCount} tracks · ${p.followerCount} followers · ${p.supporterCount} supporters`,
    }
  }
  const p = profile as DJProfile
  return {
    name: p.name,
    photoURL: p.photoURL,
    bio: p.bio,
    genres: p.genres,
    location: [p.city, p.country].filter(Boolean).join(', '),
    socialLinks: p.socialLinks,
    link: `/djs/${p.djId}`,
    extra: p.venues.length ? `Venues: ${p.venues.join(', ')}` : '',
  }
}

export function AdminVerificationPage() {
  const [requests, setRequests] = useState<VerificationRequestDoc[] | null>(null)
  const [subjects, setSubjects] = useState<Record<string, Subject | null>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    void listPendingVerificationRequests().then(setRequests)
  }, [])

  useEffect(() => {
    if (!requests) return
    void Promise.all(
      requests.map(async (req) => {
        const profile = req.profileType === 'artist' ? await getArtistProfile(req.userId) : await getDJProfile(req.userId)
        return [req.verificationRequestId, toSubject(req, profile)] as const
      }),
    ).then((entries) => setSubjects(Object.fromEntries(entries)))
  }, [requests])

  async function handleReview(id: string, approve: boolean) {
    setBusyId(id)
    try {
      await reviewVerificationRequest({ verificationRequestId: id, approve })
      setRequests((prev) => prev?.filter((r) => r.verificationRequestId !== id) ?? null)
    } finally {
      setBusyId(null)
    }
  }

  if (requests === null) return <LoadingState />

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink-0">Verification requests</h1>
      {requests.length === 0 ? (
        <EmptyState title="No pending requests" />
      ) : (
        <div className="flex flex-col gap-4">
          {requests.map((req) => {
            const subject = subjects[req.verificationRequestId]
            return (
              <div key={req.verificationRequestId} className="flex flex-col gap-3 rounded-xl border border-surface-border p-4">
                {subject === undefined ? (
                  <p className="text-sm text-ink-2">Loading profile…</p>
                ) : subject === null ? (
                  <p className="text-sm text-danger-500">
                    This {req.profileType} profile no longer exists (uid: {req.userId}) — nothing to verify.
                  </p>
                ) : (
                  <div className="flex items-start gap-3">
                    {subject.photoURL ? (
                      <img src={subject.photoURL} alt={subject.name} className="h-14 w-14 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface-3 text-lg font-semibold text-ink-2">
                        {subject.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-base font-semibold text-ink-0">{subject.name}</p>
                        <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-xs text-ink-2">{req.profileType}</span>
                      </div>
                      {subject.location ? <p className="text-xs text-ink-3">{subject.location}</p> : null}
                      {subject.genres.length ? <p className="mt-1 text-xs text-ink-2">{subject.genres.join(', ')}</p> : null}
                      {subject.bio ? <p className="mt-1 text-sm text-ink-1">{subject.bio}</p> : null}
                      {subject.extra ? <p className="mt-1 text-xs text-ink-3">{subject.extra}</p> : null}
                      <div className="mt-2 flex flex-wrap gap-3">
                        <Link to={subject.link} target="_blank" className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300">
                          View public profile <ExternalLink className="h-3 w-3" />
                        </Link>
                        {Object.entries(subject.socialLinks)
                          .filter(([, url]) => url)
                          .map(([platform, url]) => (
                            <a
                              key={platform}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink-0"
                            >
                              {platform} <ExternalLink className="h-3 w-3" />
                            </a>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-surface-border bg-surface-2 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-3">Requester's case</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-1">{req.note || '(no reason given)'}</p>
                </div>
                <p className="text-xs text-ink-3">uid: {req.userId}</p>

                <div className="flex gap-2">
                  <Button size="sm" loading={busyId === req.verificationRequestId} onClick={() => handleReview(req.verificationRequestId, true)}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={busyId === req.verificationRequestId}
                    onClick={() => handleReview(req.verificationRequestId, false)}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
