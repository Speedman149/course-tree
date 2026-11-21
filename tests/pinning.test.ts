import test from 'node:test';
import assert from 'node:assert/strict';
import type { Course, Requirement } from '../src/types';
import {
  buildCourseIndex, buildDependents, buildGraph, forwardConnectionId,
  type CourseConnection,
} from '../src/lib/graph';
import { findCourseConnection } from '../src/lib/connecting-paths';

const leaf = (courseId: string): Requirement => ({ type: 'course', courseId, relation: 'strong' });
const course = (id: string, requirements: Requirement | null = null): Course => ({
  id, name: id, faculty: 'test', requirements,
  requirementsStatus: requirements ? 'known' : 'none', source: { url: 'https://example.test' },
});
const chain = [course('A'), course('B', leaf('A')), course('C', leaf('B')), course('D', leaf('C'))];
const index = buildCourseIndex(chain), dependents = buildDependents(chain);

test('pinning a visible course needs no new connecting path', () => {
  const result = findCourseConnection(['A'], 'B', index, dependents, { visibleCourseIds: new Set(['A', 'B']) });
  assert.equal(result.reason, 'visible');
  assert.equal(result.connection, null);
  assert.equal(result.autoReveal, false);
});

test('hidden descendant pinning finds and reveals only its short dependency chain', () => {
  const data = [...chain, course('X', leaf('A')), course('Y', leaf('B')), course('Z', leaf('C'))];
  const byId = buildCourseIndex(data), children = buildDependents(data);
  const result = findCourseConnection(['A'], 'D', byId, children, { visibleCourseIds: new Set(['A', 'B']) });
  assert.equal(result.reason, 'connected');
  assert.equal(result.autoReveal, true);
  assert.equal(result.newCourseCount, 1);
  assert.deepEqual(result.connection!.steps.map(step => [step.source, step.target, step.direction]), [
    ['A', 'B', 'forward'], ['B', 'C', 'forward'], ['C', 'D', 'forward'],
  ]);
  const graph = buildGraph(['A', 'D'], byId, children, new Set(), new Map(), () => true, new Set(), [result.connection!]);
  assert.deepEqual(new Set(graph.nodes.map(node => node.id)), new Set(['A', 'B', 'C', 'D']));
  assert.equal(graph.nodes.some(node => ['X', 'Y', 'Z'].includes(node.id)), false);
});

test('existing manual sibling expansions survive automatic path activation and removal', () => {
  const data = [...chain, course('X', leaf('A')), course('Y', leaf('B'))];
  const byId = buildCourseIndex(data), children = buildDependents(data);
  const connection = findCourseConnection(['A'], 'D', byId, children).connection!;
  const expanded = new Set(['A']);
  const graph = buildGraph(['A', 'D'], byId, children, expanded, new Map(), () => true, new Set(), [connection]);
  assert.deepEqual(new Set(graph.nodes.map(node => node.id)), new Set(['A', 'D', 'B', 'C', 'X']));
  assert.equal(graph.nodes.some(node => node.id === 'Y'), false);
  const direct = graph.edges.find(edge => edge.source === 'A' && edge.target === 'B')!;
  assert.equal(direct.manual, true);
  assert.equal(direct.automatic, true);
  const unpinned = buildGraph(['A'], byId, children, expanded, new Map(), () => true, new Set(), [connection]);
  assert.deepEqual(unpinned.nodes.map(node => node.id), ['A', 'B', 'X']);
  assert.deepEqual([...expanded], ['A']);
});

test('pinning an ancestor finds backward traversal with correct arrow endpoints', () => {
  const result = findCourseConnection(['D'], 'A', index, dependents);
  assert.equal(result.reason, 'connected');
  assert.deepEqual(result.connection!.steps.map(step => [step.source, step.target, step.direction]), [
    ['C', 'D', 'backward'], ['B', 'C', 'backward'], ['A', 'B', 'backward'],
  ]);
  const graph = buildGraph(['D', 'A'], index, dependents, new Set(), new Map(), () => true, new Set(), [result.connection!]);
  assert.equal(graph.nodes.length, 4);
  assert.equal(graph.nodes.filter(node => node.id === 'D').length, 1);
  assert.deepEqual(new Set(graph.edges.map(edge => edge.source + '->' + edge.target)), new Set(['A->B', 'B->C', 'C->D']));
  assert.equal(graph.edges.every(edge => edge.direction === 'backward'), true);
});

test('equal shortest paths prefer already visible intermediates', () => {
  const data = [course('A'), course('B', leaf('A')), course('C', leaf('A')),
    course('D', { type: 'or', items: [leaf('B'), leaf('C')] })];
  const result = findCourseConnection(['A'], 'D', buildCourseIndex(data), buildDependents(data), { visibleCourseIds: new Set(['A', 'C']) });
  assert.deepEqual(result.connection!.steps.map(step => step.target), ['C', 'D']);
});

test('shorter paths take precedence over longer paths with more visible courses', () => {
  const data = [course('A'), course('B', leaf('A')), course('C', leaf('A')), course('E', leaf('C')),
    course('D', { type: 'or', items: [leaf('B'), leaf('E')] })];
  const result = findCourseConnection(['A'], 'D', buildCourseIndex(data), buildDependents(data), { visibleCourseIds: new Set(['A', 'C', 'E']) });
  assert.deepEqual(result.connection!.steps.map(step => step.target), ['B', 'D']);
});

test('multi-source path search uses the closest pinned course', () => {
  const data = [...chain, course('X'), course('Y', leaf('X')),
    course('Z', { type: 'or', items: [leaf('D'), leaf('Y')] })];
  const result = findCourseConnection(['A', 'X'], 'Z', buildCourseIndex(data), buildDependents(data));
  assert.equal(result.connection!.fromRootId, 'X');
  assert.equal(result.connection!.steps.length, 2);
});

test('a manually hidden bridge produces an explicit restore proposal and stays hidden', () => {
  const hidden = new Set([forwardConnectionId('B', 'C', 'strong')]);
  const result = findCourseConnection(['A'], 'D', index, dependents, { hiddenForwardConnections: hidden });
  assert.equal(result.reason, 'hidden');
  assert.equal(result.autoReveal, false);
  assert.deepEqual(result.blockedConnectionIds, ['B->C:strong']);
  assert.equal(result.connection!.steps.length, 3);
  const graph = buildGraph(['A', 'D'], index, dependents, new Set(), new Map(), () => true, hidden, [result.connection!]);
  assert.deepEqual(new Set(graph.nodes.map(node => node.id)), new Set(['A', 'D', 'B']));
  assert.equal(graph.nodes.some(node => node.id === 'C'), false);
  assert.equal(hidden.size, 1);
});

test('hidden paths are bypassed by another eligible nonhidden shortest route', () => {
  const data = [course('A'), course('B', leaf('A')), course('C', leaf('A')),
    course('D', { type: 'or', items: [leaf('B'), leaf('C')] })];
  const result = findCourseConnection(['A'], 'D', buildCourseIndex(data), buildDependents(data), { hiddenForwardConnections: new Set(['B->D:strong']) });
  assert.equal(result.reason, 'connected');
  assert.deepEqual(result.connection!.steps.map(step => step.target), ['C', 'D']);
});

test('filtered intermediates prevent automatic connection without changing filters', () => {
  const visible = (id: string) => id !== 'B';
  const result = findCourseConnection(['A'], 'D', index, dependents, { isForwardVisible: visible });
  assert.equal(result.reason, 'filtered');
  assert.equal(result.autoReveal, false);
  assert.equal(result.connection!.steps.length, 3);
  const graph = buildGraph(['A', 'D'], index, dependents, new Set(), new Map(), visible, new Set(), [result.connection!]);
  assert.deepEqual(graph.nodes.map(node => node.id), ['A', 'D']);
});

test('pinned endpoints can lie outside filters while intermediates still qualify', () => {
  const result = findCourseConnection(['A'], 'D', index, dependents, { isForwardVisible: id => ['B', 'C'].includes(id) });
  assert.equal(result.reason, 'connected');
  const graph = buildGraph(['A', 'D'], index, dependents, new Set(), new Map(), id => ['B', 'C'].includes(id), new Set(), [result.connection!]);
  assert.equal(graph.nodes.length, 4);
});

test('long connections remain available for explicit revelation without automatic clutter', () => {
  const data = Array.from({ length: 20 }, (_, i) => course(String(i), i ? leaf(String(i - 1)) : null));
  const result = findCourseConnection(['0'], '19', buildCourseIndex(data), buildDependents(data));
  assert.equal(result.reason, 'long');
  assert.equal(result.autoReveal, false);
  assert.equal(result.connection!.steps.length, 19);
});

test('disconnected courses remain independent instead of inventing a relationship', () => {
  const data = [...chain, course('X')];
  const result = findCourseConnection(['A'], 'X', buildCourseIndex(data), buildDependents(data));
  assert.equal(result.reason, 'unrelated');
  assert.equal(result.connection, null);
  const graph = buildGraph(['A', 'X'], buildCourseIndex(data), buildDependents(data), new Set(['A', 'X']), new Map());
  assert.equal(graph.nodes.filter(node => node.id === 'X').length, 1);
  assert.equal(graph.edges.some(edge => edge.source === 'X' || edge.target === 'X'), false);
});

test('automatic ownership drops unused targets but retains needed intermediate endpoints', () => {
  const connection = findCourseConnection(['A'], 'D', index, dependents).connection!;
  assert.deepEqual(new Set(buildGraph(['D'], index, dependents, new Set(), new Map(), () => true, new Set(), [connection]).nodes.map(node => node.id)), new Set(['A','B','C','D']));
  assert.deepEqual(buildGraph(['A'], index, dependents, new Set(), new Map(), () => true, new Set(), [connection]).nodes.map(node => node.id), ['A']);
});

test('manual forward expansion and backward selections converge on one automatic relationship', () => {
  const connection = findCourseConnection(['A'], 'D', index, dependents).connection!;
  const graph = buildGraph(['A', 'D'], index, dependents, new Set(['A', 'B', 'C']),
    new Map([['D', new Set(['C'])]]), () => true, new Set(), [connection]);
  assert.equal(graph.nodes.length, 4);
  assert.equal(graph.edges.length, 3);
  const edge = graph.edges.find(edge => edge.source === 'C' && edge.target === 'D')!;
  assert.deepEqual(edge.directions, ['forward', 'backward']);
  assert.equal(edge.manual, true);
  assert.equal(edge.automatic, true);
});

test('automatic paths cannot invent edges or activate for absent owners', () => {
  const bad: CourseConnection = {
    fromRootId: 'A', toRootId: 'D',
    steps: [{ source: 'A', target: 'D', relation: 'strong', direction: 'forward' }],
  };
  assert.equal(buildGraph(['A', 'D'], index, dependents, new Set(), new Map(), () => true, new Set(), [bad]).edges.length, 0);
});

test('cyclic source relationships do not make shortest-path search infinite', () => {
  const data = [course('A', leaf('C')), course('B', leaf('A')), course('C', leaf('B')), course('X')];
  const byId = buildCourseIndex(data), children = buildDependents(data);
  const toC = findCourseConnection(['A'], 'C', byId, children);
  assert.equal(toC.connection!.steps.length, 1);
  assert.equal(toC.connection!.steps[0].direction, 'backward');
  assert.equal(findCourseConnection(['A'], 'X', byId, children).reason, 'unrelated');
});

test('a pinned known-reference missing record can use source-supported automatic forward connections', () => {
  const data = [course('C', leaf('M')), course('D', leaf('C'))];
  const byId = buildCourseIndex(data), children = buildDependents(data);
  const result = findCourseConnection(['M'], 'D', byId, children);
  assert.equal(result.reason, 'connected');
  assert.deepEqual(result.connection!.steps.map(step => [step.source, step.target, step.direction]), [
    ['M', 'C', 'forward'], ['C', 'D', 'forward'],
  ]);
  const visible = buildGraph(['M', 'D'], byId, children, new Set(['M']), new Map(), () => true, new Set(), [result.connection!]);
  assert.deepEqual(new Set(visible.nodes.map(node => node.id)), new Set(['M', 'C', 'D']));
  assert.equal(visible.nodes.find(node => node.id === 'M')!.missing, true);
  assert.equal(visible.edges.length, 2);
  assert.equal(visible.edges.every(edge => edge.automatic && !edge.manual), true);

  const manualOnly = buildGraph(['M'], byId, children, new Set(['M']), new Map([['M', new Set(['C'])]]));
  assert.deepEqual(manualOnly.nodes.map(node => node.id), ['M']);
  assert.equal(manualOnly.edges.length, 0);
});

test('automatic missing-root connectors continue respecting manual hides and intermediate filters', () => {
  const data = [course('C', leaf('M')), course('D', leaf('C'))];
  const byId = buildCourseIndex(data), children = buildDependents(data);
  const hidden = new Set([forwardConnectionId('M', 'C', 'strong')]);
  const blocked = findCourseConnection(['M'], 'D', byId, children, { hiddenForwardConnections: hidden });
  assert.equal(blocked.reason, 'hidden');
  assert.deepEqual(blocked.blockedConnectionIds, ['M->C:strong']);
  assert.deepEqual(buildGraph(['M', 'D'], byId, children, new Set(), new Map(), () => true, hidden, [blocked.connection!]).nodes.map(node => node.id), ['M', 'D']);
  const filtered = findCourseConnection(['M'], 'D', byId, children, { isForwardVisible: id => id !== 'C' });
  assert.equal(filtered.reason, 'filtered');
  assert.equal(filtered.autoReveal, false);
});
