// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../functions/api/_validate.js';

test('rejects non-object bodies', () => {
  assert.equal(validate(null, {}), 'Request body must be a JSON object');
  assert.equal(validate('hi', {}), 'Request body must be a JSON object');
  assert.equal(validate(undefined, {}), 'Request body must be a JSON object');
});

test('required rejects undefined, null and empty string', () => {
  const schema = { name: { required: true } };
  assert.equal(validate({}, schema), 'name is required');
  assert.equal(validate({ name: null }, schema), 'name is required');
  assert.equal(validate({ name: '' }, schema), 'name is required');
  assert.equal(validate({ name: 'x' }, schema), null);
  assert.equal(validate({ name: 0 }, schema), null); // 0 is a value
});

test('type checks apply only to present values', () => {
  const schema = { count: { type: 'number' } };
  assert.equal(validate({}, schema), null);
  assert.equal(validate({ count: 3 }, schema), null);
  assert.equal(validate({ count: '3' }, schema), 'count must be a number');
  assert.equal(validate({ count: NaN }, schema), 'count must be a number');
  assert.equal(validate({ list: [] }, { list: { type: 'array' } }), null);
  assert.equal(validate({ list: [] }, { list: { type: 'object' } }), 'list must be a object');
});

test('maxLength limits strings', () => {
  const schema = { name: { maxLength: 3 } };
  assert.equal(validate({ name: 'abc' }, schema), null);
  assert.equal(validate({ name: 'abcd' }, schema), 'name must be at most 3 characters');
});

test('email validation', () => {
  const schema = { email: { email: true } };
  assert.equal(validate({ email: 'a@b.ch' }, schema), null);
  assert.equal(validate({ email: 'not-an-email' }, schema), 'email must be a valid email address');
  assert.equal(validate({ email: 'a @b.ch' }, schema), 'email must be a valid email address');
  assert.equal(validate({}, schema), null); // optional unless required
});

test('oneOf restricts to allowed values', () => {
  const schema = { lang: { oneOf: ['en', 'de'] } };
  assert.equal(validate({ lang: 'en' }, schema), null);
  assert.equal(validate({ lang: 'fr' }, schema), 'lang must be one of: en, de');
});

test('first failing field wins', () => {
  const schema = {
    name: { required: true },
    email: { required: true, email: true },
  };
  assert.equal(validate({ email: 'bad' }, schema), 'name is required');
});
