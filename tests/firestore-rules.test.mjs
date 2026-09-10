import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')

test('users cannot grant themselves admin or paid status', () => {
  assert.match(rules, /roles\.hasOnly\(\['fan', 'artist', 'dj'\]\)/)
  assert.match(rules, /resource\.data\.roles\.hasAny\(\['admin'\]\)[\s\S]*?request\.resource\.data\.roles == resource\.data\.roles/)
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
