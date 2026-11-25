import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRESS_KEY, PROGRESS_VERSION, encodeProgress, decodeProgress, defaultProgress, validateProgress, type ProgressDatabase } from '../src/lib/progress';
import { forwardConnectionId, type CourseConnection } from '../src/lib/graph';
import type { Course, DegreeCatalog } from '../src/types';

const course = (id: string, requirements: Course['requirements'] = null): Course => ({
  id, name: id, faculty: 'test', requirements, requirementsStatus: requirements ? 'known' : 'none', source: { url: 'https://example.test' },
});
const leaf = (courseId: string) => ({ type: 'course', courseId, relation: 'strong' } as const);
const a = { ...course('02340114'), aliases: ['234114'] };
const b = course('02340218', leaf(a.id));
const c = course('02340247', leaf(b.id));
const d = course('01040031');
const e = course('01140051');
const db: ProgressDatabase = {
  courses: new Map([a, b, c, d, e].map(course => [course.id, course])),
  facultyIds: new Set(['cs', 'math']),
  programs: [{ id: 'cs-three-year-2025-2026', catalogYear: '2025-2026', facultyIds: ['cs'] } as DegreeCatalog],
  years: ['2025-2026', '2026-2027'], defaultYear: '2025-2026', defaultRoot: a.id,
};
function legacy(overrides: Record<string, unknown> = {}) {
  const { addedCourseIds: _pins, automaticConnections: _connections, ...preferences } = defaultProgress(db);
  return { ...preferences, rootId: a.id, expandedForward: ['root'], ...overrides };
}
const aToC: CourseConnection = {
  fromRootId: a.id, toRootId: c.id,
  steps: [
    { source: a.id, target: b.id, relation: 'strong', direction: 'forward' },
    { source: b.id, target: c.id, relation: 'strong', direction: 'forward' },
  ],
};

test('version7 progress round-trips equal ordered additions and canonical IDs without embedding course records', () => {
  const state = { ...defaultProgress(db), addedCourseIds: [a.id, d.id, c.id, b.id], markedCourseIds: [b.id, a.id], automaticConnections: [aToC] };
  assert.deepEqual(decodeProgress(encodeProgress(state)), state);
  assert.equal(PROGRESS_KEY, 'course-tree.progress');
  assert.equal(JSON.parse(encodeProgress(state)).version, PROGRESS_VERSION);
  assert.equal(PROGRESS_VERSION, 7);
  assert.equal(encodeProgress(state).includes('requirements'), false);
  assert.deepEqual(validateProgress(state, db), state);
});

test('corrupt, oversized, unsupported and absent storage safely fall back', () => {
  for (const raw of [null, '{oops', 'null', '[]', '{"version":999,"progress":{}}', '{"version":3,"progress":[]}', 'x'.repeat(2_000_001)]) assert.equal(decodeProgress(raw), null);
  assert.deepEqual(validateProgress(null, db), defaultProgress(db));
});

test('invalid individual courses, faculties and catalogs preserve unrelated progress', () => {
  const saved = { ...defaultProgress(db), addedCourseIds: [b.id, '99999999'], facultyIds: ['math', 'missing'], catalogId: 'gone', markedCourseIds: [b.id, '99999999'], recent: [a.id, '99999999'], viewport: { x: 20, y: 35, zoom: .7 } };
  const valid = validateProgress(saved, db);
  assert.deepEqual(valid.facultyIds, ['math']);
  assert.deepEqual(valid.markedCourseIds, [b.id]);
  assert.deepEqual(valid.addedCourseIds, [b.id]);
  assert.equal(valid.catalogId, '');
  assert.deepEqual(valid.recent, [a.id]);
  assert.deepEqual(valid.viewport, saved.viewport);
});

test('legacy forward/backward paths migrate only through actual source relationships', () => {
  const saved = legacy({ rootId: b.id, expandedForward: ['root/f:02340247:strong', 'root/f:99999999:strong', 'junk'], expandedBackward: [['root', [a.id, c.id]], ['root/f:02340247:strong', [b.id]], ['root/b:99999999:strong', [a.id]]], facultyIds: [] });
  const valid = validateProgress(saved, db);
  assert.deepEqual(valid.addedCourseIds, [b.id]);
  assert.deepEqual(valid.expandedForward, [c.id]);
  assert.deepEqual(valid.expandedBackward, [[b.id, [a.id]], [c.id, [b.id]]]);
  assert.deepEqual(valid.facultyIds, []);
});

test('a new URL course joins the saved collection without resetting branches, marks, filters or viewport', () => {
  const saved = { ...defaultProgress(db), addedCourseIds: [b.id, d.id], expandedForward: [b.id], markedCourseIds: [c.id], facultyIds: ['math'], viewport: { x: 10, y: 20, zoom: 1 }, expandedBackward: [[b.id, [a.id]]] };
  const valid = validateProgress(saved, db, c.id);
  assert.deepEqual(valid.addedCourseIds, [b.id,d.id,c.id]);
  assert.deepEqual(valid.markedCourseIds, [c.id]);
  assert.deepEqual(valid.facultyIds, ['math']);
  assert.deepEqual(valid.expandedBackward, saved.expandedBackward);
  assert.deepEqual(valid.expandedForward, [b.id]);
  assert.equal(valid.automaticConnections.length, 1);
  assert.equal(valid.automaticConnections[0].toRootId,c.id);
  assert.deepEqual(valid.viewport, saved.viewport);
});

test('any already-added URL including a legacy alias preserves the entire collection and shared state', () => {
  const saved = { ...defaultProgress(db), addedCourseIds: [a.id, d.id, c.id, b.id], expandedForward: [a.id, b.id, c.id], automaticConnections: [aToC], viewport: { x: 20, y: 30, zoom: .6 } };
  assert.deepEqual(validateProgress(saved, db, a.id), saved);
  assert.deepEqual(validateProgress(saved, db, '234114'), saved);
  const different = validateProgress(saved, db, c.id);
  assert.deepEqual(different,saved);
});

test('invalid legacy root discards only its graph state and retains marks/catalog selection', () => {
  const saved = legacy({ rootId: '99999999', catalogId: db.programs![0].id, markedCourseIds: [b.id], expandedForward: ['root/f:02340247:strong'] });
  const valid = validateProgress(saved, db);
  assert.deepEqual(valid.addedCourseIds, [a.id]);
  assert.equal('primaryCourseId' in valid,false);
  assert.equal(valid.catalogId, db.programs![0].id);
  assert.deepEqual(valid.markedCourseIds, [b.id]);
  assert.deepEqual(valid.expandedForward, [a.id]);
});

test('empty faculties, all-years browsing and a collapsed course survive', () => {
  const saved = { ...defaultProgress(db), facultyIds: [], catalogYear: '', expandedForward: [] };
  const valid = validateProgress(saved, db);
  assert.deepEqual(valid.facultyIds, []);
  assert.equal(valid.catalogYear, '');
  assert.deepEqual(valid.expandedForward, []);
});

test('deliberately removing every pin survives refresh and never restores the default implicitly', () => {
  const saved = { ...defaultProgress(db), addedCourseIds: [], autoExpandedCourseIds: [], expandedForward: [b.id], markedCourseIds: [c.id], viewport: { x: 0, y: 0, zoom: .8 } };
  const valid = validateProgress(decodeProgress(encodeProgress(saved)), db);
  assert.deepEqual(valid, saved);
  assert.deepEqual(validateProgress(valid, db, 'invalid').addedCourseIds, []);
  assert.deepEqual(validateProgress(valid, db, a.id).addedCourseIds, [a.id]);
  assert.equal('primaryCourseId' in valid,false);
  assert.deepEqual(defaultProgress(db).addedCourseIds, [a.id]);
});

test('invalid viewport values cannot discard other valid exploration state', () => {
  for (const viewport of [{ x: null, y: 0, zoom: 1 }, { x: 0, y: 0, zoom: 20 }, { x: Infinity, y: 0, zoom: 1 }, { x: 0, y: 0, zoom: -1 }]) {
    const valid = validateProgress({ ...defaultProgress(db), markedCourseIds: [b.id], viewport }, db);
    assert.equal(valid.viewport, null);
    assert.deepEqual(valid.markedCourseIds, [b.id]);
  }
});

test('catalog download failure retains selected catalog and browsing metadata until validation is possible', () => {
  const valid = validateProgress({ ...defaultProgress(db), catalogId: 'cs-three-year-2025-2026', catalogYear: '2026-2027', catalogFaculty: 'occupational-therapy', markedCourseIds: [b.id] }, { ...db, programs: null, years: [] });
  assert.equal(valid.catalogId, 'cs-three-year-2025-2026');
  assert.equal(valid.catalogYear, '2026-2027');
  assert.equal(valid.catalogFaculty, 'occupational-therapy');
  assert.deepEqual(valid.markedCourseIds, [b.id]);
});

test('referenced missing courses remain pinnable, markable and deep-linkable without invented records', () => {
  const unknown = '01040032';
  const referring = course(c.id, leaf(unknown));
  const database = { ...db, courses: new Map([...db.courses, [c.id, referring]]) };
  const saved = { ...defaultProgress(database), addedCourseIds: [unknown], expandedForward: [], markedCourseIds: [unknown] };
  const valid = validateProgress(saved, database, unknown);
  assert.deepEqual(valid.addedCourseIds, [unknown]);
  assert.deepEqual(valid.markedCourseIds, [unknown]);
  assert.equal(database.courses.has(unknown), false);
});

test('version1 and version2 sessions preserve graph, filters, markings, recent roots and viewport', () => {
  const prior = legacy({ rootId: b.id, expandedForward: ['root', 'root/f:02340247:strong'], expandedBackward: [['root', [a.id]]], markedCourseIds: [a.id], facultyIds: ['math'], catalogId: db.programs![0].id, recent: [c.id], viewport: { x: 10, y: 20, zoom: 1 } });
  for (const version of [1, 2]) {
    const migrated = validateProgress(decodeProgress(JSON.stringify({ version, progress: prior })), db);
    assert.deepEqual(migrated.addedCourseIds, [b.id]);
    assert.deepEqual(migrated.expandedForward, [b.id, c.id]);
    assert.deepEqual(migrated.expandedBackward, [[b.id, [a.id]]]);
    assert.deepEqual(migrated.markedCourseIds, [a.id]);
    assert.deepEqual(migrated.facultyIds, ['math']);
    assert.equal(migrated.catalogId, prior.catalogId);
    assert.deepEqual(migrated.recent, [c.id]);
    assert.deepEqual(migrated.viewport, prior.viewport);
    assert.deepEqual(migrated.automaticConnections, []);
    assert.equal(JSON.parse(encodeProgress(migrated)).version, PROGRESS_VERSION);
  }
});

test('valid legacy hidden edges migrate independent of collapsed ancestors and current filters', () => {
  const saved = legacy({ expandedForward: [], facultyIds: [], hiddenForwardConnections: ['root/f:02340218:strong/f:02340247:strong', 'root', 'bad', 'root/b:02340218:strong', 'root/f:99999999:strong', 'root/f:02340218:concurrent'] });
  const valid = validateProgress(saved, db);
  assert.deepEqual(valid.hiddenForwardConnections, [forwardConnectionId(b.id, c.id, 'strong')]);
  assert.deepEqual(valid.expandedForward, []);
  assert.deepEqual(valid.facultyIds, []);
});

test('multiple old occurrences merge expansion/backward choices and conservatively retain hidden relationships', () => {
  const shared = course(c.id, { type: 'and', items: [leaf(b.id), leaf(d.id)] });
  const alternate = course(d.id, leaf(a.id));
  const descendant = course(e.id, leaf(c.id));
  const database = { ...db, courses: new Map([a, b, alternate, shared, descendant].map(course => [course.id, course])) };
  const viaB = 'root/f:' + b.id + ':strong/f:' + c.id + ':strong';
  const viaD = 'root/f:' + d.id + ':strong/f:' + c.id + ':strong';
  const saved = legacy({
    expandedForward: ['root', viaB, viaD],
    expandedBackward: [[viaB, [b.id]], [viaD, [d.id]]],
    hiddenForwardConnections: [viaB + '/f:' + e.id + ':strong', viaD + '/f:' + e.id + ':strong'],
  });
  const valid = validateProgress(saved, database);
  assert.deepEqual(valid.expandedForward, [a.id, c.id]);
  assert.deepEqual(valid.expandedBackward, [[c.id, [b.id, d.id]]]);
  assert.deepEqual(valid.hiddenForwardConnections, [forwardConnectionId(c.id, e.id, 'strong')]);
});

test('canonical expansion, backward and hidden edge state validates against the real graph', () => {
  const realEdge = forwardConnectionId(a.id, b.id, 'strong');
  const saved = { ...defaultProgress(db), expandedForward: [a.id, a.id, c.id, 'root', {}], hiddenForwardConnections: [realEdge, realEdge, forwardConnectionId(b.id, a.id, 'strong'), forwardConnectionId(a.id, b.id, 'concurrent')], expandedBackward: [[c.id, [a.id, b.id]], [c.id, [b.id]], ['invalid', [a.id]]] };
  const valid = validateProgress(saved, db);
  assert.deepEqual(valid.expandedForward, [a.id, c.id]);
  assert.deepEqual(valid.hiddenForwardConnections, [realEdge]);
  assert.deepEqual(valid.expandedBackward, [[c.id, [b.id]]]);
});

test('addition ordering and uniqueness preserve all valid IDs beyond four', () => {
  const valid = validateProgress({ ...defaultProgress(db), addedCourseIds: [d.id, b.id, d.id, 'stale', a.id, c.id, e.id] }, db);
  assert.deepEqual(valid.addedCourseIds, [d.id, b.id, a.id, c.id, e.id]);
});

test('automatic paths preserve real directional steps and survive a manually hidden connector', () => {
  const hidden = forwardConnectionId(b.id, c.id, 'strong');
  const saved = { ...defaultProgress(db), addedCourseIds: [a.id, c.id], automaticConnections: [aToC], hiddenForwardConnections: [hidden] };
  const valid = validateProgress(saved, db);
  assert.deepEqual(valid.automaticConnections, [aToC]);
  assert.deepEqual(valid.hiddenForwardConnections, [hidden]);
  const backwards: CourseConnection = {
    fromRootId: c.id, toRootId: a.id,
    steps: [
      { source: b.id, target: c.id, relation: 'strong', direction: 'backward' },
      { source: a.id, target: b.id, relation: 'strong', direction: 'backward' },
    ],
  };
  assert.deepEqual(validateProgress({ ...saved, automaticConnections: [backwards] }, db).automaticConnections, [backwards]);
});

test('malformed, discontinuous, cyclic and orphaned automatic paths are discarded', () => {
  const broken = { ...aToC, steps: [...aToC.steps].reverse() };
  const unknown = { ...aToC, steps: [{ source: a.id, target: c.id, relation: 'strong', direction: 'forward' }] };
  const orphaned = { ...aToC, toRootId: d.id };
  const wrongDirection = { ...aToC, steps: [{ ...aToC.steps[0], direction: 'backward' }, aToC.steps[1]] };
  const duplicate = structuredClone(aToC);
  const valid = validateProgress({ ...defaultProgress(db), addedCourseIds: [a.id, c.id], automaticConnections: [broken, unknown, orphaned, wrongDirection, aToC, duplicate] }, db);
  assert.deepEqual(valid.automaticConnections, [aToC]);
  assert.deepEqual(validateProgress({ ...valid, addedCourseIds: [c.id] }, db).automaticConnections, [aToC]);
});

test('marked course order stays intact and supports the entire known course universe', () => {
  const valid = validateProgress({ ...defaultProgress(db), markedCourseIds: [c.id, a.id, c.id, b.id] }, db);
  assert.deepEqual(valid.markedCourseIds, [c.id, a.id, b.id]);
  const courses = Array.from({ length: 7005 }, (_, index) => course(String(index + 20000000)));
  const database = { ...db, courses: new Map(courses.map(course => [course.id, course])), defaultRoot: courses[0].id };
  const ids = courses.map(course => course.id).reverse();
  assert.deepEqual(validateProgress({ ...defaultProgress(database), markedCourseIds: ids }, database).markedCourseIds, ids);
});

test('hostile fields, oversized arrays and prototype-like IDs cannot pollute state or invent edges', () => {
  const hostile = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}');
  Object.assign(hostile, { addedCourseIds: [a.id, {}, '__proto__'], expandedForward: Array(50_000).fill(a.id), expandedBackward: [[a.id, ['__proto__', {}]], {}], hiddenForwardConnections: ['__proto__->constructor:strong'], markedCourseIds: [b.id, {}], viewport: { x: '0', y: 0, zoom: 1 } });
  const valid = validateProgress(hostile, db);
  assert.deepEqual(valid.addedCourseIds, [a.id]);
  assert.deepEqual(valid.expandedForward, [a.id]);
  assert.deepEqual(valid.expandedBackward, []);
  assert.deepEqual(valid.hiddenForwardConnections, []);
  assert.deepEqual(valid.markedCourseIds, [b.id]);
  assert.equal(valid.viewport, null);
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});
