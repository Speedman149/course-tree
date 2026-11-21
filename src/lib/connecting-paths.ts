import {
  collectRequirements, forwardConnectionId, stepTraversalTarget,
  type BranchDirection, type ConnectionStep, type CourseIndex,
  type Dependent, type DependentsIndex, type CourseConnection,
} from './graph';

export interface CourseConnectionOptions {
  visibleCourseIds?: ReadonlySet<string>;
  hiddenForwardConnections?: ReadonlySet<string>;
  isForwardVisible?: (courseId: string) => boolean;
  maxAutomaticNewNodes?: number;
  maxAutomaticSteps?: number;
}
export interface CourseConnectionResult {
  reason: 'visible' | 'connected' | 'long' | 'hidden' | 'filtered' | 'unrelated';
  connection: CourseConnection | null;
  autoReveal: boolean;
  newCourseCount: number;
  blockedConnectionIds: string[];
}
interface NeighborIndex {
  dependents: DependentsIndex;
  forward: Map<string, Dependent[]>;
  backward: Map<string, Dependent[]>;
}
const neighborCache = new WeakMap<CourseIndex, NeighborIndex>();

function neighbors(courses: CourseIndex, dependents: DependentsIndex): NeighborIndex {
  const cached = neighborCache.get(courses);
  if (cached?.dependents === dependents) return cached;
  const compare = (a: Dependent, b: Dependent) =>
    a.courseId.localeCompare(b.courseId, 'en') ||
    (a.relation === b.relation ? 0 : a.relation === 'strong' ? -1 : 1);
  const forward = new Map([...dependents].map(([id, rows]) => [id, [...rows].sort(compare)]));
  const backward = new Map([...courses].map(([id, course]) => [
    id, collectRequirements(course.requirements).map(row => ({
      courseId: row.courseId, relation: row.relation,
    })).sort(compare),
  ]));
  const index = { dependents, forward, backward };
  neighborCache.set(courses, index);
  return index;
}

interface SearchState {
  id: string;
  direction: BranchDirection;
  rootId: string;
  rootOrder: number;
  visibleCount: number;
  previous?: SearchState;
  step?: ConnectionStep;
}
function preferred(a: SearchState, b: SearchState): boolean {
  return a.visibleCount > b.visibleCount ||
    (a.visibleCount === b.visibleCount && a.rootOrder < b.rootOrder);
}

/**
 * Multi-source breadth-first search. Each direction/course pair is considered
 * at its shortest distance, retaining the most already-visible equal-length
 * path. A connection is pure prerequisite ancestry or pure dependency ancestry.
 */
function shortestConnection(
  addedCourseIds: readonly string[],
  target: string,
  courses: CourseIndex,
  index: NeighborIndex,
  visible: ReadonlySet<string>,
  hidden: ReadonlySet<string>,
  isVisible: (id: string) => boolean,
  ignoreHidden: boolean,
  ignoreFilters: boolean,
): CourseConnection | null {
  const pins = new Set(addedCourseIds);
  let frontier: SearchState[] = addedCourseIds.flatMap((rootId, rootOrder) =>
    (['forward', 'backward'] as const).map(direction => ({
      id: rootId, direction, rootId, rootOrder, visibleCount: 0,
    })));
  const distance = new Map<string, number>();
  for (const state of frontier) distance.set(`${state.direction}:${state.id}`, 0);
  let depth = 0;
  while (frontier.length) {
    const matches = frontier.filter(state => state.id === target);
    if (matches.length) {
      const best = matches.reduce((chosen, state) => preferred(state, chosen) ? state : chosen);
      const steps: ConnectionStep[] = [];
      for (let current = best; current.previous; current = current.previous) steps.push(current.step!);
      return { fromRootId: best.rootId, toRootId: target, steps: steps.reverse() };
    }
    const next = new Map<string, SearchState>();
    for (const state of frontier) {
      // A known dependent's AST can document a forward edge from a missing
      // prerequisite record. Its own backward requirements remain unavailable.
      if (state.direction === 'backward' && !courses.has(state.id)) continue;
      const adjacent = state.direction === 'forward' ? index.forward : index.backward;
      for (const neighbor of adjacent.get(state.id) ?? []) {
        const step: ConnectionStep = state.direction === 'forward' ? {
          source: state.id, target: neighbor.courseId, relation: neighbor.relation, direction: 'forward',
        } : {
          source: neighbor.courseId, target: state.id, relation: neighbor.relation, direction: 'backward',
        };
        const key = forwardConnectionId(step.source, step.target, step.relation);
        if (!ignoreHidden && hidden.has(key)) continue;
        if (!ignoreFilters && neighbor.courseId !== target && !pins.has(neighbor.courseId) && !isVisible(neighbor.courseId)) continue;
        const stateKey = `${state.direction}:${neighbor.courseId}`;
        const existingDistance = distance.get(stateKey);
        if (existingDistance !== undefined && existingDistance < depth + 1) continue;
        const candidate: SearchState = {
          id: neighbor.courseId, direction: state.direction,
          rootId: state.rootId, rootOrder: state.rootOrder,
          visibleCount: state.visibleCount + (visible.has(neighbor.courseId) ? 1 : 0),
          previous: state, step,
        };
        const existing = next.get(stateKey);
        if (!existing || preferred(candidate, existing)) next.set(stateKey, candidate);
        distance.set(stateKey, depth + 1);
      }
    }
    frontier = [...next.values()];
    depth++;
  }
  return null;
}

function resultFor(
  connection: CourseConnection,
  reason: 'connected' | 'long' | 'hidden' | 'filtered',
  visible: ReadonlySet<string>,
  hidden: ReadonlySet<string>,
): CourseConnectionResult {
  const added = new Set(connection.steps.map(stepTraversalTarget));
  added.delete(connection.toRootId);
  for (const id of visible) added.delete(id);
  return {
    reason, connection, autoReveal: reason === 'connected',
    newCourseCount: added.size,
    blockedConnectionIds: [...new Set(connection.steps
      .map(step => forwardConnectionId(step.source, step.target, step.relation))
      .filter(id => hidden.has(id)))],
  };
}

/** Find the connecting path only. The caller decides which state to activate. */
export function findCourseConnection(
  addedCourseIds: readonly string[],
  targetCourseId: string,
  coursesById: CourseIndex,
  dependents: DependentsIndex,
  options: CourseConnectionOptions = {},
): CourseConnectionResult {
  const visible = options.visibleCourseIds ?? new Set(addedCourseIds);
  const empty = (reason: 'visible' | 'unrelated'): CourseConnectionResult => ({
    reason, connection: null, autoReveal: false, newCourseCount: 0, blockedConnectionIds: [],
  });
  if (visible.has(targetCourseId) || addedCourseIds.includes(targetCourseId)) return empty('visible');
  if (!addedCourseIds.length) return empty('unrelated');
  const hidden = options.hiddenForwardConnections ?? new Set<string>();
  const isVisible = options.isForwardVisible ?? (() => true);
  const index = neighbors(coursesById, dependents);
  const search = (ignoreHidden: boolean, ignoreFilters: boolean) =>
    shortestConnection(addedCourseIds, targetCourseId, coursesById, index, visible, hidden, isVisible, ignoreHidden, ignoreFilters);
  const strict = search(false, false);
  if (strict) {
    const result = resultFor(strict, 'connected', visible, hidden);
    if (result.newCourseCount > (options.maxAutomaticNewNodes ?? 8) ||
        strict.steps.length > (options.maxAutomaticSteps ?? 12)) {
      result.reason = 'long';
      result.autoReveal = false;
    }
    return result;
  }
  const throughHidden = search(true, false);
  if (throughHidden) return resultFor(throughHidden, 'hidden', visible, hidden);
  const throughFilters = search(false, true) ?? search(true, true);
  return throughFilters ? resultFor(throughFilters, 'filtered', visible, hidden) : empty('unrelated');
}
