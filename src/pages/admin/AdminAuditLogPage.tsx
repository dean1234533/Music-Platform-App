import { useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { AuditLogDoc } from '@/types/moderation'

export function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditLogDoc[] | null>(null)

  useEffect(() => {
    void getDocs(query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(100))).then((snap) =>
      setLogs(snap.docs.map((d) => d.data() as AuditLogDoc)),
    )
  }, [])

  if (logs === null) return <LoadingState />

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink-0">Audit log</h1>
      {logs.length === 0 ? (
        <EmptyState title="No admin actions recorded yet" />
      ) : (
        <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
          {logs.map((log, i) => (
            <div key={i} className="px-4 py-3 text-sm">
              <p className="text-ink-0">{log.action}</p>
              <p className="text-xs text-ink-2">by {log.adminId}</p>
              <pre className="mt-1 overflow-x-auto text-xs text-ink-3">{JSON.stringify(log.details)}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
