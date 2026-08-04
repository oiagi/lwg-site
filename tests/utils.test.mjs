// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickDefined,
  hasFields,
  normalizePageLanguage,
  capitalizeWords,
  capitalizeNameFields,
  signOAuthState,
  verifyOAuthState,
} from '../functions/api/_utils.js';

test('pickDefined keeps only defined listed fields', () => {
  const src = { a: 1, b: undefined, c: null, d: 'x' };
  assert.deepEqual(pickDefined(src, ['a', 'b', 'c', 'missing']), { a: 1, c: null });
});

test('hasFields', () => {
  assert.equal(hasFields({}), false);
  assert.equal(hasFields({ a: 1 }), true);
});

test('normalizePageLanguage falls back for unknown values', () => {
  assert.equal(normalizePageLanguage('de'), 'de');
  assert.equal(normalizePageLanguage('en'), 'en');
  assert.equal(normalizePageLanguage('fr'), 'en');
  assert.equal(normalizePageLanguage(undefined, 'de'), 'de');
});

test('capitalizeWords uppercases word starts incl. hyphens, keeps existing caps', () => {
  assert.equal(capitalizeWords('anna-lena meier'), 'Anna-Lena Meier');
  assert.equal(capitalizeWords('mcDonald'), 'McDonald');
  assert.equal(capitalizeWords('züri west'), 'Züri West');
  assert.equal(capitalizeWords('a.b/c'), 'A.B/C');
  assert.equal(capitalizeWords(42), 42); // non-strings pass through
});

test('OAuth state signing round-trips and rejects tampering', async () => {
  const env = { GOOGLE_CLIENT_SECRET: 'test-secret' };
  const teacherId = '4f9c2f6a-0000-4000-8000-123456789abc';
  const state = await signOAuthState(teacherId, env);
  assert.equal(await verifyOAuthState(state, env), teacherId);

  // Tampered teacher id, tampered mac, wrong key, and garbage all fail.
  const [, expires, mac] = state.split('.');
  assert.equal(await verifyOAuthState(`other-id.${expires}.${mac}`, env), null);
  assert.equal(await verifyOAuthState(state.slice(0, -1) + '0', env), null);
  assert.equal(await verifyOAuthState(state, { GOOGLE_CLIENT_SECRET: 'wrong' }), null);
  assert.equal(await verifyOAuthState('not-a-state', env), null);
  assert.equal(await verifyOAuthState(null, env), null);

  // Expired state fails: rebuild with a past expiry and a valid-shape mac.
  assert.equal(await verifyOAuthState(`${teacherId}.1000.${mac}`, env), null);
});

test('capitalizeNameFields mutates only present string fields', () => {
  const data = { first_name: 'anna', last_name: null, city: 'zürich', other: 'stays' };
  const out = capitalizeNameFields(data);
  assert.equal(out, data);
  assert.equal(data.first_name, 'Anna');
  assert.equal(data.last_name, null);
  assert.equal(data.city, 'Zürich');
  assert.equal(data.other, 'stays');
  assert.equal(capitalizeNameFields(null), null);
});
