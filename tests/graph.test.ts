import test from 'node:test';
import assert from 'node:assert/strict';
import type { Course, Requirement } from '../src/types';
import {
  buildCourseIndex,
  buildDependents,
  buildGraph,
  collectRequirements,
  instanceId,
  resolveCourseId,
} from '../src/lib/graph';

const leaf = (courseId: string, relation: 'strong' | 'concurrent' = 'strong'): Requirement => ({
  type: 'course', courseId, relation,
});
const course = (id: string, requirements: Requirement | null = null): Course => ({
  id,
  name: `קורס ${id}`,
  faculty: 'מדעי המחשב',
  requirements,
  requirementsStatus: requirements ? 'known' : 'none',
  source: { url: `https://example.test/course/${id}` },
});

test('AND/OR AST is preserved while indexing involvement in prerequisites', () => {
  const requirements: Requirement = {
    type: 'and',
    items: [leaf('A'), { type: 'or', items: [leaf('B'), leaf('C', 'concurrent')] }],
  };
  const original = JSON.stringify(requirements);
  const courses = [course('A'), course('B'), course('C'), course('D', requirements)];
  const index = buildDependents(courses);
  assert.deepEqual(index.get('A'), [{ courseId: 'D', relation: 'strong' }]);
  assert.deepEqual(index.get('B'), [{ courseId: 'D', relation: 'strong' }]);
  assert.deepEqual(index.get('C'), [{ courseId: 'D', relation: 'concurrent' }]);
  assert.equal(JSON.stringify(requirements), original);
  assert.deepEqual(courses[3].requirements, requirements);
});

test('leaves are deduplicated per course and relationship, retaining different roles', () => {
  const requirement: Requirement = {
    type: 'or',
    items: [leaf('A'), leaf('A'), leaf('A', 'concurrent')],
  };
  assert.deepEqual(collectRequirements(requirement), [leaf('A'), leaf('A', 'concurrent')]);
  assert.deepEqual(collectRequirements(null), []);
  assert.deepEqual(collectRequirements(undefined), []);
});

test('diamond branches expand independently and collapse hides only its descendants', () => {
  const courses = [
    course('A'), course('B', leaf('A')), course('C', leaf('A')),
    course('D', { type: 'and', items: [leaf('B'), leaf('C')] }),
    course('E', leaf('D')),
  ];
  const index = buildCourseIndex(courses);
  const dependents = buildDependents(courses);
  const b = instanceId('root', 'forward', 'B', 'strong');
  const c = instanceId('root', 'forward', 'C', 'strong');
  const bd = instanceId(b, 'forward', 'D', 'strong');
  const cd = instanceId(c, 'forward', 'D', 'strong');
  const expanded = new Set(['root', b, c, bd, cd]);
  const open = buildGraph('A', index, dependents, expanded, new Map());
  assert.equal(open.nodes.filter((node) => node.courseId === 'D').length, 2);
  assert.equal(open.nodes.filter((node) => node.courseId === 'E').length, 2);
  expanded.delete(b);
  const collapsed = buildGraph('A', index, dependents, expanded, new Map());
  assert.equal(collapsed.nodes.filter((node) => node.courseId === 'D').length, 1);
  assert.equal(collapsed.nodes.filter((node) => node.courseId === 'E').length, 1);
  assert.ok(collapsed.nodes.some((node) => node.id === cd));
  assert.ok(!collapsed.nodes.some((node) => node.id === bd));
  expanded.add(b);
  assert.deepEqual(buildGraph('A', index, dependents, expanded, new Map()), open);
});

test('backward exploration is recursive and has semantic prerequisite edge direction', () => {
  const courses = [course('A'), course('B', leaf('A', 'concurrent')), course('C', leaf('B'))];
  const b = instanceId('root', 'backward', 'B', 'strong');
  const a = instanceId(b, 'backward', 'A', 'concurrent');
  const backwards = new Map([['root', new Set(['B'])], [b, new Set(['A'])]]);
  const result = buildGraph('C', buildCourseIndex(courses), buildDependents(courses), new Set(), backwards);
  assert.deepEqual(result.nodes.map((node) => node.courseId), ['C', 'B', 'A']);
  assert.deepEqual(result.edges.map(({ source, target, relation }) => ({ source, target, relation })), [
    { source: b, target: 'root', relation: 'strong' },
    { source: a, target: b, relation: 'concurrent' },
  ]);
  backwards.get('root')!.clear();
  assert.equal(buildGraph('C', buildCourseIndex(courses), buildDependents(courses), new Set(), backwards).nodes.length, 1);
});

test('cyclic dependencies terminate at a visible repeated-ancestor node', () => {
  const courses = [course('A', leaf('B')), course('B', leaf('A'))];
  const b = instanceId('root', 'forward', 'B', 'strong');
  const a = instanceId(b, 'forward', 'A', 'strong');
  const result = buildGraph('A', buildCourseIndex(courses), buildDependents(courses), new Set(['root', b, a]), new Map());
  assert.equal(result.nodes.length, 3);
  assert.equal(result.nodes[2].cycle, true);
  assert.equal(result.nodes[2].courseId, 'A');
});

test('a backward and forward turn cannot recurse into the same ancestor', () => {
  const courses = [course('A'), course('B', leaf('A'))];
  const b = instanceId('root', 'forward', 'B', 'strong');
  const backwards = new Map([[b, new Set(['A'])]]);
  const result = buildGraph('A', buildCourseIndex(courses), buildDependents(courses), new Set(['root']), backwards);
  assert.equal(result.nodes.length, 3);
  assert.equal(result.nodes[2].cycle, true);
  assert.equal(result.nodes[2].direction, 'backward');
});

test('unknown references stay visible and cannot fabricate additional relationships', () => {
  const courses = [course('A', leaf('MISSING'))];
  const missing = instanceId('root', 'backward', 'MISSING', 'strong');
  const result = buildGraph('A', buildCourseIndex(courses), buildDependents(courses), new Set([missing]), new Map([['root', new Set(['MISSING'])]]));
  assert.equal(result.nodes.length, 2);
  assert.equal(result.nodes[1].missing, true);
  assert.equal(result.nodes[1].courseId, 'MISSING');
  assert.equal(result.edges.length, 1);
});

test('unrelated backward selector ids do not create invented prerequisites', () => {
  const courses = [course('A'), course('B')];
  const result = buildGraph('A', buildCourseIndex(courses), buildDependents(courses), new Set(), new Map([['root', new Set(['B'])]]));
  assert.equal(result.nodes.length, 1);
});

test('relation color metadata belongs to each connection, not the course', () => {
  const courses = [
    course('A'), course('B'),
    course('C', { type: 'and', items: [leaf('A'), leaf('B', 'concurrent')] }),
  ];
  const dependents = buildDependents(courses);
  assert.equal(dependents.get('A')![0].relation, 'strong');
  assert.equal(dependents.get('B')![0].relation, 'concurrent');
});

test('course number lookup preserves exact IDs and only removes unambiguous leading zeros', () => {
  const index = buildCourseIndex([course('044252'), course('234114'), course('02340114')]);
  assert.equal(resolveCourseId(' 044252 ', index), '044252');
  assert.equal(resolveCourseId('44252', index), '044252');
  assert.equal(resolveCourseId('234114', index), '234114');
  assert.equal(resolveCourseId('2340114', index), '02340114');
  assert.equal(resolveCourseId('234999', index), null);
  assert.equal(resolveCourseId('234-114', index), null);
  const ambiguous = buildCourseIndex([course('00123'), course('0123')]);
  assert.equal(resolveCourseId('123', ambiguous), null);
  assert.equal(resolveCourseId('0123', ambiguous), '0123');
});

test('source-provided legacy aliases resolve without inferring renumbering rules', () => {
  const records = [
    { ...course('02340114'), aliases: ['234114', '2340114'] },
    { ...course('00440252'), aliases: ['044252', '440252'] },
  ];
  const index = buildCourseIndex(records);
  assert.equal(resolveCourseId('234114', index), '02340114');
  assert.equal(resolveCourseId('2340114', index), '02340114');
  assert.equal(resolveCourseId('44252', index), '00440252');
  assert.equal(resolveCourseId('044252', index), '00440252');
  const withoutAliases = buildCourseIndex([course('02340114')]);
  assert.equal(resolveCourseId('234114', withoutAliases), null);
  const conflicting = buildCourseIndex([
    { ...course('A'), aliases: ['123'] },
    { ...course('B'), aliases: ['123'] },
  ]);
  assert.equal(resolveCourseId('123', conflicting), null);
});
