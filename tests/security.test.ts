import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCourseDataset, validateCatalogDataset, readDatasetJSON, MAX_DATASET_BYTES } from '../src/lib/data-validation';
import { officialSourceURL } from '../src/lib/urls';
import { redactAnalyticsEvent } from '../src/lib/analytics';
import { buildGraph, buildCourseIndex, buildDependents, collectRequirements, instanceId, MAX_GRAPH_DEPTH, MAX_GRAPH_NODES, resolveCourseId } from '../src/lib/graph';
import { decodeProgress, validateProgress } from '../src/lib/progress';
import { validateFeedback, feedbackPageURL, feedbackErrorMessage } from '../src/lib/feedback';
import type { Course, CourseDataset, CatalogDataset, Requirement } from '../src/types';

const courses: CourseDataset = JSON.parse(readFileSync(new URL('../public/data/courses.json', import.meta.url), 'utf8'));
const catalogs: CatalogDataset = JSON.parse(readFileSync(new URL('../public/data/catalogs.json', import.meta.url), 'utf8'));

test('security validation accepts the complete published datasets without transforming academic data', () => {
  assert.equal(validateCourseDataset(courses), courses);
  assert.equal(validateCatalogDataset(catalogs), catalogs);
});

for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', '//evil.example/a', 'https://technion.ac.il.evil.example/a', 'https://technion.ac.il@evil.example/a', 'https://user:pass@portalex.technion.ac.il/a', 'http://portalex.technion.ac.il/a', 'https://portalex.technion.ac.il:444/a', 'https://portalex.technion.ac.il/\n@evil.example', 'https://portalex.technion.ac.il\\@evil.example']) {
  test('academic link rejects ' + JSON.stringify(url), () => assert.equal(officialSourceURL(url), undefined));
}
test('official links retain legitimate Technion hosts, encoded Hebrew, query strings, and PDF pages', () => {
  for (const url of ['https://portalex.technion.ac.il/ovv/?sap-language=HE#/details/2026/200/SM/02340114', 'https://ugportal.technion.ac.il/a%20b.pdf#page=124', 'https://undergraduate.cs.technion.ac.il/', 'https://ece.technion.ac.il/']) {
    assert.equal(officialSourceURL(url), url);
  }
});

for (const [label, mutate] of [
  ['wrong name type', (data: CourseDataset) => { data.courses[0].name = {} as string; }],
  ['invalid alias', (data: CourseDataset) => { data.courses[0].aliases = ['<script>']; }],
  ['duplicate ID', (data: CourseDataset) => { data.courses.push(data.courses[0]); }],
  ['dangerous source', (data: CourseDataset) => { data.courses[0].source.url = 'javascript:alert(1)'; }],
  ['broken prerequisite shape', (data: CourseDataset) => { data.courses[0].requirements = { type: 'and', items: 'oops' } as unknown as Requirement; }],
  ['invalid prerequisite ID', (data: CourseDataset) => { data.courses[0].requirements = { type: 'course', courseId: '__proto__', relation: 'strong' }; }],
  ['oversized course name', (data: CourseDataset) => { data.courses[0].name = 'א'.repeat(2001); }],
  ['unsafe metadata coercion', (data: CourseDataset) => { data.meta.termCount = { toString: 'oops' }; }],
] as const) {
  test('malformed course dataset fails safely for ' + label, () => {
    const data = structuredClone(courses);
    mutate(data);
    assert.throws(() => validateCourseDataset(data), /Invalid academic dataset/);
  });
}
for (const [label, mutate] of [
  ['wrong years type', (data: CatalogDataset) => { data.meta.years = {} as string[]; }],
  ['duplicate edition', (data: CatalogDataset) => { data.programs.push(data.programs[0]); }],
  ['invalid group conditions', (data: CatalogDataset) => { data.programs.find(p => p.electiveGroups.length)!.electiveGroups[0].conditions = [null] as unknown as string[]; }],
  ['dangerous PDF URL', (data: CatalogDataset) => { data.sources[0].url = 'data:text/html,test'; }],
  ['malformed completion rule', (data: CatalogDataset) => { data.programs[0].requirementRules = [{ type: 'choose', items: {} }] as never; }],
] as const) {
  test('malformed catalog fails safely for ' + label, () => {
    const data = structuredClone(catalogs);
    mutate(data);
    assert.throws(() => validateCatalogDataset(data), /Invalid academic dataset/);
  });
}

test('deep or cyclic prerequisite objects are rejected before recursive UI rendering', () => {
  const data = structuredClone(courses);
  let requirement: Requirement = { type: 'course', courseId: '02340114', relation: 'strong' };
  for (let i = 0; i < 1000; i++) requirement = { type: 'and', items: [requirement] };
  data.courses[0].requirements = requirement;
  assert.throws(() => validateCourseDataset(data), /Invalid academic dataset/);
  const cyclic: Requirement = { type: 'and', items: [] };
  cyclic.items.push(cyclic);
  data.courses[0].requirements = cyclic;
  assert.throws(() => validateCourseDataset(data), /Invalid academic dataset/);
  assert.deepEqual(collectRequirements(cyclic), []);
});

test('HTML-looking academic names, Hebrew, and mathematical notation remain ordinary strings', () => {
  const data = structuredClone(courses);
  const name = '<img src=x onerror=alert(1)> מתמטיקה ∫ f(x) dx';
  data.courses[0].name = name;
  assert.equal(validateCourseDataset(data).courses[0].name, name);
});

test('dataset reader rejects malformed JSON and advertised or streamed oversized content', async () => {
  await assert.rejects(readDatasetJSON(new Response('{broken')));
  await assert.rejects(readDatasetJSON(new Response('{}', { headers: { 'content-length': String(MAX_DATASET_BYTES + 1) } })));
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array(MAX_DATASET_BYTES + 1)); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(readDatasetJSON(new Response(stream)), /too large/);
  assert.equal(cancelled, true);
  assert.deepEqual(await readDatasetJSON(new Response('{"name":"קורס ∫"}')), { name: 'קורס ∫' });
});

const mockCourse = (id: string, requirements: Requirement | null = null): Course => ({
  id, name: id, faculty: 'הפקולטה למדעי המחשב', requirements,
  requirementsStatus: requirements ? 'known' : 'none',
  source: { url: 'https://portalex.technion.ac.il/' },
});
const requirement = (id: string): Requirement => ({ type: 'course', courseId: id, relation: 'strong' });

test('wide shared graphs stay bounded with valid edges and retain expansion state', () => {
  const root = '00000001';
  const parents = Array.from({ length: 100 }, (_, i) => String(i + 100).padStart(8, '0'));
  const leaves = Array.from({ length: 100 }, (_, i) => String(i + 1000).padStart(8, '0'));
  const data = [mockCourse(root), ...parents.map(id => mockCourse(id, requirement(root))),
    ...leaves.map(id => mockCourse(id, { type: 'and', items: parents.map(requirement) }))];
  const expanded = new Set(['root', ...parents.map(id => instanceId('root', 'forward', id, 'strong'))]);
  const graph = buildGraph(root, buildCourseIndex(data), buildDependents(data), expanded, new Map());
  assert.equal(graph.nodes.length, MAX_GRAPH_NODES);
  assert.equal(graph.truncated, true);
  assert.equal(expanded.size, 101);
  const ids = new Set(graph.nodes.map(node => node.id));
  assert.equal(graph.edges.every(edge => ids.has(edge.source) && ids.has(edge.target)), true);
  const smaller = buildGraph(root, buildCourseIndex(data), buildDependents(data), new Set(['root']), new Map());
  assert.equal(smaller.nodes.length, 101);
  assert.equal(smaller.truncated, undefined);
});

test('deep expansion and cyclic course references terminate without dangling edges', () => {
  const data = Array.from({ length: 150 }, (_, i) => mockCourse(String(i + 1).padStart(8, '0'), i ? requirement(String(i).padStart(8, '0')) : null));
  const expanded = new Set(['root']);
  let path = 'root';
  for (const row of data.slice(1)) { path = instanceId(path, 'forward', row.id, 'strong'); expanded.add(path); }
  const graph = buildGraph(data[0].id, buildCourseIndex(data), buildDependents(data), expanded, new Map());
  assert.equal(graph.nodes.length, MAX_GRAPH_DEPTH + 1);
  assert.equal(graph.truncated, true);
  const cyclic = [mockCourse('00000001', requirement('00000002')), mockCourse('00000002', requirement('00000001'))];
  const child = instanceId('root', 'forward', '00000002', 'strong');
  const cycle = buildGraph('00000001', buildCourseIndex(cyclic), buildDependents(cyclic), new Set(['root', child]), new Map());
  assert.equal(cycle.nodes.length, 3);
  assert.equal(cycle.nodes[2].cycle, true);
});

test('malformed storage preserves valid markings and safely drops hostile fields', () => {
  const index = buildCourseIndex(courses.courses);
  const db = { courses: index, programs: catalogs.programs, facultyIds: new Set(['cs']), years: catalogs.meta.years, defaultRoot: '02340114', defaultYear: '2025-2026' };
  const raw = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}');
  Object.assign(raw, { rootId: '02340114', markedCourseIds: ['02340114', {}, 'invalid'], expandedForward: ['root', 'root/f:__proto__:strong', {}], expandedBackward: [{}, ['root', [null, '__proto__']]], viewport: { x: Infinity, y: {}, zoom: -1 }, facultyIds: ['cs', {}], catalogId: {} });
  const safe = validateProgress(raw, db);
  assert.deepEqual(safe.markedCourseIds, ['02340114']);
  assert.deepEqual(safe.expandedForward, ['root']);
  assert.deepEqual(safe.expandedBackward, []);
  assert.equal(safe.viewport, null);
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
  assert.equal(decodeProgress('{broken'), null);
  assert.equal(decodeProgress(JSON.stringify({ version: 999, progress: raw })), null);
  assert.equal(decodeProgress(' '.repeat(2_000_001)), null);
  assert.deepEqual(validateProgress({ ...raw, expandedForward: Array(50_000).fill('root') }, db).expandedForward, ['root']);
  assert.equal(resolveCourseId('0'.repeat(100_000), index), null);
});

test('analytics redacts arbitrary query, fragments and unsupported paths while preserving event type', () => {
  const redacted = redactAnalyticsEvent({ type: 'pageview', url: 'https://course.example/feedback?email=person@example.com&token=secret#private' });
  assert.deepEqual(redacted, { type: 'pageview', url: 'https://course.example/feedback' });
  assert.equal(redactAnalyticsEvent({ type: 'pageview', url: 'https://course.example/private/person?email=test' })?.url, 'https://course.example/');
  assert.equal(redactAnalyticsEvent({ type: 'pageview', url: 'javascript:alert(1)' }), null);
  assert.equal(feedbackPageURL('https://course.example/?token=secret&course=02340114#<script>'), 'https://course.example/?course=02340114');
});

test('feedback validation rejects oversized descriptions, invalid emails, IDs and response HTML', () => {
  const valid = { category: 'bug', description: '<img src=x onerror=alert(1)> תקלה בבחירת קורס', course_number: '02340114', email: 'student@example.com' };
  assert.deepEqual(validateFeedback(valid), {});
  for (const email of ['x@y\r\nBcc:other@example.com', 'javascript:alert(1)', 'a'.repeat(255) + '@x.com']) assert.ok(validateFeedback({ ...valid, email }).email);
  assert.ok(validateFeedback({ ...valid, description: 'x'.repeat(5001) }).description);
  assert.ok(validateFeedback({ ...valid, course_number: '__proto__' }).course_number);
  assert.doesNotMatch(feedbackErrorMessage([{ code: 'UNKNOWN', message: '<script>alert(1)</script>' }]), /<script>/);
});
