import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')

test('a regular user can only add fan/artist/dj roles to themselves, never remove one — only an admin account can step back from a role', () => {
  // Non-admin branch: roles stay within fan/artist/dj, and every role
  // present before the write must still be present after it (add-only).
  assert.match(rules, /request\.resource\.data\.roles\.hasOnly\(\['fan', 'artist', 'dj'\]\)\s*&& resource\.data\.roles\.removeAll\(request\.resource\.data\.roles\)\.size\(\) == 0/)
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
