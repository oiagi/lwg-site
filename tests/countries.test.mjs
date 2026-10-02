// Run with: node --test tests/
// Covers the shared country list in public/countries.js (a classic script
// that assigns globalThis.LWG_COUNTRIES, importable here because it has no
// imports or exports of its own) and the server-side label helper.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/countries.js';
import {
  normalizeCountry,
  countryValid,
  normalizeCountryFields,
  foreignCountryLabel,
} from '../functions/api/_utils.js';

const COUNTRIES = globalThis.LWG_COUNTRIES;

test('LWG_COUNTRIES lists Switzerland and its neighbours first', () => {
  assert.equal(COUNTRIES.DEFAULT, 'CH');
  assert.deepEqual(COUNTRIES.orderedCodes('en').slice(0, 6), ['CH', 'DE', 'AT', 'LI', 'FR', 'IT']);
  assert.equal(new Set(COUNTRIES.CODES).size, COUNTRIES.CODES.length);
  assert.ok(COUNTRIES.CODES.every((code) => /^[A-Z]{2}$/.test(code)));
});

test('LWG_COUNTRIES renders names in the page language', () => {
  assert.equal(COUNTRIES.name('DE', 'de'), 'Deutschland');
  assert.equal(COUNTRIES.name('DE', 'en'), 'Germany');
  assert.equal(COUNTRIES.name('ch', 'de'), 'Schweiz');
  assert.equal(COUNTRIES.name('', 'en'), '');
  // Codes ICU has no name for fall back to the code itself rather than throwing.
  assert.equal(COUNTRIES.name('AA', 'en'), 'AA');
});

test('LWG_COUNTRIES.foreignLine is empty for Switzerland only', () => {
  assert.equal(COUNTRIES.foreignLine('CH', 'de'), '');
  assert.equal(COUNTRIES.foreignLine('', 'de'), '');
  assert.equal(COUNTRIES.foreignLine(null, 'en'), '');
  assert.equal(COUNTRIES.foreignLine('DE', 'de'), 'Deutschland');
  assert.equal(COUNTRIES.foreignLine('fr', 'en'), 'France');
});

test('LWG_COUNTRIES orders the rest alphabetically in the chosen language', () => {
  const rest = COUNTRIES.orderedCodes('de').slice(6);
  const names = rest.map((code) => COUNTRIES.name(code, 'de'));
  const sorted = [...names].sort((a, b) => a.localeCompare(b, 'de'));
  assert.deepEqual(names, sorted);
});

test('server-side country helpers normalise and validate ISO codes', () => {
  assert.equal(normalizeCountry(' de '), 'DE');
  assert.equal(normalizeCountry(''), null);
  assert.equal(normalizeCountry(null), null);
  assert.ok(countryValid('CH'));
  assert.ok(!countryValid('Schweiz'));
  assert.ok(!countryValid(''));

  const data = { country: 'ch', billing_country: ' at ' };
  assert.equal(normalizeCountryFields(data), null);
  assert.deepEqual(data, { country: 'CH', billing_country: 'AT' });

  const bad = { country: 'Switzerland' };
  assert.equal(normalizeCountryFields(bad), 'country');

  assert.equal(foreignCountryLabel('CH', true), '');
  assert.equal(foreignCountryLabel('DE', true), 'Deutschland');
  assert.equal(foreignCountryLabel('DE', false), 'Germany');
});
