import dagre from '@dagrejs/dagre';
import type { CourseGraph } from './graph';

export const COURSE_WIDTH = 286;
export const COURSE_HEIGHT = 168;
const RANK_GAP = 110;
const NODE_GAP = 36;
type Position = { x: number; y: number };

export function graphComponents(graph: CourseGraph): string[][] {
  const adjacency = new Map(graph.nodes.map(node => [node.id, new Set<string>()]));
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }
  const seen = new Set<string>();
  const components: string[][] = [];
  for (const node of graph.nodes) {
    if (seen.has(node.id)) continue;
    const ids = [node.id];
    seen.add(node.id);
    for (let i = 0; i < ids.length; i++) {
      for (const next of adjacency.get(ids[i]) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        ids.push(next);
      }
    }
    components.push(ids);
  }
  return components;
}

/** Linear-work fallback for unusually dense input or a layout-engine failure. */
function layeredPositions(ids: string[], edges: CourseGraph['edges']): Map<string, Position> {
  const outgoing = new Map(ids.map(id => [id, new Set<string>()]));
  const incoming = new Map(ids.map(id => [id, 0]));
  for (const edge of edges) {
    if (outgoing.get(edge.source)!.has(edge.target)) continue;
    outgoing.get(edge.source)!.add(edge.target);
    incoming.set(edge.target, incoming.get(edge.target)! + 1);
  }
  const ranks = new Map(ids.map(id => [id, 0]));
  const queue = ids.filter(id => incoming.get(id) === 0);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const child of outgoing.get(id)!) {
      ranks.set(child, Math.max(ranks.get(child)!, ranks.get(id)! + 1));
      incoming.set(child, incoming.get(child)! - 1);
      if (incoming.get(child) === 0) queue.push(child);
    }
  }
  const rows = new Map<number, number>();
  return new Map(ids.map(id => {
    const rank = ranks.get(id)!;
    const row = rows.get(rank) ?? 0;
    rows.set(rank, row + 1);
    return [id, { x: -rank * (COURSE_WIDTH + RANK_GAP), y: row * (COURSE_HEIGHT + NODE_GAP) }];
  }));
}

/** Keep independent starting components aligned, with genuine prerequisite ordering inside each. */
export function layoutCourseGraph(graph: CourseGraph, addedCourseIds: readonly string[]): Map<string, Position> {
  const order = new Map(addedCourseIds.map((id, i) => [id, i]));
  const components = graphComponents(graph).sort((left, right) =>
    Math.min(...left.map(id => order.get(id) ?? Infinity)) - Math.min(...right.map(id => order.get(id) ?? Infinity)));
  const result = new Map<string, Position>();
  let top = 50;
  for (const component of components) {
    const ids = [...component].sort();
    const members = new Set(ids);
    const edges = graph.edges.filter(edge => members.has(edge.source) && members.has(edge.target));
    let positions: Map<string, Position>;
    // Dense relations cost more than cards. Preserve every edge without an expensive crossing search.
    if (edges.length > 2000 && edges.length > ids.length * 8) {
      positions = layeredPositions(ids, edges);
    } else {
      try {
        const layout = new dagre.graphlib.Graph();
        layout.setGraph({ rankdir: 'RL', ranksep: RANK_GAP, nodesep: NODE_GAP });
        layout.setDefaultEdgeLabel(() => ({}));
        for (const id of ids) layout.setNode(id, { width: COURSE_WIDTH, height: COURSE_HEIGHT });
        for (const edge of edges) layout.setEdge(edge.source, edge.target);
        dagre.layout(layout);
        positions = new Map(ids.map(id => {
          const point = layout.node(id);
          return [id, { x: point.x - COURSE_WIDTH / 2, y: point.y - COURSE_HEIGHT / 2 }];
        }));
      } catch {
        positions = layeredPositions(ids, edges);
      }
    }
    // Align independent components by prerequisite rank, never by a privileged first addition.
    const anchorX = Math.max(...[...positions.values()].map(point => point.x));
    const minY = Math.min(...[...positions.values()].map(point => point.y));
    const maxY = Math.max(...[...positions.values()].map(point => point.y));
    for (const [id, point] of positions) result.set(id, { x: point.x - anchorX, y: point.y - minY + top });
    top += maxY - minY + COURSE_HEIGHT + 70;
  }
  return result;
}
