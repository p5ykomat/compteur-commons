import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseLanguage, t } from '../src/i18n.js';
test('language preference takes precedence over browser, with English fallback', () => {
  assert.equal(chooseLanguage('en', 'fr-FR'), 'en');
  assert.equal(chooseLanguage('fr', 'en-US'), 'fr');
  assert.equal(chooseLanguage(null, 'fr-CA'), 'fr');
  assert.equal(chooseLanguage(null, 'de-DE'), 'en');
  assert.equal(chooseLanguage('invalid', 'en'), 'en');
});
test('message interpolation does not alter source values', () => {
  assert.equal(t`Repérage des fichiers : ${42}`, 'Repérage des fichiers : 42');
  assert.equal(t('File:Source.jpg'), 'File:Source.jpg');
});
