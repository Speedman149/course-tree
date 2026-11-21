import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSE_WIDTH, COURSE_HEIGHT, graphComponents, layoutCourseGraph } from '../src/lib/layout';
import type { CourseGraph, GraphNode, GraphEdge, Relationship } from '../src/lib/graph';

function fixture(
  ids: string[],
  connections: [string, string, Relationship?][],
  pins: string[],
): CourseGraph {
  return {
    nodes: ids.map<GraphNode>(id => ({
      id, courseId: id, pinned: pins.includes(id),
      direction: pins.includes(id) ? 'root' : 'forward',
      relations: [], backwardParents: [], cycle: false, missing: false,
    })),
    edges: connections.map<GraphEdge>(([source, target, relation = 'strong']) => ({
      id: 'edge:' + source + '->' + target + ':' + relation,
      source, target, relation, direction: 'forward',
      directions: ['forward'], manual: true, automatic: false,
    })),
  };
}

function assertFiniteAndSeparated(graph: CourseGraph, positions: ReturnType<typeof layoutCourseGraph>): void {
  assert.equal(positions.size, graph.nodes.length);
  for (const node of graph.nodes) {
    const point = positions.get(node.id);
    assert.ok(point, 'Missing position for ' + node.id);
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), 'Nonfinite position for ' + node.id);
  }
  for (let first = 0; first < graph.nodes.length; first++) {
    const left = positions.get(graph.nodes[first].id)!;
    for (let second = first + 1; second < graph.nodes.length; second++) {
      const right = positions.get(graph.nodes[second].id)!;
      const overlapX = Math.min(left.x + COURSE_WIDTH, right.x + COURSE_WIDTH) - Math.max(left.x, right.x);
      const overlapY = Math.min(left.y + COURSE_HEIGHT, right.y + COURSE_HEIGHT) - Math.max(left.y, right.y);
      assert.ok(overlapX <= .01 || overlapY <= .01, graph.nodes[first].id + ' overlaps ' + graph.nodes[second].id);
    }
  }
}

test('unrelated starting components align at the same horizontal level without overlapping cards', () => {
  const graph = fixture(['A', 'B', 'C', 'X', 'Y'], [['A', 'B'], ['B', 'C'], ['X', 'Y']], ['A', 'X']);
  const positions = layoutCourseGraph(graph, ['A', 'X']);
  assertFiniteAndSeparated(graph, positions);
  assert.equal(positions.get('A')!.x, positions.get('X')!.x);
  assert.ok(positions.get('A')!.x > positions.get('B')!.x);
  assert.ok(positions.get('B')!.x > positions.get('C')!.x);
  const firstBottom = Math.max(...['A', 'B', 'C'].map(id => positions.get(id)!.y + COURSE_HEIGHT));
  const secondTop = Math.min(...['X', 'Y'].map(id => positions.get(id)!.y));
  assert.ok(secondTop >= firstBottom + 69);
});

test('related pinned courses retain actual prerequisite order in either pin ordering', () => {
  const graph = fixture(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']], ['A', 'C']);
  for (const pins of [['A', 'C'], ['C', 'A']]) {
    const positions = layoutCourseGraph(graph, pins);
    assertFiniteAndSeparated(graph, positions);
    assert.ok(positions.get('A')!.x > positions.get('B')!.x);
    assert.ok(positions.get('B')!.x > positions.get('C')!.x);
    assert.notEqual(positions.get('A')!.x, positions.get('C')!.x);
    assert.equal(positions.get(pins[0])!.x, 0);
  }
});

test('pin ordering controls disconnected component placement without fabricating connections', () => {
  const graph = fixture(['A', 'B', 'X', 'Y'], [['A', 'B'], ['X', 'Y']], ['X', 'A']);
  assert.deepEqual(graphComponents(graph), [['A', 'B'], ['X', 'Y']]);
  const positions = layoutCourseGraph(graph, ['X', 'A']);
  assertFiniteAndSeparated(graph, positions);
  assert.ok(positions.get('X')!.y < positions.get('A')!.y);
  assert.equal(graph.edges.length, 2);
});

test('parallel strong and concurrent relationships share the same two course positions', () => {
  const graph = fixture(['A', 'B'], [['A', 'B', 'strong'], ['A', 'B', 'concurrent']], ['A']);
  const positions = layoutCourseGraph(graph, ['A']);
  assertFiniteAndSeparated(graph, positions);
  assert.equal(positions.size, 2);
  assert.ok(positions.get('A')!.x > positions.get('B')!.x);
  assert.equal(graph.edges.length, 2);
});

test('cycles terminate with finite separated positions and preserve every actual relationship', () => {
  const graph = fixture(['A', 'B', 'C', 'D'], [['A', 'B'], ['B', 'C'], ['C', 'A'], ['C', 'D']], ['C']);
  const positions = layoutCourseGraph(graph, ['C']);
  assertFiniteAndSeparated(graph, positions);
  assert.deepEqual(graphComponents(graph), [['A', 'B', 'C', 'D']]);
  assert.equal(graph.edges.length, 4);
});

test('dense fallback retains all nodes and relationships with consistent prerequisite ranks', () => {
  const middle = Array.from({ length: 50 }, (_, index) => 'M' + String(index).padStart(2, '0'));
  const end = Array.from({ length: 50 }, (_, index) => 'Z' + String(index).padStart(2, '0'));
  const edges: [string, string][] = [
    ...middle.map(id => ['A', id] as [string, string]),
    ...middle.flatMap(parent => end.map(child => [parent, child] as [string, string])),
  ];
  const graph = fixture(['A', ...middle, ...end], edges, ['A']);
  const positions = layoutCourseGraph(graph, ['A']);
  assertFiniteAndSeparated(graph, positions);
  assert.equal(positions.size, 101);
  assert.equal(graph.edges.length, 2550);
  for (const [source, target] of edges) assert.ok(positions.get(source)!.x > positions.get(target)!.x);
  assert.deepEqual(layoutCourseGraph(graph, ['A']), positions);
});

test('long finite chains and an empty graph have complete deterministic layouts', () => {
  const ids = Array.from({ length: 150 }, (_, index) => 'N' + String(index).padStart(3, '0'));
  const edges = ids.slice(1).map((id, index) => [ids[index], id] as [string, string]);
  const graph = fixture(ids, edges, [ids[0]]);
  const positions = layoutCourseGraph(graph, [ids[0]]);
  assertFiniteAndSeparated(graph, positions);
  for (const [source, target] of edges) assert.ok(positions.get(source)!.x > positions.get(target)!.x);
  assert.deepEqual(graphComponents({ nodes: [], edges: [] }), []);
  assert.equal(layoutCourseGraph({ nodes: [], edges: [] }, []).size, 0);
});
