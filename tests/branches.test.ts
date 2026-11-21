import test from 'node:test';
import assert from 'node:assert/strict';
import type { Course, Requirement } from '../src/types';
import {
  buildCourseIndex, buildDependents, buildGraph,
  forwardConnectionId, parseConnectionId, restoreDirectConnections,
} from '../src/lib/graph';

const leaf = (courseId: string, relation: 'strong' | 'concurrent' = 'strong'): Requirement =>
  ({ type: 'course', courseId, relation });
const course = (id: string, requirements: Requirement | null = null): Course => ({
  id, name: id, faculty: 'הפקולטה למדעי המחשב', requirements,
  requirementsStatus: requirements ? 'known' : 'none', source: { url: 'https://example.test' },
});
const ab = forwardConnectionId('A', 'B', 'strong');
const ac = forwardConnectionId('A', 'C', 'strong');
const data = [course('A'), course('B', leaf('A')), course('C', leaf('A')),
  course('D', leaf('B')), course('E', leaf('B')), course('F', leaf('C'))];
const index = buildCourseIndex(data), dependents = buildDependents(data);
const expanded = new Set(['A', 'B', 'C']);
const graph = (
  hidden: ReadonlySet<string> = new Set(),
  open: ReadonlySet<string> = expanded,
  visible: (id: string) => boolean = () => true,
) => buildGraph(['A'], index, dependents, open, new Map(), visible, hidden);

test('connection keys are canonical endpoint/relation identities', () => {
  assert.equal(ab, 'A->B:strong');
  assert.deepEqual(parseConnectionId(ab), { source: 'A', target: 'B', relation: 'strong' });
  assert.notEqual(ab, forwardConnectionId('A', 'B', 'concurrent'));
  assert.equal(parseConnectionId('root/f:old:strong'), null);
  assert.equal(parseConnectionId('A->B->C:strong'), null);
});

test('hiding A to B removes only its unreachable subtree and preserves C and F expansion', () => {
  const before = [...expanded];
  assert.deepEqual(graph(new Set([ab])).nodes.map(node => node.id), ['A', 'C', 'F']);
  assert.deepEqual([...expanded], before);
  assert.deepEqual(graph().nodes.map(node => node.id), ['A', 'B', 'C', 'D', 'E', 'F']);
});

test('course-level collapse hides outgoing branches while keeping descendant expansion memory', () => {
  const open = new Set(expanded);
  open.delete('A');
  assert.deepEqual(graph(new Set([ab]), open).nodes.map(node => node.id), ['A']);
  open.add('A');
  assert.equal(graph(restoreDirectConnections(new Set([ab]), 'A'), open).nodes.length, 6);
});

test('shared descendants survive through an unaffected parent with no duplicate cards', () => {
  const shared = [course('A'), course('B', leaf('A')), course('C', leaf('A')),
    course('D', { type: 'and', items: [leaf('B'), leaf('C')] }), course('E', leaf('D'))];
  const bd = forwardConnectionId('B', 'D', 'strong');
  const cd = forwardConnectionId('C', 'D', 'strong');
  const open = new Set(['A', 'B', 'C', 'D']);
  const run = (hidden: Set<string>) => buildGraph(['A'], buildCourseIndex(shared), buildDependents(shared), open, new Map(), () => true, hidden);
  const one = run(new Set([bd]));
  assert.equal(one.nodes.filter(node => node.id === 'D').length, 1);
  assert.equal(one.nodes.filter(node => node.id === 'E').length, 1);
  assert.equal(one.edges.some(edge => edge.id === 'edge:' + bd), false);
  assert.equal(one.edges.some(edge => edge.id === 'edge:' + cd), true);
  const neither = run(new Set([bd, cd]));
  assert.equal(neither.nodes.some(node => ['D', 'E'].includes(node.id)), false);
  const restored = run(new Set([cd]));
  assert.equal(restored.edges.some(edge => edge.id === 'edge:' + bd), true);
  assert.equal(restored.edges.some(edge => edge.id === 'edge:' + cd), false);
});

test('an explicitly pinned child survives collapse of every incoming branch', () => {
  const shared = [course('A'), course('B'), course('C', { type: 'and', items: [leaf('A'), leaf('B')] }), course('D', leaf('C'))];
  const open = new Set(['A', 'B', 'C']);
  const hidden = new Set([forwardConnectionId('A', 'C', 'strong'), forwardConnectionId('B', 'C', 'strong')]);
  const result = buildGraph(['A', 'B', 'C'], buildCourseIndex(shared), buildDependents(shared), open, new Map(), () => true, hidden);
  assert.deepEqual(result.nodes.map(node => node.id), ['A', 'B', 'C', 'D']);
  assert.equal(result.edges.length, 1);
  assert.equal(result.edges[0].source, 'C');
});

test('restoring direct relationships preserves deeper hidden relationships', () => {
  const bd = forwardConnectionId('B', 'D', 'strong');
  const ce = forwardConnectionId('C', 'E', 'strong');
  assert.deepEqual([...restoreDirectConnections(new Set([ab, ac, bd, ce]), 'A')], [bd, ce]);
  assert.deepEqual([...restoreDirectConnections(new Set([ab, ac, bd, ce]), 'B')], [ab, ac, ce]);
});

test('filters and personal connection hiding stay independent and latent', () => {
  const hidden = new Set([forwardConnectionId('B', 'D', 'strong')]);
  assert.deepEqual(graph(hidden, expanded, id => id !== 'C').nodes.map(node => node.id), ['A', 'B', 'E']);
  assert.deepEqual(graph(hidden).nodes.map(node => node.id), ['A', 'B', 'C', 'E', 'F']);
  assert.equal(hidden.size, 1);
});

test('a forward hide does not silently cancel explicit backward exploration of that relationship', () => {
  const simple = [course('A'), course('B', leaf('A'))];
  const backward = new Map([['B', new Set(['A'])]]);
  const result = buildGraph(['B'], buildCourseIndex(simple), buildDependents(simple), new Set(['A']), backward, () => false, new Set([ab]));
  assert.deepEqual(result.nodes.map(node => node.id), ['B', 'A']);
  assert.equal(result.edges.length, 1);
  assert.equal(result.edges[0].direction, 'backward');
});

test('strong and concurrent relationships between shared nodes can be hidden separately', () => {
  const mixed = [course('A'), course('B', { type: 'or', items: [leaf('A'), leaf('A', 'concurrent')] })];
  const result = buildGraph(['A'], buildCourseIndex(mixed), buildDependents(mixed), new Set(['A']), new Map(), () => true, new Set([ab]));
  assert.equal(result.nodes.length, 2);
  assert.equal(result.nodes[1].relation, 'concurrent');
  assert.equal(result.edges[0].relation, 'concurrent');
});

test('repeated hiding/restoring retains unique reachable nodes and valid endpoints', () => {
  const original = JSON.stringify(data);
  for (let i = 0; i < 12; i++) {
    const result = graph(i % 2 ? new Set() : new Set([ab]));
    const ids = new Set(result.nodes.map(node => node.id));
    assert.equal(result.nodes.length, i % 2 ? 6 : 3);
    assert.equal(ids.size, result.nodes.length);
    assert.equal(result.edges.every(edge => ids.has(edge.source) && ids.has(edge.target)), true);
  }
  assert.equal(JSON.stringify(data), original);
});

test('obsolete connection IDs do not remove unrelated nodes', () => {
  assert.deepEqual(graph(new Set(['junk', 'root', 'root/f:obsolete:strong'])), graph());
});
