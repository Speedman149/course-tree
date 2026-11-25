import test from 'node:test';
import assert from 'node:assert/strict';
import type { Course, Requirement } from '../src/types';
import {
  buildCourseIndex, buildDependents, buildGraph, forwardConnectionId,
} from '../src/lib/graph';
import {
  initialExploration as freshExploration, explorationReducer, effectiveBackwardSelections,
  automaticForwardSources, type ExplorationState, type AddCourseContext,
} from '../src/lib/exploration';

// These regressions begin with an explicitly selected course.
const initialExploration = (id: string) => ({ ...freshExploration(id), addedCourseIds: [id] });

const leaf = (courseId: string): Requirement => ({ type: 'course', courseId, relation: 'strong' });
const course = (id: string, requirements: Requirement | null = null): Course => ({
  id, name: id, faculty: 'test', requirements, requirementsStatus: requirements ? 'known' : 'none',
  source: { url: 'https://example.test' },
});
const data = [course('A'), course('B', leaf('A')), course('C', leaf('B')), course('D', leaf('C')),
  course('X', leaf('A')), course('Y', leaf('X')), course('U'), course('V'), course('W'), course('Z')];
const courses = buildCourseIndex(data), dependents = buildDependents(data);
const edge = (source: string, target: string) => forwardConnectionId(source, target, 'strong');
const graph = (state: ExplorationState, isVisible: (id: string) => boolean = () => true) =>
  buildGraph(state.addedCourseIds, courses, dependents, state.expandedForward,
    state.expandedBackward, isVisible, state.hiddenForwardConnections, state.automaticConnections, state.revealedForwardConnections);
const context = (state: ExplorationState, isVisible: (id: string) => boolean = () => true): AddCourseContext => ({
  courses, dependents, visibleCourseIds: new Set(graph(state, isVisible).nodes.map(node => node.id)), isVisible,
});
const pin = (state: ExplorationState, id: string, isVisible: (id: string) => boolean = () => true) =>
  explorationReducer(state, { type: 'toggleAdded', courseId: id, context: context(state, isVisible) });

test('an unrelated pin opens its direct children independently and preserves existing state', () => {
  const state = initialExploration('A');
  state.hiddenForwardConnections.add(edge('B', 'C'));
  state.expandedBackward.set('Y', new Set(['X']));
  const next = pin(state, 'U');
  assert.deepEqual(next.addedCourseIds, ['A', 'U']);
  assert.deepEqual([...next.expandedForward], ['A', 'U']);
  assert.deepEqual([...next.hiddenForwardConnections], [edge('B', 'C')]);
  assert.deepEqual([...next.expandedBackward.get('Y')!], ['X']);
  assert.equal(next.focusRequest?.courseId, 'U');
  assert.deepEqual(state.addedCourseIds, ['A']);
});

test('adding an already visible course preserves the graph and owns its existing route', () => {
  const state = initialExploration('A');
  const next = pin(state, 'B');
  assert.deepEqual(next.addedCourseIds, ['A', 'B']);
  assert.deepEqual([...next.expandedForward], ['A']);
  assert.equal(next.automaticConnections[0].toRootId, 'B');
  assert.deepEqual(graph(next).edges.map(edge => edge.id), graph(state).edges.map(edge => edge.id));
  assert.equal(graph(next).nodes.filter(node => node.id === 'B').length, 1);
  assert.equal(next.focusRequest?.courseId, 'B');
});

test('hidden descendant pinning activates a connecting path without unrelated expansion', () => {
  const next = pin(initialExploration('A'), 'D');
  assert.deepEqual(next.addedCourseIds, ['A', 'D']);
  assert.equal(next.automaticConnections.length, 1);
  assert.deepEqual([...next.expandedForward], ['A']);
  assert.deepEqual(new Set(graph(next).nodes.map(node => node.id)), new Set(['A', 'D', 'B', 'C', 'X']));
  assert.equal(graph(next).nodes.some(node => node.id === 'Y'), false);
});

test('pinning an ancestor reveals a backward path without expanding its unrelated siblings', () => {
  const next = pin(initialExploration('D'), 'A');
  assert.deepEqual(next.addedCourseIds, ['D', 'A']);
  assert.equal(next.automaticConnections[0].steps.every(step => step.direction === 'backward'), true);
  assert.equal(next.expandedForward.has('A'), false);
  assert.deepEqual(new Set(graph(next).nodes.map(node => node.id)), new Set(['A', 'B', 'C', 'D']));
  assert.deepEqual([...effectiveBackwardSelections(next).get('D')!], ['C']);
});

test('a fifth addition is retained without replacing earlier courses or warning', () => {
  let state = initialExploration('A');
  for (const id of ['U', 'V', 'W', 'Z']) state = pin(state, id);
  assert.deepEqual(state.addedCourseIds, ['A', 'U', 'V', 'W', 'Z']);
  assert.equal(state.treeMessage, '');
  assert.equal(state.expandedForward.has('Z'), true);
});

test('ordinary selection adds to existing courses and preserves manual branch choices', () => {
 let state=initialExploration('A');for(const id of ['U','V','W'])state=pin(state,id);
 state.hiddenForwardConnections.add(edge('B','C'));state.expandedBackward.set('Y',new Set(['X']));
 const next=explorationReducer(state,{type:'addCourse',courseId:'Z',context:context(state)});
 assert.deepEqual(next.addedCourseIds,['A','U','V','W','Z']);assert.ok(next.expandedForward.has('A'));assert.ok(next.expandedForward.has('Z'));
 assert.ok(next.hiddenForwardConnections.has(edge('B','C')));assert.deepEqual([...next.expandedBackward.get('Y')!],['X']);
});

test('removing the final addition leaves an empty graph and the next addition stands alone', () => {
 const empty=pin(initialExploration('A'),'A');assert.deepEqual(empty.addedCourseIds,[]);
 assert.deepEqual(graph(empty).nodes,[]);assert.equal('primaryCourseId' in empty,false);
 const next=pin(empty,'U');assert.deepEqual(next.addedCourseIds,['U']);assert.ok(next.expandedForward.has('U'));
 assert.deepEqual(graph(next).nodes.map(node=>node.id),['U']);
});

test('unpinning a connector endpoint removes its automatic path while manual sibling choices survive', () => {
  let state = initialExploration('A');
  state.expandedForward.add('X');
  state = pin(state, 'D');
  const next = pin(state, 'D');
  assert.equal(next.automaticConnections.length, 0);
  assert.deepEqual(next.addedCourseIds, ['A']);
  assert.equal(next.expandedForward.has('X'), true);
  assert.deepEqual(new Set(graph(next).nodes.map(node => node.id)), new Set(['A', 'B', 'X', 'Y']));
});

test('unpinning the old anchor preserves another pin and its manual descendants', () => {
  let state = pin(initialExploration('A'), 'D');
  state = explorationReducer(state, { type: 'toggleForward', courseId: 'D', children: dependents.get('D') ?? [] });
  const next = pin(state, 'A');
  assert.deepEqual(next.addedCourseIds, ['D']);
  assert.equal(next.automaticConnections.length, 1);
  assert.equal(next.expandedForward.has('D'), true);
  assert.deepEqual(new Set(graph(next).nodes.map(node => node.id)), new Set(['A','B','C','D']));
});

test('course-level minus suppresses manual and automatic forward reasons but preserves pins', () => {
  const state = pin(initialExploration('A'), 'D');
  const next = explorationReducer(state, { type: 'toggleForward', courseId: 'A', children: dependents.get('A')! });
  assert.equal(next.expandedForward.has('A'), false);
  assert.equal(next.hiddenForwardConnections.has(edge('A', 'B')), true);
  assert.equal(next.hiddenForwardConnections.has(edge('A', 'X')), true);
  assert.equal(automaticForwardSources(next).has('A'), false);
  assert.deepEqual(graph(next).nodes.map(node => node.id), ['A', 'D']);
});

test('course-level plus restores direct hidden children and keeps deeper hidden choices', () => {
  let state = pin(initialExploration('A'), 'D');
  state.hiddenForwardConnections.add(edge('B', 'C'));
  state = explorationReducer(state, { type: 'toggleForward', courseId: 'A', children: dependents.get('A')! });
  const next = explorationReducer(state, { type: 'toggleForward', courseId: 'A', children: dependents.get('A')! });
  assert.equal(next.expandedForward.has('A'), true);
  assert.equal(next.hiddenForwardConnections.has(edge('A', 'B')), false);
  assert.equal(next.hiddenForwardConnections.has(edge('A', 'X')), false);
  assert.equal(next.hiddenForwardConnections.has(edge('B', 'C')), true);
  assert.equal(graph(next).nodes.some(node => node.id === 'C'), false);
});

test('restoring one hidden automatic edge does not reopen an unrelated hidden manual sibling', () => {
  let state = pin(initialExploration('A'), 'D');
  state = explorationReducer(state, { type: 'toggleForward', courseId: 'A', children: dependents.get('A')! });
  const next = explorationReducer(state, { type: 'restoreConnection', connectionId: edge('A', 'B') });
  assert.equal(next.hiddenForwardConnections.has(edge('A', 'X')), true);
  assert.equal(next.expandedForward.has('A'), false);
  assert.deepEqual(new Set(graph(next).nodes.map(node => node.id)), new Set(['A', 'D', 'B', 'C']));
});

test('individual-edge hiding preserves a pinned child and its independent expansion', () => {
  let state = pin(initialExploration('A'), 'B');
  state = explorationReducer(state, { type: 'toggleForward', courseId: 'B', children: dependents.get('B')! });
  const next = explorationReducer(state, { type: 'hideConnection', connectionId: edge('A', 'B') });
  assert.equal(graph(next).edges.some(relationship => relationship.source === 'A' && relationship.target === 'B'), false);
  assert.equal(graph(next).nodes.some(node => node.id === 'B'), true);
  assert.equal(graph(next).nodes.some(node => node.id === 'C'), true);
});

test('explicit connector revelation clears exactly its hidden steps and preserves other choices', () => {
  const initial = initialExploration('A');
  initial.hiddenForwardConnections.add(edge('B', 'C'));
  initial.hiddenForwardConnections.add(edge('A', 'X'));
  const pinned = pin(initial, 'D');
  assert.equal(pinned.automaticConnections.length, 0);
  assert.equal(pinned.hiddenForwardConnections.has(edge('B', 'C')), true);
  const next = explorationReducer(pinned, { type: 'revealConnection', courseId: 'D', context: context(pinned) });
  assert.equal(next.hiddenForwardConnections.has(edge('B', 'C')), false);
  assert.equal(next.hiddenForwardConnections.has(edge('A', 'X')), true);
  assert.equal(next.automaticConnections.length, 1);
  assert.equal(next.focusRequest!.sequence > pinned.focusRequest!.sequence, true);
  assert.deepEqual(new Set(graph(next).nodes.map(node => node.id)), new Set(['A', 'B', 'C', 'D']));
});

test('filtered connector proposals cannot disable filters or activate an ineligible intermediate', () => {
  const visible = (id: string) => id !== 'C';
  const pinned = pin(initialExploration('A'), 'D', visible);
  const next = explorationReducer(pinned, { type: 'revealConnection', courseId: 'D', context: context(pinned, visible) });
  assert.equal(next.automaticConnections.length, 0);
  assert.deepEqual(next.addedCourseIds, ['A', 'D']);
  assert.equal(graph(next, visible).nodes.some(node => node.id === 'C'), false);
});

test('backward exploration opens outside-filter prerequisites and toggles independently', () => {
  const initial = initialExploration('D');
  const open = explorationReducer(initial, { type: 'toggleBackward', parentId: 'D', courseId: 'C' });
  assert.deepEqual(graph(open, () => false).nodes.map(node => node.id), ['D', 'C']);
  assert.equal(initial.expandedBackward.size, 0);
  const closed = explorationReducer(open, { type: 'toggleBackward', parentId: 'D', courseId: 'C' });
  assert.deepEqual(graph(closed, () => false).nodes.map(node => node.id), ['D']);
});

test('collapsing automatic backward exploration preserves its explicit pins', () => {
  const pinned = pin(initialExploration('D'), 'A');
  const next = explorationReducer(pinned, { type: 'collapseBackward', courseId: 'C' });
  assert.equal(next.hiddenForwardConnections.has(edge('C', 'D')), true);
  assert.deepEqual(graph(next).nodes.map(node => node.id), ['D', 'A']);
  assert.deepEqual(next.addedCourseIds, ['D', 'A']);
});

test('more-layer action preserves hidden choices and branch reset keeps pin order', () => {
  const pinned = pin(initialExploration('A'), 'D');
  pinned.hiddenForwardConnections.add(edge('B', 'C'));
  const opened = explorationReducer(pinned, { type: 'expandVisible', courseIds: ['A', 'B', 'X'] });
  assert.equal(opened.hiddenForwardConnections.has(edge('B', 'C')), true);
  const reset = explorationReducer(opened, { type: 'resetBranches' });
  assert.deepEqual(reset.addedCourseIds, ['A', 'D']);
  assert.deepEqual([...reset.expandedForward], ['A', 'D']);
  assert.equal(reset.expandedBackward.size, 0);
  assert.equal(reset.hiddenForwardConnections.size, 0);
  assert.equal(reset.automaticConnections.length, 0);
});

test('restore recreates canonical sets/maps and keeps an intentional empty pin list', () => {
  const restored = explorationReducer(initialExploration('A'), {
    type: 'restore',
    saved: { addedCourseIds: [], expandedForward: ['B'], expandedBackward: [['C', ['B']]], hiddenForwardConnections: [edge('A', 'B')], automaticConnections: [] },
  });
  assert.deepEqual(restored.addedCourseIds, []);
  assert.deepEqual([...restored.expandedBackward.get('C')!], ['B']);
  assert.deepEqual(graph(restored), { nodes: [], edges: [] });
});

test('opening an auto prerequisite hidden by filters creates unfiltered manual backward selection in one action', () => {
  const pinned = pin(initialExploration('D'), 'A');
  const visible = (id: string) => id !== 'C';
  assert.deepEqual(graph(pinned, visible).nodes.map(node => node.id), ['D', 'A']);
  const next = explorationReducer(pinned, { type: 'toggleBackward', parentId: 'D', courseId: 'C', active: false });
  assert.equal(next.expandedBackward.get('D')?.has('C'), true);
  assert.equal(next.hiddenForwardConnections.has(edge('C', 'D')), false);
  assert.equal(graph(next, visible).nodes.some(node => node.id === 'C'), true);
});

test('opening filtered automatic forward intent uses the visible control state instead of collapsing latent intent', () => {
  const pinned = pin(initialExploration('A'), 'D');
  const visible = (id: string) => id !== 'C';
  assert.equal(graph(pinned, visible).nodes.some(node => node.id === 'B'), true);
  assert.equal(graph(pinned, visible).edges.some(relationship => relationship.source === 'B'), false);
  const next = explorationReducer(pinned, { type: 'toggleForward', courseId: 'B', active: false, children: dependents.get('B')! });
  assert.equal(next.expandedForward.has('B'), true);
  assert.equal(next.hiddenForwardConnections.has(edge('B', 'C')), false);
});

test('full collapse also suppresses automatic relationships omitted from a filtered child list', () => {
  const pinned = pin(initialExploration('A'), 'D');
  const next = explorationReducer(pinned, { type: 'toggleForward', courseId: 'A', active: true, children: [] });
  assert.equal(next.hiddenForwardConnections.has(edge('A', 'B')), true);
  assert.deepEqual(graph(next).nodes.map(node => node.id), ['A', 'D']);
});
