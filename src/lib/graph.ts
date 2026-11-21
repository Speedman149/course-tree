import type { Course, Requirement } from '../types';

export type Relationship = 'strong' | 'concurrent';
export type RequirementLeaf = Extract<Requirement, { type: 'course' }>;
export type CourseIndex = Map<string, Course>;
export interface Dependent { courseId: string; relation: Relationship }
export type DependentsIndex = Map<string, Dependent[]>;
export type BranchDirection = 'forward' | 'backward';

export interface ConnectionStep {
  /** Actual prerequisite-to-dependent arrow endpoints. */
  source: string;
  target: string;
  relation: Relationship;
  /** Direction in which this connection was explored. */
  direction: BranchDirection;
}
export interface CourseConnection {
  fromRootId: string;
  toRootId: string;
  steps: ConnectionStep[];
}
export interface GraphNode {
  /** Rendered identity is always the canonical course ID. */
  id: string;
  courseId: string;
  added: boolean;
  direction: 'root' | BranchDirection;
  relation?: Relationship;
  relations: Relationship[];
  parentId?: string;
  /** Dependents whose active backward exploration reveals this prerequisite. */
  backwardParents: string[];
  /** Membership in a genuine source-relationship cycle, never a repeated card. */
  cycle: boolean;
  missing: boolean;
}
export interface GraphEdge {
  id: string;
  /** Source is always the prerequisite, target is always the dependent. */
  source: string;
  target: string;
  relation: Relationship;
  direction: BranchDirection;
  directions: BranchDirection[];
  manual: boolean;
  automatic: boolean;
}

// Shared identities eliminate path multiplication. Emergency budgets remain well
// above the complete current indexed/reference universe and relationship count.
export const MAX_GRAPH_NODES = 10_000;
export const MAX_GRAPH_EDGES = 50_000;
export interface CourseGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated?: boolean;
}

/** Index involvement without changing the complete source AND/OR expression. */
export function collectRequirements(requirement: Requirement | null | undefined): RequirementLeaf[] {
  if (!requirement) return [];
  const leaves: RequirementLeaf[] = [];
  const seen = new Set<string>();
  const pending: Requirement[] = [requirement];
  const visited = new Set<Requirement>();
  while (pending.length) {
    const item = pending.pop()!;
    if (visited.has(item)) continue;
    visited.add(item);
    if (item.type === 'course') {
      const key = JSON.stringify([item.courseId, item.relation]);
      if (!seen.has(key)) {
        seen.add(key);
        leaves.push(item);
      }
    } else {
      for (let i = item.items.length - 1; i >= 0; i--) pending.push(item.items[i]);
    }
  }
  return leaves;
}

export function buildCourseIndex(courses: readonly Course[]): CourseIndex {
  return new Map(courses.map(course => [course.id, course]));
}
export function buildDependents(courses: readonly Course[]): DependentsIndex {
  const index: DependentsIndex = new Map();
  const seen = new Map<string, Set<string>>();
  for (const course of courses) {
    for (const requirement of collectRequirements(course.requirements)) {
      const key = JSON.stringify([course.id, requirement.relation]);
      const recorded = seen.get(requirement.courseId) ?? new Set<string>();
      if (recorded.has(key)) continue;
      recorded.add(key);
      seen.set(requirement.courseId, recorded);
      const dependents = index.get(requirement.courseId) ?? [];
      dependents.push({ courseId: course.id, relation: requirement.relation });
      index.set(requirement.courseId, dependents);
    }
  }
  return index;
}

/** Only for reading legacy occurrence-based saves, never for rendered identity. */
export function instanceId(parentId: string, direction: BranchDirection, courseId: string, relation: Relationship): string {
  return `${parentId}/${direction === 'forward' ? 'f' : 'b'}:${encodeURIComponent(courseId)}:${relation}`;
}

/** Stable identity for one actual course relationship and relationship type. */
export function forwardConnectionId(source: string, target: string, relation: Relationship): string {
  return `${source}->${target}:${relation}`;
}
export function parseConnectionId(id: string): { source: string; target: string; relation: Relationship } | null {
  if (typeof id !== 'string' || id.length > 160) return null;
  const match = /^([^\s:>]+)->([^\s:>]+):(strong|concurrent)$/.exec(id);
  return match ? { source: match[1], target: match[2], relation: match[3] as Relationship } : null;
}
export function restoreDirectConnections(hidden: ReadonlySet<string>, source: string): Set<string> {
  return new Set([...hidden].filter(id => parseConnectionId(id)?.source !== source));
}

/** Resolve exact IDs and only unambiguous source aliases/leading-zero forms. */
export function resolveCourseId(query: string, index: CourseIndex): string | null {
  if (typeof query !== 'string' || query.length > 64) return null;
  const trimmed = query.trim();
  if (index.has(trimmed)) return trimmed;
  if (!/^\d+$/.test(trimmed)) return null;
  const normalized = trimmed.replace(/^0+(?=\d)/, '');
  let result: string | null = null;
  for (const [id, course] of index) {
    if (![id, ...(course.aliases ?? [])].some(value => value.replace(/^0+(?=\d)/, '') === normalized)) continue;
    if (result !== null) return null;
    result = id;
  }
  return result;
}

interface CycleCache { dependents: DependentsIndex; ids: Set<string> }
const cycleCache = new WeakMap<CourseIndex, CycleCache>();

/** Iterative SCC detection runs once per immutable course/dependent index pair. */
export function cycleCourseIds(courses: CourseIndex, dependents: DependentsIndex): ReadonlySet<string> {
  const cached = cycleCache.get(courses);
  if (cached?.dependents === dependents) return cached.ids;
  const forward = new Map<string, string[]>();
  const reverse = new Map<string, string[]>();
  for (const id of courses.keys()) {
    forward.set(id, []);
    reverse.set(id, []);
  }
  for (const [source, children] of dependents) {
    if (!forward.has(source)) forward.set(source, []);
    if (!reverse.has(source)) reverse.set(source, []);
    for (const child of children) {
      if (!forward.has(child.courseId)) forward.set(child.courseId, []);
      if (!reverse.has(child.courseId)) reverse.set(child.courseId, []);
      forward.get(source)!.push(child.courseId);
      reverse.get(child.courseId)!.push(source);
    }
  }
  const visited = new Set<string>();
  const finish: string[] = [];
  for (const id of forward.keys()) {
    if (visited.has(id)) continue;
    visited.add(id);
    const pending = [{ id, next: 0 }];
    while (pending.length) {
      const frame = pending[pending.length - 1];
      const children = forward.get(frame.id)!;
      if (frame.next < children.length) {
        const child = children[frame.next++];
        if (!visited.has(child)) {
          visited.add(child);
          pending.push({ id: child, next: 0 });
        }
      } else {
        finish.push(frame.id);
        pending.pop();
      }
    }
  }
  const assigned = new Set<string>();
  const cycles = new Set<string>();
  for (const id of finish.reverse()) {
    if (assigned.has(id)) continue;
    const component: string[] = [];
    const pending = [id];
    assigned.add(id);
    while (pending.length) {
      const current = pending.pop()!;
      component.push(current);
      for (const parent of reverse.get(current)!) {
        if (assigned.has(parent)) continue;
        assigned.add(parent);
        pending.push(parent);
      }
    }
    if (component.length > 1 || forward.get(id)!.includes(id)) {
      for (const member of component) cycles.add(member);
    }
  }
  cycleCache.set(courses, { dependents, ids: cycles });
  return cycles;
}

export function stepTraversalSource(step: ConnectionStep): string {
  return step.direction === 'forward' ? step.source : step.target;
}
export function stepTraversalTarget(step: ConnectionStep): string {
  return step.direction === 'forward' ? step.target : step.source;
}
export function hasRelationship(dependents: DependentsIndex, source: string, target: string, relation: Relationship): boolean {
  return dependents.get(source)?.some(child => child.courseId === target && child.relation === relation) ?? false;
}

/** Forward expansion counts relationships, including children already visible elsewhere. */
export function forwardExpansionState(
  courseId: string,
  dependents: DependentsIndex,
  activeConnections: ReadonlySet<string>,
  isVisible: (id: string) => boolean,
) {
  const children = dependents.get(courseId) ?? [];
  const eligible = children.filter(child => isVisible(child.courseId));
  const active = children.filter(child => activeConnections.has(forwardConnectionId(courseId, child.courseId, child.relation)));
  const remaining = eligible.filter(child => !activeConnections.has(forwardConnectionId(courseId, child.courseId, child.relation)));
  const status: 'collapsed' | 'partial' | 'expanded' = !active.length ? 'collapsed' : remaining.length ? 'partial' : 'expanded';
  return { status, eligible, active, remaining };
}

export function graphRoots(primaryCourseId: string, addedCourseIds: readonly string[]): string[] {
  return [...new Set([primaryCourseId, ...addedCourseIds].filter(Boolean))];
}

/** Keep connector segments transitively needed by the remaining explicit anchors. */
export function requiredAutomaticConnections(anchors: readonly string[], connections: readonly CourseConnection[]): CourseConnection[] {
  const byTarget = new Map<string, CourseConnection[]>();
  for (const connection of connections) {
    const rows = byTarget.get(connection.toRootId) ?? [];
    rows.push(connection); byTarget.set(connection.toRootId, rows);
  }
  const needed = new Set(anchors), queue = [...needed];
  for (let i = 0; i < queue.length; i++) {
    for (const connection of byTarget.get(queue[i]) ?? []) {
      if (!needed.has(connection.fromRootId)) { needed.add(connection.fromRootId); queue.push(connection.fromRootId); }
    }
  }
  return connections.filter(connection => needed.has(connection.toRootId));
}

function automaticAdjacency(
  connections: readonly CourseConnection[],
  anchors: ReadonlySet<string>,
  dependents: DependentsIndex,
  isVisible: (id: string) => boolean,
  hidden: ReadonlySet<string>,
): { adjacency: Map<string, ConnectionStep[]>; auxiliaryRoots: string[] } {
  const valid = connections.filter(connection => {
    if (connection.fromRootId === connection.toRootId || !connection.steps.length || connection.steps.length > MAX_GRAPH_NODES) return false;
    let current = connection.fromRootId;
    for (const step of connection.steps) {
      if (!['forward', 'backward'].includes(step.direction) || !['strong', 'concurrent'].includes(step.relation) ||
          stepTraversalSource(step) !== current || !hasRelationship(dependents, step.source, step.target, step.relation)) return false;
      current = stepTraversalTarget(step);
    }
    return current === connection.toRootId;
  });
  const required = requiredAutomaticConnections([...anchors], valid);
  const permitted = required.filter(connection => connection.steps.every(step =>
    !hidden.has(forwardConnectionId(step.source, step.target, step.relation)) &&
    [step.source, step.target].every(id => anchors.has(id) || isVisible(id))));
  const active = requiredAutomaticConnections([...anchors], permitted);
  const activeIds = new Set(active.flatMap(connection => [connection.fromRootId, connection.toRootId]));
  const targets = new Set(required.map(connection => connection.toRootId));
  // An independently added start can later become an intermediate needed by another addition.
  // Do not promote it back into the user's collection or bypass a hidden upstream segment.
  const auxiliaryRoots = [...new Set(required.map(connection => connection.fromRootId))]
    .filter(id => !anchors.has(id) && !targets.has(id) && activeIds.has(id));
  const adjacency = new Map<string, ConnectionStep[]>(), seen = new Set<string>();
  for (const connection of required) for (const step of connection.steps) {
    const key = `${forwardConnectionId(step.source, step.target, step.relation)}:${step.direction}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const start = stepTraversalSource(step), steps = adjacency.get(start) ?? [];
    steps.push(step); adjacency.set(start, steps);
  }
  return { adjacency, auxiliaryRoots };
}

/**
 * A canonical course is enqueued once. Each active real relationship is emitted
 * once even when manual forward/backward exploration or several additions share it.
 * Latent expansion state is never mutated while deriving reachability.
 */
export function buildGraph(
  rootIds: readonly string[],
  coursesById: CourseIndex,
  dependents: DependentsIndex,
  expandedForward: ReadonlySet<string>,
  expandedBackward: ReadonlyMap<string, ReadonlySet<string>>,
  isForwardVisible: (courseId: string) => boolean = () => true,
  hiddenForwardConnections: ReadonlySet<string> = new Set(),
  automaticConnections: readonly CourseConnection[] = [],
  revealedForwardConnections: ReadonlySet<string> = new Set(),
  additions: ReadonlySet<string> = new Set(rootIds),
  autoExpandedCourseIds: ReadonlySet<string> = new Set(),
): CourseGraph {
  const anchors = new Set(rootIds);
  if (!anchors.size) return { nodes: [], edges: [] };
  const cycles = cycleCourseIds(coursesById, dependents);
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const pending: string[] = [];
  const graph: CourseGraph = { nodes: [], edges: [] };
  const automatic = automaticAdjacency(automaticConnections, anchors, dependents, isForwardVisible, hiddenForwardConnections);

  const ensureNode = (id: string): GraphNode => {
    let node = nodes.get(id);
    if (!node) {
      node = {
        id, courseId: id, added: additions.has(id),
        direction: anchors.has(id) ? 'root' : 'forward',
        relations: [], backwardParents: [],
        cycle: cycles.has(id), missing: !coursesById.has(id),
      };
      nodes.set(id, node);
      pending.push(id);
    }
    return node;
  };
  // Explicit graph anchors are inserted first, preserving user order and visibility.
  for (const id of anchors) ensureNode(id);
  for (const id of automatic.auxiliaryRoots) ensureNode(id);

  const reveal = (step: ConnectionStep, manual: boolean): void => {
    const key = forwardConnectionId(step.source, step.target, step.relation);
    const destination = stepTraversalTarget(step);
    if ((!edges.has(key) && edges.size >= MAX_GRAPH_EDGES) ||
        (!nodes.has(destination) && nodes.size >= MAX_GRAPH_NODES)) {
      graph.truncated = true;
      return;
    }
    const node = ensureNode(destination);
    if (!node.relations.includes(step.relation)) node.relations.push(step.relation);
    node.relations.sort((a, b) => a === b ? 0 : a === 'strong' ? -1 : 1);
    node.relation = node.relations.length === 1 ? node.relations[0] : undefined;
    node.parentId ??= stepTraversalSource(step);
    if (step.direction === 'backward' && !node.backwardParents.includes(step.target)) {
      node.backwardParents.push(step.target);
    }
    if (!node.added && node.backwardParents.length) node.direction = 'backward';
    let edge = edges.get(key);
    if (!edge) {
      edge = {
        id: `edge:${key}`, source: step.source, target: step.target,
        relation: step.relation, direction: step.direction,
        directions: [], manual: false, automatic: false,
      };
      edges.set(key, edge);
    }
    if (!edge.directions.includes(step.direction)) edge.directions.push(step.direction);
    edge.directions.sort((a, b) => a === b ? 0 : a === 'forward' ? -1 : 1);
    edge.direction = edge.directions.includes('forward') ? 'forward' : 'backward';
    edge.manual ||= manual;
    edge.automatic ||= !manual;
  };

  for (let next = 0; next < pending.length; next++) {
    const id = pending[next];
    const course = coursesById.get(id);
    if (course && (expandedForward.has(id) || revealedForwardConnections.size)) {
      for (const child of dependents.get(id) ?? []) {
        const key = forwardConnectionId(id, child.courseId, child.relation);
        if ((!expandedForward.has(id) && !revealedForwardConnections.has(key)) ||
            !isForwardVisible(child.courseId) || hiddenForwardConnections.has(key)) continue;
        reveal({ source: id, target: child.courseId, relation: child.relation, direction: 'forward' }, !autoExpandedCourseIds.has(id) || revealedForwardConnections.has(key));
      }
    }
    const selected = expandedBackward.get(id);
    if (course && selected?.size) {
      for (const prerequisite of collectRequirements(course.requirements)) {
        if (!selected.has(prerequisite.courseId)) continue;
        reveal({ source: prerequisite.courseId, target: id, relation: prerequisite.relation, direction: 'backward' }, true);
      }
    }
    for (const step of automatic.adjacency.get(id) ?? []) {
      const key = forwardConnectionId(step.source, step.target, step.relation);
      const target = stepTraversalTarget(step);
      if (hiddenForwardConnections.has(key) || (!anchors.has(target) && !isForwardVisible(target))) continue;
      reveal(step, false);
    }
  }
  graph.nodes = [...nodes.values()];
  graph.edges = [...edges.values()];
  return graph;
}
