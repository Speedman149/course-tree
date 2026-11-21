import test from 'node:test';
import assert from 'node:assert/strict';
import type { Course, Requirement } from '../src/types';
import {
  buildCourseIndex, buildDependents, buildGraph, collectRequirements,
  forwardConnectionId, resolveCourseId,
} from '../src/lib/graph';

const leaf = (courseId: string, relation: 'strong' | 'concurrent' = 'strong'): Requirement =>
  ({ type: 'course', courseId, relation });
const course = (id: string, requirements: Requirement | null = null): Course => ({
  id, name: `קורס ${id}`, faculty: 'מדעי המחשב',
  requirements, requirementsStatus: requirements ? 'known' : 'none',
  source: { url: `https://example.test/course/${id}` },
});

test('AND/OR AST is preserved while indexing prerequisite involvement', () => {
  const requirements: Requirement = {
    type: 'and', items: [leaf('A'), { type: 'or', items: [leaf('B'), leaf('C', 'concurrent')] }],
  };
  const original = JSON.stringify(requirements);
  const data = [course('A'), course('B'), course('C'), course('D', requirements)];
  const index = buildDependents(data);
  assert.deepEqual(index.get('A'), [{ courseId: 'D', relation: 'strong' }]);
  assert.deepEqual(index.get('B'), [{ courseId: 'D', relation: 'strong' }]);
  assert.deepEqual(index.get('C'), [{ courseId: 'D', relation: 'concurrent' }]);
  assert.equal(JSON.stringify(requirements), original);
});

test('repeated logical leaves deduplicate per course/relation while retaining distinct types', () => {
  const requirement: Requirement = { type: 'or', items: [leaf('A'), leaf('A'), leaf('A', 'concurrent')] };
  assert.deepEqual(collectRequirements(requirement), [leaf('A'), leaf('A', 'concurrent')]);
  assert.deepEqual(collectRequirements(null), []);
  assert.deepEqual(collectRequirements(undefined), []);
  const data = [course('A'), course('B', requirement)];
  const graph = buildGraph(['A'], buildCourseIndex(data), buildDependents(data), new Set(['A']), new Map());
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 2);
  assert.deepEqual(graph.nodes.find(node => node.id === 'B')!.relations, ['strong', 'concurrent']);
});

test('shared diamond nodes and descendants are unique and preserve canonical expansion state', () => {
  const data = [course('A'), course('B', leaf('A')), course('C', leaf('A')),
    course('D', { type: 'and', items: [leaf('B'), leaf('C')] }), course('E', leaf('D'))];
  const index = buildCourseIndex(data), dependents = buildDependents(data);
  const expanded = new Set(['A', 'B', 'C', 'D']);
  const open = buildGraph(['A'], index, dependents, expanded, new Map());
  assert.deepEqual(open.nodes.map(node => node.id), ['A', 'B', 'C', 'D', 'E']);
  assert.equal(open.edges.filter(edge => edge.target === 'D').length, 2);
  expanded.delete('B');
  const collapsed = buildGraph(['A'], index, dependents, expanded, new Map());
  assert.deepEqual(collapsed.nodes.map(node => node.id), ['A', 'B', 'C', 'D', 'E']);
  assert.equal(collapsed.edges.some(edge => edge.source === 'B' && edge.target === 'D'), false);
  assert.equal(collapsed.edges.some(edge => edge.source === 'D' && edge.target === 'E'), true);
  expanded.add('B');
  assert.deepEqual(buildGraph(['A'], index, dependents, expanded, new Map()), open);
});

test('three converging branches share every advanced course and expansion', () => {
  const data = [course('A'), ...['B', 'C', 'X'].map(id => course(id, leaf('A'))),
    course('D', { type: 'and', items: ['B', 'C', 'X'].map(id => leaf(id)) }),
    course('E', leaf('D')), course('F', leaf('E'))];
  const graph = buildGraph(['A'], buildCourseIndex(data), buildDependents(data),
    new Set(['A', 'B', 'C', 'X', 'D', 'E']), new Map());
  assert.equal(graph.nodes.length, 7);
  assert.equal(new Set(graph.nodes.map(node => node.id)).size, graph.nodes.length);
  assert.equal(graph.edges.filter(edge => edge.target === 'D').length, 3);
  assert.equal(graph.edges.filter(edge => edge.target === 'E').length, 1);
  assert.equal(graph.edges.filter(edge => edge.target === 'F').length, 1);
});

test('backward exploration is recursive and preserves actual prerequisite arrow direction', () => {
  const data = [course('A'), course('B', leaf('A', 'concurrent')), course('C', leaf('B'))];
  const backwards = new Map([['C', new Set(['B'])], ['B', new Set(['A'])]]);
  const graph = buildGraph(['C'], buildCourseIndex(data), buildDependents(data), new Set(), backwards);
  assert.deepEqual(graph.nodes.map(node => node.id), ['C', 'B', 'A']);
  assert.deepEqual(graph.edges.map(({ source, target, relation }) => ({ source, target, relation })), [
    { source: 'B', target: 'C', relation: 'strong' },
    { source: 'A', target: 'B', relation: 'concurrent' },
  ]);
  assert.deepEqual(graph.nodes.find(node => node.id === 'B')!.backwardParents, ['C']);
  backwards.get('C')!.clear();
  assert.equal(buildGraph(['C'], buildCourseIndex(data), buildDependents(data), new Set(), backwards).nodes.length, 1);
});

test('backward then forward reuses the original course and relationship without inventing a cycle', () => {
  const data = [course('A'), course('B', leaf('A')), course('C', leaf('B'))];
  const graph = buildGraph(['C'], buildCourseIndex(data), buildDependents(data), new Set(['B']),
    new Map([['C', new Set(['B'])], ['B', new Set(['A'])]]));
  assert.equal(graph.nodes.filter(node => node.id === 'C').length, 1);
  assert.equal(graph.nodes.length, 3);
  const edge = graph.edges.find(edge => edge.source === 'B' && edge.target === 'C')!;
  assert.deepEqual(edge.directions, ['forward', 'backward']);
  assert.equal(graph.edges.filter(candidate => candidate.id === edge.id).length, 1);
  assert.equal(graph.nodes.some(node => node.cycle), false);
});

test('genuine cyclic dependencies remain unique, finite and expandable', () => {
  const data = [course('A', leaf('B')), course('B', leaf('A'))];
  const graph = buildGraph(['A'], buildCourseIndex(data), buildDependents(data), new Set(['A', 'B']), new Map());
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 2);
  assert.equal(graph.nodes.every(node => node.cycle), true);
  assert.deepEqual(new Set(graph.edges.map(edge => edge.source)), new Set(['A', 'B']));
});

test('a forward and backward turn reuses an ancestor without flagging a source cycle', () => {
  const data = [course('A'), course('B', leaf('A'))];
  const graph = buildGraph(['A'], buildCourseIndex(data), buildDependents(data), new Set(['A']),
    new Map([['B', new Set(['A'])]]));
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.nodes.some(node => node.cycle), false);
});

test('unknown references stay unique and do not fabricate additional relationships', () => {
  const data = [course('A', leaf('MISSING'))];
  const graph = buildGraph(['A'], buildCourseIndex(data), buildDependents(data), new Set(['MISSING']),
    new Map([['A', new Set(['MISSING'])]]));
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.nodes.find(node => node.id === 'MISSING')!.missing, true);
  assert.equal(graph.edges.length, 1);
});

test('unrelated backward selector IDs never create a prerequisite', () => {
  const data = [course('A'), course('B')];
  const graph = buildGraph(['A'], buildCourseIndex(data), buildDependents(data), new Set(), new Map([['A', new Set(['B'])]]));
  assert.equal(graph.nodes.length, 1);
});

test('pin order is retained, duplicate pins deduplicate, and removing the last pin stays empty', () => {
  const data = [course('A'), course('B')];
  const index = buildCourseIndex(data), dependents = buildDependents(data);
  assert.deepEqual(buildGraph(['B', 'A', 'B'], index, dependents, new Set(), new Map()).nodes.map(node => node.id), ['B', 'A']);
  assert.deepEqual(buildGraph([], index, dependents, new Set(['A', 'B']), new Map()), { nodes: [], edges: [] });
});

test('pinned courses survive filters and branch collapse without expanding excluded dependents', () => {
  const data = [course('A'), course('B', leaf('A')), course('C', leaf('B'))];
  const index = buildCourseIndex(data), dependents = buildDependents(data);
  const graph = buildGraph(['A', 'B'], index, dependents, new Set(['A', 'B']), new Map(), id => id === 'C');
  assert.deepEqual(graph.nodes.map(node => node.id), ['A', 'B', 'C']);
  assert.equal(graph.edges.some(edge => edge.source === 'A'), false);
  assert.equal(graph.edges.some(edge => edge.source === 'B'), true);
  const collapsed = buildGraph(['A', 'B'], index, dependents, new Set(), new Map());
  assert.deepEqual(collapsed.nodes.map(node => node.id), ['A', 'B']);
});

test('finite deep canonical exploration has no old occurrence-depth cutoff', () => {
  const data = Array.from({ length: 180 }, (_, i) => course(String(i), i ? leaf(String(i - 1)) : null));
  const graph = buildGraph(['0'], buildCourseIndex(data), buildDependents(data), new Set(data.map(row => row.id)), new Map());
  assert.equal(graph.nodes.length, 180);
  assert.equal(graph.edges.length, 179);
  assert.equal(graph.truncated, undefined);
});

test('connection IDs encode actual endpoints and relation instead of traversal provenance', () => {
  assert.equal(forwardConnectionId('A', 'B', 'strong'), 'A->B:strong');
  assert.notEqual(forwardConnectionId('A', 'B', 'strong'), forwardConnectionId('A', 'B', 'concurrent'));
});

test('course lookup preserves exact IDs and only normalizes unambiguous leading zeros', () => {
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

test('legacy aliases resolve without inferring academic renumbering', () => {
  const records = [
    { ...course('02340114'), aliases: ['234114', '2340114'] },
    { ...course('00440252'), aliases: ['044252', '440252'] },
  ];
  const index = buildCourseIndex(records);
  assert.equal(resolveCourseId('234114', index), '02340114');
  assert.equal(resolveCourseId('2340114', index), '02340114');
  assert.equal(resolveCourseId('44252', index), '00440252');
  assert.equal(resolveCourseId('044252', index), '00440252');
  assert.equal(resolveCourseId('234114', buildCourseIndex([course('02340114')])), null);
  assert.equal(resolveCourseId('123', buildCourseIndex([
    { ...course('A'), aliases: ['123'] }, { ...course('B'), aliases: ['123'] },
  ])), null);
});
