import type { Course, Requirement } from '../types';

export type Relationship = 'strong' | 'concurrent';
export type RequirementLeaf = Extract<Requirement, { type: 'course' }>;
export type CourseIndex = Map<string, Course>;

export interface Dependent {
  courseId: string;
  relation: Relationship;
}

export type DependentsIndex = Map<string, Dependent[]>;
export type BranchDirection = 'forward' | 'backward';

export interface GraphNode {
  id: string;
  courseId: string;
  direction: 'root' | BranchDirection;
  relation?: Relationship;
  parentId?: string;
  /** Repeated ancestor courses are shown once and cannot expand again. */
  cycle: boolean;
  /** Keep referenced courses visible even if their records are unavailable. */
  missing: boolean;
}

export interface GraphEdge {
  id: string;
  /** Source is always the prerequisite, target is always the dependent. */
  source: string;
  target: string;
  relation: Relationship;
  direction: BranchDirection;
}

export const MAX_GRAPH_NODES = 2000;
export const MAX_GRAPH_DEPTH = 60;

export interface CourseGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated?: boolean;
}

/**
 * Return relation leaves for graph connections, without changing the source AST.
 * These leaves identify involvement in a requirement; they do not mean that any
 * one leaf is sufficient to enroll. Display the original AST to explain AND/OR.
 */
export function collectRequirements(
  requirement: Requirement | null | undefined,
): RequirementLeaf[] {
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
      // Preserve the order in the catalog while walking the AST iteratively.
      for (let i = item.items.length - 1; i >= 0; i--) {
        pending.push(item.items[i]);
      }
    }
  }
  return leaves;
}

export function buildCourseIndex(courses: readonly Course[]): CourseIndex {
  return new Map(courses.map((course) => [course.id, course]));
}

export function buildDependents(courses: readonly Course[]): DependentsIndex {
  const index: DependentsIndex = new Map();
  const seen = new Map<string, Set<string>>();
  for (const course of courses) {
    for (const requirement of collectRequirements(course.requirements)) {
      const key = JSON.stringify([course.id, requirement.relation]);
      const existing = seen.get(requirement.courseId) ?? new Set<string>();
      if (existing.has(key)) continue;
      existing.add(key);
      seen.set(requirement.courseId, existing);
      const dependents = index.get(requirement.courseId) ?? [];
      dependents.push({
        courseId: course.id,
        relation: requirement.relation,
      });
      index.set(requirement.courseId, dependents);
    }
  }
  return index;
}

/**
 * Stable identities belong to a branch instance, so the same course reached
 * through two parents can be independently expanded or collapsed.
 */
export function instanceId(
  parentId: string,
  direction: BranchDirection,
  courseId: string,
  relation: Relationship,
): string {
  return `${parentId}/${direction === 'forward' ? 'f' : 'b'}:${encodeURIComponent(courseId)}:${relation}`;
}

/** A stable source-path + target-course + relation key, independent of React Flow. */
export function forwardConnectionId(parentId: string, courseId: string, relation: Relationship): string {
  return instanceId(parentId, 'forward', courseId, relation);
}

/** Course-level + restores direct hidden children without erasing deeper choices. */
export function restoreDirectConnections(hidden: ReadonlySet<string>, parentId: string): Set<string> {
  const prefix = `${parentId}/f:`;
  return new Set([...hidden].filter(id => !id.startsWith(prefix) || id.slice(prefix.length).includes('/')));
}

/**
 * Match exact course numbers first. Leading-zero normalization is allowed only
 * when it identifies one record; six/seven digit catalog renumbering is never
 * inferred. Explicit source-provided aliases are accepted when unambiguous.
 */
export function resolveCourseId(query: string, index: CourseIndex): string | null {
  if (typeof query !== 'string' || query.length > 64) return null;
  const trimmed = query.trim();
  if (index.has(trimmed)) return trimmed;
  if (!/^\d+$/.test(trimmed)) return null;
  const normalized = trimmed.replace(/^0+(?=\d)/, '');
  let result: string | null = null;
  for (const [id, course] of index) {
    const ids = [id, ...(course.aliases ?? [])];
    if (!ids.some((value) => value.replace(/^0+(?=\d)/, '') === normalized)) continue;
    if (result !== null) return null;
    result = id;
  }
  return result;
}

/**
 * Build only visible instances. Expansion state below a collapsed branch may
 * remain in the caller's state; those descendants reappear only if reopened.
 * An explicit ancestor set bounds cyclic prerequisite data in either direction.
 */
export function buildGraph(
  rootId: string,
  coursesById: CourseIndex,
  dependents: DependentsIndex,
  expandedForward: ReadonlySet<string>,
  expandedBackward: ReadonlyMap<string, ReadonlySet<string>>,
  isForwardVisible: (courseId: string) => boolean = () => true,
  hiddenForwardConnections: ReadonlySet<string> = new Set(),
): CourseGraph {
  const root: GraphNode = {
    id: 'root',
    courseId: rootId,
    direction: 'root',
    cycle: false,
    missing: !coursesById.has(rootId),
  };
  const graph: CourseGraph = { nodes: [root], edges: [] };
  const pending: { node: GraphNode; ancestors: Set<string>; depth: number }[] = [
    { node: root, ancestors: new Set([rootId]), depth: 0 },
  ];

  for (let next = 0; next < pending.length; next++) {
    const { node, ancestors, depth } = pending[next];
    if (node.cycle || node.missing) continue;

    const append = (
      courseId: string,
      relation: Relationship,
      direction: BranchDirection,
    ) => {
      if (graph.nodes.length >= MAX_GRAPH_NODES || depth >= MAX_GRAPH_DEPTH) {
        graph.truncated = true;
        return;
      }
      const child: GraphNode = {
        id: instanceId(node.id, direction, courseId, relation),
        courseId,
        direction,
        relation,
        parentId: node.id,
        cycle: ancestors.has(courseId),
        missing: !coursesById.has(courseId),
      };
      graph.nodes.push(child);
      graph.edges.push({
        id: `edge:${child.id}`,
        source: direction === 'forward' ? node.id : child.id,
        target: direction === 'forward' ? child.id : node.id,
        relation,
        direction,
      });
      if (!child.cycle && !child.missing) {
        pending.push({
          node: child,
          ancestors: new Set([...ancestors, courseId]),
          depth: depth + 1,
        });
      }
    };

    if (expandedForward.has(node.id)) {
      for (const dependent of dependents.get(node.courseId) ?? []) {
        if (!isForwardVisible(dependent.courseId)) continue;
        // Traverse from the root only through visible connections. Never globally
        // delete a course: another parent/path may still reach another instance.
        if (hiddenForwardConnections.has(forwardConnectionId(node.id, dependent.courseId, dependent.relation))) continue;
        if (graph.nodes.length >= MAX_GRAPH_NODES) { graph.truncated = true; break; }
        append(dependent.courseId, dependent.relation, 'forward');
      }
    }

    const selectedPrerequisites = expandedBackward.get(node.id);
    if (selectedPrerequisites?.size) {
      const course = coursesById.get(node.courseId)!;
      for (const requirement of collectRequirements(course.requirements)) {
        if (selectedPrerequisites.has(requirement.courseId)) {
          if (graph.nodes.length >= MAX_GRAPH_NODES) { graph.truncated = true; break; }
          append(requirement.courseId, requirement.relation, 'backward');
        }
      }
    }
  }
  return graph;
}
