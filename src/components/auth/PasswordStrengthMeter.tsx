import { useEffect, useState } from 'react'
import { clsx } from 'clsx'

type ZxcvbnFn = (password: string) => { score: 0 | 1 | 2 | 3 | 4 }

let zxcvbnPromise: Promise<ZxcvbnFn> | null = null

/** Loaded on demand — zxcvbn's word-frequency dictionaries are large enough that bundling them into the main chunk isn't worth it for a field most visits never touch. */
function loadZxcvbn(): Promise<ZxcvbnFn> {
  if (!zxcvbnPromise) {
    zxcvbnPromise = Promise.all([
      import('@zxcvbn-ts/core'),
      import('@zxcvbn-ts/language-common'),
      import('@zxcvbn-ts/language-en'),
    ]).then(([core, common, en]) => {
      const zxcvbn = new core.ZxcvbnFactory({
        dictionary: { ...common.dictionary, ...en.dictionary },
        graphs: common.adjacencyGraphs,
        translations: en.translations,
      })
      return (password: string) => zxcvbn.check(password)
    })
  }
  return zxcvbnPromise
}

const LABELS = ['Weak', 'Weak', 'Fair', 'Good', 'Strong']
const COLORS = ['bg-danger-500', 'bg-danger-500', 'bg-amber-500', 'bg-support-500', 'bg-support-400']

export function PasswordStrengthMeter({ password }: { password: string }) {
  const [score, setScore] = useState<number | null>(null)

  useEffect(() => {
    if (!password) {
      setScore(null)
      return
    }
    let cancelled = false
    void loadZxcvbn().then((zxcvbn) => {
      if (!cancelled) setScore(zxcvbn(password).score)
    })
    return () => {
      cancelled = true
    }
  }, [password])

  if (!password || score === null) return null

  return (
    <div aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={clsx('h-1.5 flex-1 rounded-full', i <= score ? COLORS[score] : 'bg-surface-3')}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-ink-2">Password strength: {LABELS[score]}</p>
    </div>
  )
}
