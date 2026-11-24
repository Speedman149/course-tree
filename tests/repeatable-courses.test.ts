import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveCourseId} from '../src/lib/graph';
import type {Course} from '../src/types';
import {REPEATABLE_COURSES, repeatRule, markedQuantity, normalizeMarkedQuantities} from '../src/lib/repeatable-courses';
import {emptyMarkedCourses, setCourseMarked, setMarkedQuantity} from '../src/lib/marked-courses';
import {summarizeMarkedCredits} from '../src/lib/marked-credits';
import {decodeProgress, defaultProgress, encodeProgress, validateProgress, type ProgressDatabase} from '../src/lib/progress';
const course = (id: string, credits?: number): Course => ({id, credits, name: 'נבחרות ספורט משחקי כדור', faculty: 'sport', requirements: null, requirementsStatus: 'none', source: {url: 'https://example.test'}});
const team = course('03940902', 1.5), ball = course('03940803', 1), regular = course('02340114', 3.5), unknown = course('01040031');
const courses = new Map([team, ball, regular, unknown].map(c => [c.id, c]));
const db: ProgressDatabase = {courses, facultyIds: new Set(['sport']), programs: [], years: ['2025-2026'], defaultYear: '2025-2026', defaultRoot: regular.id};

const whitelist = ['03940800','03940801','03940802','03940803','03940804','03940805','03940806','03940807','03940808','03940809','03940810','03940820','03940900','03940901','03940902'];
const missing = ['03940809','03940810'];

test('only explicit whitelist IDs and exact old/new forms or source aliases grant repeated counting', () => {
  assert.deepEqual(Object.keys(REPEATABLE_COURSES), whitelist);
  for (const id of whitelist) {
    for (const form of [id, id.slice(1), `394${id.slice(5)}`]) assert.equal(repeatRule(course(form, 1))?.maxCountedOccurrences, 8);
  }
  for (const c of [regular, unknown, undefined, course('00940820', 2), {...course('00940820', 2), aliases: ['940820','094820','94820']}]) assert.equal(repeatRule(c), null);
  assert.ok(repeatRule({...ball, id: 'renumbered', aliases: ['394803']}));
  assert.equal(repeatRule({...ball, id: 'renumbered', aliases: ['03940803','394902']}), null); // conflicting rule metadata
  assert.ok(repeatRule({...team, credits: undefined}));
  assert.ok(repeatRule({...team, credits: 2.25})); // source credits are never hardcoded in eligibility
  assert.equal(markedQuantity(regular, {[regular.id]: 8}), 1);
});

test('runtime database intersection finds thirteen whitelist courses, skips two absent IDs, and excludes accounting', () => {
  const sap = JSON.parse(readFileSync(new URL('../public/data/courses.json', import.meta.url), 'utf8')).courses as Course[];
  const catalog = JSON.parse(readFileSync(new URL('../public/data/catalogs.json', import.meta.url), 'utf8')).referencedCourses as Course[];
  const primaryIds = new Set(sap.map(c => c.id));
  const records = [...sap, ...catalog.filter(c => !primaryIds.has(c.id))];
  const index = new Map(records.map(c => [c.id, c]));
  const found = whitelist.filter(id => index.has(id));
  assert.deepEqual(found, whitelist.filter(id => !missing.includes(id)));
  assert.deepEqual(whitelist.filter(id => !index.has(id)), missing);
  for (const id of found) {
    if (index.get(id)?.aliases?.length) assert.equal(resolveCourseId(`394${id.slice(5)}`, index), id);
    assert.ok(repeatRule(index.get(id)));
  }
  assert.equal(repeatRule(index.get('00940820')), null);
  assert.deepEqual(records.filter(c => repeatRule(c)).map(c => c.id).sort(), found.toSorted());
  const quantities = Object.fromEntries(found.map(id => [id, 2]));
  assert.deepEqual(summarizeMarkedCredits(index, found, quantities), {knownCredits: 25, missingCreditCount: 1});
  assert.equal(index.get('03940901')?.catalogOnly, true);
  assert.equal(index.get('03940901')?.credits, undefined);
});

test('quantity normalization rejects malformed, inherited, orphan and unsupported entries and bounds documented range', () => {
  for (const value of [0, -1, 1.5, NaN, Infinity, '3', true, null, {}, []]) assert.deepEqual(normalizeMarkedQuantities(courses, [team.id], {[team.id]: value}), {});
  assert.deepEqual(normalizeMarkedQuantities(courses, [team.id, ball.id, regular.id], {[team.id]: 100, [ball.id]: 5, [regular.id]: 2, orphan: 2}), {[team.id]: 8, [ball.id]: 5});
  assert.deepEqual(normalizeMarkedQuantities(courses, [team.id], Object.create({[team.id]: 4})), {});
  assert.deepEqual(normalizeMarkedQuantities(courses, [], {[team.id]: 4}), {});
  assert.deepEqual(normalizeMarkedQuantities(courses, [team.id], JSON.parse('{"__proto__":{"polluted":true}}')), {});
  assert.equal(({} as {polluted?: boolean}).polluted, undefined);
});

test('quantity changes preserve marking identity, graph uniqueness, and other course markings; removal clears all instances', () => {
  let state = setCourseMarked(emptyMarkedCourses(), team.id, true);
  state = setCourseMarked(state, regular.id, true);
  const ids = state.ids;
  for (let i = 2; i <= 10; i++) state = setMarkedQuantity(state, team, i);
  assert.equal(state.ids, ids);
  assert.deepEqual([...state.ids], [team.id, regular.id]);
  assert.equal(markedQuantity(team, state.quantities), 8);
  state = setMarkedQuantity(state, team, 2);
  assert.equal(summarizeMarkedCredits(courses, state.ids, state.quantities).knownCredits, 6.5);
  state = setMarkedQuantity(state, team, 1);
  assert.deepEqual(state.quantities, {});
  state = setMarkedQuantity(state, team, 3);
  state = setCourseMarked(state, team.id, false);
  assert.deepEqual(state.quantities, {});
  assert.deepEqual([...state.ids], [regular.id]);
  assert.equal(setMarkedQuantity(state, team, 4), state); // orphan cannot resurrect a mark
  state = setCourseMarked(state, team.id, true);
  assert.equal(markedQuantity(team, state.quantities), 1);
  assert.deepEqual(emptyMarkedCourses().quantities, {});
});

test('totals multiply verified occurrences, preserve fractions and unknown warnings, ignore duplicate appearances and unmarked quantities', () => {
  const aliases = new Map(courses); aliases.set('team-alias', team);
  const quantities = {[team.id]: 3, [regular.id]: 20, [unknown.id]: 3, [ball.id]: 8};
  assert.deepEqual(summarizeMarkedCredits(aliases, [team.id, team.id, 'team-alias', regular.id, unknown.id], quantities), {knownCredits: 8, missingCreditCount: 1});
  assert.equal(summarizeMarkedCredits(courses, [team.id], {[team.id]: 999}).knownCredits, 12);
  assert.deepEqual(summarizeMarkedCredits(courses, [], quantities), {knownCredits: 0, missingCreditCount: 0});
  const changed = new Map(courses); changed.set(team.id, {...team, credits: undefined});
  assert.deepEqual(summarizeMarkedCredits(changed, [team.id], quantities), {knownCredits: 0, missingCreditCount: 1});
});

test('v1–v5 markings migrate to one without losing graph, additions, filters, highlights or viewport', () => {
  const prior = {...defaultProgress(db), addedCourseIds: [regular.id, team.id], markedCourseIds: [team.id, regular.id], markedCourseQuantities: {[team.id]: 5}, facultyIds: ['sport'], searchAll: true, highlightSatisfiedPrerequisites: true, expandedForward: [regular.id], recent: [ball.id], viewport: {x: 50, y: 20, zoom: .7}};
  for (const version of [1, 2, 3, 4, 5]) {
    const migrated = validateProgress(decodeProgress(JSON.stringify({version, progress: prior})), db);
    assert.deepEqual(migrated, {...prior, markedCourseQuantities: {}});
    assert.equal(markedQuantity(team, migrated.markedCourseQuantities), 1);
  }
});

test('v6 quantities round trip across root/filter changes and reset defaults remove every repetition', () => {
  const current = {...defaultProgress(db), markedCourseIds: [team.id, regular.id], markedCourseQuantities: {[team.id]: 4}};
  const restored = validateProgress(decodeProgress(encodeProgress(current)), db);
  assert.deepEqual(restored, current);
  const changed = validateProgress({...restored, facultyIds: [], searchAll: true}, db, ball.id);
  assert.deepEqual(changed.markedCourseQuantities, current.markedCourseQuantities);
  assert.deepEqual(changed.markedCourseIds, current.markedCourseIds);
  assert.deepEqual(defaultProgress(db).markedCourseQuantities, {});
  const invalid = validateProgress({...current, markedCourseQuantities: {[team.id]: 999, [ball.id]: 4, [regular.id]: 3}}, db);
  assert.deepEqual(invalid.markedCourseQuantities, {[team.id]: 8}); // ball is unmarked: its quantity remains an orphan
});

test('all repeated subtotals use current fractional database credits, including changed team credits and unknown values', () => {
  const updated = new Map(courses);
  updated.set(team.id, {...team, credits: 2.25}); updated.set(ball.id, {...ball, credits: .75});
  const quantities = {[team.id]: 3, [ball.id]: 4, [regular.id]: 9};
  assert.equal(summarizeMarkedCredits(updated, [team.id, ball.id, regular.id], quantities).knownCredits, 13.25);
  updated.set(ball.id, {...ball, credits: undefined});
  assert.deepEqual(summarizeMarkedCredits(updated, [team.id, ball.id, regular.id], quantities), {knownCredits: 10.25, missingCreditCount: 1});
  const current = {...defaultProgress(db), markedCourseIds: [team.id, ball.id], markedCourseQuantities: quantities};
  assert.deepEqual(validateProgress(decodeProgress(encodeProgress(current)), {...db, courses: updated}).markedCourseQuantities, {[team.id]: 3, [ball.id]: 4});
});

test('a database record using the six-digit form retains its quantity and actual credits through persistence', () => {
  const legacy = course('394803', 1.25);
  const database = {...db, courses: new Map([...courses, [legacy.id, legacy]])};
  const state = {...defaultProgress(database), markedCourseIds: [legacy.id, team.id], markedCourseQuantities: {[legacy.id]: 3, [team.id]: 4}};
  const restored = validateProgress(decodeProgress(encodeProgress(state)), database);
  assert.deepEqual(restored.markedCourseQuantities, state.markedCourseQuantities);
  assert.equal(summarizeMarkedCredits(database.courses, restored.markedCourseIds, restored.markedCourseQuantities).knownCredits, 9.75);
});
