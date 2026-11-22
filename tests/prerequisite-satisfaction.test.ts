import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {Course, CourseDataset, Requirement} from '../src/types';
import {evaluatePrerequisites} from '../src/lib/prerequisite-satisfaction';
import {collectRequirements} from '../src/lib/graph';
import {decodeProgress, defaultProgress, encodeProgress, validateProgress, type ProgressDatabase} from '../src/lib/progress';

const leaf = (courseId: string, relation: 'strong' | 'concurrent' = 'strong'): Requirement => ({type: 'course', courseId, relation});
const and = (...items: Requirement[]): Requirement => ({type: 'and', items});
const or = (...items: Requirement[]): Requirement => ({type: 'or', items});
const course = (id: string, requirements: Requirement | null = null, requirementsStatus: Course['requirementsStatus'] = requirements ? 'known' : 'none'): Course => ({id, name: id, faculty: 'test', requirements, requirementsStatus, source: {url: 'https://example.test'}});
const state = (requirements: Requirement, marks: string[] = []) => evaluatePrerequisites(course('target', requirements), new Set(marks)).status;
const dataset = JSON.parse(readFileSync(new URL('../public/data/courses.json', import.meta.url), 'utf8')) as CourseDataset;
const records = new Map(dataset.courses.map(c => [c.id, c]));
const catalogReferences = (JSON.parse(readFileSync(new URL('../public/data/catalogs.json', import.meta.url), 'utf8')) as {referencedCourses: Course[]}).referencedCourses;

test('one direct mandatory prerequisite requires its mark, not the target mark', () => {
  assert.equal(state(leaf('A')), 'unsatisfied');
  assert.equal(state(leaf('A'), ['target']), 'unsatisfied');
  assert.equal(state(leaf('A'), ['A']), 'satisfied');
});

test('AND requires every ordinary prerequisite', () => {
  const rule = and(leaf('A'), leaf('B'));
  for (const marks of [[], ['A'], ['B']]) assert.equal(state(rule, marks), 'unsatisfied');
  assert.equal(state(rule, ['A', 'B']), 'satisfied');
});

test('OR accepts any complete valid alternative', () => {
  const rule = or(leaf('A'), leaf('B'));
  assert.equal(state(rule), 'unsatisfied');
  for (const marks of [['A'], ['B'], ['A', 'B']]) assert.equal(state(rule, marks), 'satisfied');
});

test('mixed and deeply nested groups retain their original grouping', () => {
  const rule = and(or(leaf('A'), and(leaf('B'), or(leaf('C'), leaf('D')))), leaf('E'));
  for (const marks of [['A', 'E'], ['B', 'C', 'E'], ['B', 'D', 'E']]) assert.equal(state(rule, marks), 'satisfied');
  for (const marks of [['A'], ['B', 'E'], ['C', 'D', 'E']]) assert.equal(state(rule, marks), 'unsatisfied');
});

test('confirmed no prerequisites is distinct from missing, unparsed or inconsistent information', () => {
  assert.equal(evaluatePrerequisites(course('none'), new Set()).status, 'satisfied');
  for (const status of ['unknown', 'unparsed', 'known'] as const) assert.equal(evaluatePrerequisites(course('x', null, status), new Set()).status, 'unknown');
  assert.equal(evaluatePrerequisites(undefined, new Set()).status, 'unknown');
  assert.equal(evaluatePrerequisites(course('bad', leaf('A'), 'none'), new Set(['A'])).status, 'unknown');
  assert.equal(state(and()), 'unknown'); assert.equal(state(or()), 'unknown');
});

test('concurrent requirements are kept separate and do not block ordinary satisfaction', () => {
  const result = evaluatePrerequisites(course('x', and(leaf('A'), or(leaf('B', 'concurrent'), leaf('C', 'concurrent')))), new Set(['A']));
  assert.deepEqual(result, {status: 'satisfied', hasOrdinary: true, hasConcurrent: true});
  assert.equal(state(and(leaf('A'), leaf('B', 'concurrent')), ['B']), 'unsatisfied');
  assert.deepEqual(evaluatePrerequisites(course('x', leaf('B', 'concurrent')), new Set()), {status: 'satisfied', hasOrdinary: false, hasConcurrent: true});
});

test('an ordinary OR concurrent-only alternative is conservative rather than an automatic green result', () => {
  const rule = or(leaf('A'), leaf('B', 'concurrent'));
  assert.equal(state(rule), 'unknown'); assert.equal(state(rule, ['B']), 'unknown');
  assert.equal(state(rule, ['A']), 'satisfied');
  assert.equal(state(and(rule, leaf('C')), ['C']), 'unknown');
  assert.equal(state(and(rule, leaf('C'))), 'unsatisfied');
});

test('marking, unmarking and clearing react solely to the current authoritative set', () => {
  const target = course('target', and(leaf('A'), leaf('B'))), marks = new Set(['A']);
  assert.equal(evaluatePrerequisites(target, marks).status, 'unsatisfied');
  marks.add('B'); assert.equal(evaluatePrerequisites(target, marks).status, 'satisfied');
  marks.delete('A'); assert.equal(evaluatePrerequisites(target, marks).status, 'unsatisfied');
  marks.clear(); assert.equal(evaluatePrerequisites(target, marks).status, 'unsatisfied');
});

test('prerequisites use direct IDs without demanding marked transitive ancestors or graph membership', () => {
  const ancestor = course('A'), direct = course('B', leaf('A')), target = course('C', leaf('B'));
  const marks = new Set(['B']); // B is neither added nor visible; A is unmarked.
  assert.equal(evaluatePrerequisites(target, marks).status, 'satisfied');
  assert.equal(evaluatePrerequisites(direct, marks).status, 'unsatisfied');
  assert.equal(evaluatePrerequisites(ancestor, marks).status, 'satisfied');
  const restored = new Set<string>(JSON.parse(JSON.stringify([...marks])));
  assert.deepEqual(evaluatePrerequisites(target, restored), evaluatePrerequisites(target, marks));
});

test('real Algorithms 1, Computability and Data Structures formulas retain AND and OR', () => {
  const algorithms = records.get('02340247')!, comp = records.get('02360343')!, structures = records.get('02340218')!;
  assert.equal(evaluatePrerequisites(algorithms, new Set(['02340218'])).status, 'unsatisfied');
  assert.equal(evaluatePrerequisites(algorithms, new Set(['02340218', '02340141'])).status, 'satisfied');
  assert.equal(evaluatePrerequisites(comp, new Set(['02340247'])).status, 'satisfied');
  assert.equal(evaluatePrerequisites(comp, new Set(['01040291'])).status, 'satisfied');
  assert.equal(evaluatePrerequisites(structures, new Set(['02340124'])).status, 'unsatisfied');
  assert.equal(evaluatePrerequisites(structures, new Set(['02340124', '01040286'])).status, 'satisfied');
});

test('real ordinary-plus-concurrent formula is satisfied without marking its corequisite', () => {
  const target = records.get('00940210')!;
  assert.deepEqual(evaluatePrerequisites(target, new Set(['02340111'])), {status: 'satisfied', hasOrdinary: true, hasConcurrent: true});
  assert.equal(evaluatePrerequisites(target, new Set(['00940219'])).status, 'unsatisfied');
  assert.deepEqual(evaluatePrerequisites(records.get('00940222'), new Set()), {status: 'satisfied', hasOrdinary: false, hasConcurrent: true});
});

test('all actual known formulas are satisfiable by their ordinary IDs while unparsed records remain unknown', () => {
  for (const target of [...dataset.courses, ...catalogReferences]) {
    const ordinaryMarks = new Set(collectRequirements(target.requirements).filter(r => r.relation === 'strong').map(r => r.courseId));
    const result = evaluatePrerequisites(target, ordinaryMarks);
    assert.equal(result.status, ['known', 'none'].includes(target.requirementsStatus) ? 'satisfied' : 'unknown', target.id);
  }
});

const db: ProgressDatabase = {courses: records, facultyIds: new Set(['cs']), programs: [], years: ['2025-2026'], defaultYear: '2025-2026', defaultRoot: '02340114'};
test('highlight preference is OFF in defaults and older saves; invalid values are not truthy enabled', () => {
  assert.equal(defaultProgress(db).highlightSatisfiedPrerequisites, false);
  assert.equal(validateProgress({primaryCourseId: '02340114', addedCourseIds: []}, db).highlightSatisfiedPrerequisites, false);
  for (const value of ['true', 1, {}, [], null]) assert.equal(validateProgress({highlightSatisfiedPrerequisites: value}, db).highlightSatisfiedPrerequisites, false);
});

test('preference and marked IDs round-trip together without resetting graph progress', () => {
  const saved = {...defaultProgress(db), primaryCourseId: '02340247', addedCourseIds: ['02340247'], expandedForward: ['02340247'], markedCourseIds: ['02340218', '02340141'], highlightSatisfiedPrerequisites: true};
  const restored = validateProgress(decodeProgress(encodeProgress(saved)), db);
  assert.equal(restored.highlightSatisfiedPrerequisites, true);
  assert.deepEqual(restored.markedCourseIds, saved.markedCourseIds);
  assert.deepEqual(restored.expandedForward, saved.expandedForward);
  assert.equal(evaluatePrerequisites(records.get('02340247'), new Set(restored.markedCourseIds)).status, 'satisfied');
  assert.equal(validateProgress(decodeProgress(encodeProgress({...saved, highlightSatisfiedPrerequisites: false})), db).highlightSatisfiedPrerequisites, false);
});
