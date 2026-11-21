import test from 'node:test';
import assert from 'node:assert/strict';
import type {Course} from '../src/types';
import {creditTotalFormat, summarizeMarkedCredits} from '../src/lib/marked-credits';

const course = (id: string, credits?: number): Course => ({id, name: id, credits, faculty: '', requirements: null, requirementsStatus: 'none', source: {url: 'https://example.test'}});
const index = new Map([course('A', 3), course('B', 4.5), course('C', 3), course('zero', 0), course('unknown')].map(c => [c.id, c]));

test('marked credits update with marks, unmarks and clearing; unmarked additions do not count', () => {
  const marked = new Set(['A']);
  assert.deepEqual(summarizeMarkedCredits(index, marked), {knownCredits: 3, missingCreditCount: 0});
  marked.add('B'); marked.add('C');
  assert.equal(summarizeMarkedCredits(index, marked).knownCredits, 10.5);
  marked.delete('A');
  assert.equal(summarizeMarkedCredits(index, marked).knownCredits, 7.5);
  marked.clear();
  assert.deepEqual(summarizeMarkedCredits(index, marked), {knownCredits: 0, missingCreditCount: 0});
});

test('all marked IDs count independently of visible graph nodes, filters or starting courses', () => {
  const marks = new Set(['B', 'C']);
  assert.equal(summarizeMarkedCredits(index, marks).knownCredits, 7.5);
  const restoredMarks = new Set<string>(JSON.parse(JSON.stringify([...marks])));
  assert.deepEqual(summarizeMarkedCredits(index, restoredMarks), summarizeMarkedCredits(index, marks));
});

test('duplicate appearances count once by canonical course ID', () => {
  const aliases = new Map(index); aliases.set('alias-A', index.get('A')!);
  assert.equal(summarizeMarkedCredits(aliases, ['A', 'A', 'alias-A', 'B']).knownCredits, 7.5);
});

test('missing or invalid credits stay distinct from a known zero', () => {
  const invalid = new Map(index);
  invalid.set('nan', course('nan', NaN)); invalid.set('infinite', course('infinite', Infinity)); invalid.set('negative', course('negative', -1));
  assert.deepEqual(summarizeMarkedCredits(invalid, ['B', 'zero', 'unknown', 'absent', 'absent', 'nan', 'infinite', 'negative']), {knownCredits: 4.5, missingCreditCount: 5});
  assert.deepEqual(summarizeMarkedCredits(index, ['zero']), {knownCredits: 0, missingCreditCount: 0});
});

test('fractional source values are not individually rounded and the display omits floating point noise', () => {
  const fractions = new Map([course('A', 1.125), course('B', 0.375), course('C', 0.1), course('D', 0.2)].map(c => [c.id, c]));
  assert.equal(summarizeMarkedCredits(fractions, ['A', 'B']).knownCredits, 1.5);
  assert.equal(creditTotalFormat.format(summarizeMarkedCredits(fractions, ['C', 'D']).knownCredits), '0.3');
  assert.equal(creditTotalFormat.format(summarizeMarkedCredits(fractions, ['A']).knownCredits), '1.125');
});
