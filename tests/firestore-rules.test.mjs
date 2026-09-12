import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')

test('a regular user can only set roles once at initial signup — no self-service add or remove afterward; only an admin account can change its own roles later', () => {
  // Non-admin, first-ever write (roles still []): may set exactly one of fan/artist/dj, once —
  // a regular account keeps that single role for life (one role per account, not "a subset of").
  assert.match(rules, /resource\.data\.roles\.size\(\) == 0 && request\.resource\.data\.roles\.size\(\) == 1 && request\.resource\.data\.roles\.hasOnly\(\['fan', 'artist', 'dj'\]\)/)
  // Non-admin, already onboarded: roles field is frozen exactly as-is on this path.
  assert.match(rules, /resource\.data\.roles\.hasOnly\(\['fan', 'artist', 'dj'\]\) && request\.resource\.data\.roles == resource\.data\.roles/)
  // The admin branch: 'admin' must be present both before and after the write,
  // and with it stripped from both sides the remainder must still be only fan/artist/dj —
  // so an admin account can step in/out of fan/artist/dj like anyone else, but this
  // client-writable path can never itself add or remove 'admin'.
  assert.match(rules, /resource\.data\.roles\.hasAny\(\['admin'\]\)[\s\S]*?request\.resource\.data\.roles\.hasAny\(\['admin'\]\)[\s\S]*?request\.resource\.data\.roles\.removeAll\(\['admin'\]\)\.hasOnly\(\['fan', 'artist', 'dj'\]\)/)
  assert.match(rules, /subscriptionStatus == resource\.data\.subscriptionStatus/)
  assert.match(rules, /stripeCustomerId[\s\S]*?== resource\.data/)
})

test('original tracks and signed agreement records are not client writable', () => {
  assert.match(rules, /match \/licenceAgreements\/\{docId\}[\s\S]*?allow write: if false/)
  assert.match(rules, /match \/downloadLogs\/\{docId\}[\s\S]*?allow write: if false/)
})

test('track delete is forced through the validating callable', () => {
  const block = rules.match(/match \/tracks\/\{trackId\} \{([\s\S]*?)\n    \}/)?.[1] ?? ''
  assert.match(block, /allow delete: if false/)
})

test('admin data requires the admin role', () => {
  for (const collection of ['auditLogs', 'securityIncidents', 'platformSettings']) {
    const start = rules.indexOf(`match /${collection}`)
    assert.notEqual(start, -1)
    assert.match(rules.slice(start, start + 500), /isAdmin\(\)/)
  }
})
