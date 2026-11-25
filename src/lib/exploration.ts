import type { CourseIndex, DependentsIndex, CourseConnection, CourseGraph } from './graph';
import { forwardConnectionId, parseConnectionId, restoreDirectConnections, buildGraph, graphRoots, requiredAutomaticConnections } from './graph';
import { findCourseConnection } from './connecting-paths';

export interface ExplorationState {
  addedCourseIds: string[];
  expandedForward: Set<string>;
  autoExpandedCourseIds: Set<string>;
  revealedForwardConnections: Set<string>;
  expandedBackward: Map<string, Set<string>>;
  hiddenForwardConnections: Set<string>;
  automaticConnections: CourseConnection[];
  treeMessage: string;
  focusRequest: { courseId: string; sequence: number } | null;
}
export interface AddCourseContext {
  courses: CourseIndex;
  dependents: DependentsIndex;
  visibleCourseIds: ReadonlySet<string>;
  isVisible: (courseId: string) => boolean;
}
export interface ExplorationSnapshot {
  addedCourseIds: string[];
  expandedForward: string[];
  autoExpandedCourseIds?: string[];
  revealedForwardConnections?: string[];
  expandedBackward: [string, string[]][];
  hiddenForwardConnections: string[];
  automaticConnections: CourseConnection[];
}
export type ExplorationAction =
  | { type: 'restore'; saved: ExplorationSnapshot }
  | { type: 'clearAdded' }
  | { type: 'toggleAdded' | 'addCourse' | 'removeCourse'; courseId: string; context: AddCourseContext }
  | { type: 'locateAdded'; courseId: string; context: AddCourseContext }
  | { type: 'revealConnection'; courseId: string; context: AddCourseContext }
  | { type: 'toggleForward'; courseId: string; active?: boolean; children: { courseId: string; relation: 'strong' | 'concurrent' }[] }
  | { type: 'toggleBackward'; parentId: string; courseId: string; active?: boolean }
  | { type: 'collapseBackward'; courseId: string }
  | { type: 'hideConnection'; connectionId: string }
  | { type: 'restoreConnection'; connectionId: string }
  | { type: 'revealConnections'; connectionIds: string[] }
  | { type: 'expandVisible'; courseIds: string[] }
  | { type: 'resetBranches' }
  | { type: 'clearMessage' };

export function initialExploration(defaultRoot = '02340114'): ExplorationState {
  return {
    addedCourseIds: defaultRoot ? [defaultRoot] : [],
    expandedForward: new Set(defaultRoot ? [defaultRoot] : []),
    autoExpandedCourseIds: new Set(defaultRoot ? [defaultRoot] : []),
    revealedForwardConnections: new Set(),
    expandedBackward: new Map(),
    hiddenForwardConnections: new Set(),
    automaticConnections: [],
    treeMessage: '',
    focusRequest: null,
  };
}

export function automaticForwardSources(state: ExplorationState): Set<string> {
  return new Set(state.automaticConnections.flatMap(connection => connection.steps
    .filter(step => step.direction === 'forward' && !state.hiddenForwardConnections.has(forwardConnectionId(step.source, step.target, step.relation)))
    .map(step => step.source)));
}

export function effectiveBackwardSelections(state: ExplorationState): Map<string, Set<string>> {
  const selected = new Map([...state.expandedBackward].map(([id, ids]) => [id, new Set(ids)]));
  for (const connection of state.automaticConnections) {
    for (const step of connection.steps) {
      if (step.direction !== 'backward' || state.hiddenForwardConnections.has(forwardConnectionId(step.source, step.target, step.relation))) continue;
      const ids = selected.get(step.target) ?? new Set<string>();
      ids.add(step.source);
      selected.set(step.target, ids);
    }
  }
  return selected;
}

/** Reuse only relationships already active in the displayed graph. */
function visibleConnection(roots: readonly string[], target: string, graph: CourseGraph): CourseConnection | null {
  const adjacent = new Map<string, { next: string; step: CourseConnection['steps'][number] }[]>();
  for (const edge of graph.edges) for (const direction of edge.directions) {
    const start = direction === 'forward' ? edge.source : edge.target;
    const next = direction === 'forward' ? edge.target : edge.source;
    const rows = adjacent.get(start) ?? [];
    rows.push({ next, step: { source: edge.source, target: edge.target, relation: edge.relation, direction } });
    adjacent.set(start, rows);
  }
  const seen = new Map<string, { root: string; previous?: string; step?: CourseConnection['steps'][number] }>();
  const queue = [...new Set(roots)].filter(id => id !== target);
  for (const root of queue) seen.set(root, { root });
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const row of adjacent.get(id) ?? []) {
      if (seen.has(row.next)) continue;
      seen.set(row.next, { root: seen.get(id)!.root, previous: id, step: row.step }); queue.push(row.next);
      if (row.next === target) {
        const steps: CourseConnection['steps'] = [];
        for (let current = target; seen.get(current)?.step; current = seen.get(current)!.previous!) steps.push(seen.get(current)!.step!);
        return { fromRootId: seen.get(target)!.root, toRootId: target, steps: steps.reverse() };
      }
    }
  }
  return null;
}

function focus(state: ExplorationState, courseId: string): ExplorationState['focusRequest'] {
  return { courseId, sequence: (state.focusRequest?.sequence ?? 0) + 1 };
}

function addConnection(connections: CourseConnection[], connection: CourseConnection): CourseConnection[] {
  return [...connections.filter(item => item.toRootId !== connection.toRootId), connection];
}

export function explorationReducer(state: ExplorationState, action: ExplorationAction): ExplorationState {
  switch (action.type) {
    case 'restore':
      return {
        ...state,
        addedCourseIds: action.saved.addedCourseIds,
        expandedForward: new Set(action.saved.expandedForward),
        autoExpandedCourseIds: new Set(action.saved.autoExpandedCourseIds),
        revealedForwardConnections: new Set(action.saved.revealedForwardConnections),
        expandedBackward: new Map(action.saved.expandedBackward.map(([id, ids]) => [id, new Set(ids)])),
        hiddenForwardConnections: new Set(action.saved.hiddenForwardConnections),
        automaticConnections: action.saved.automaticConnections,
        treeMessage: '',
        focusRequest: null,
      };
    case 'clearAdded':
      return { ...state, addedCourseIds: [],
        expandedForward: new Set([...state.expandedForward].filter(id => !state.autoExpandedCourseIds.has(id))),
        autoExpandedCourseIds: new Set(), automaticConnections: [], treeMessage: '', focusRequest: null };
    case 'toggleAdded':
    case 'addCourse':
    case 'removeCourse': {
      const id = action.courseId;
      const exists = state.addedCourseIds.includes(id);
      if (action.type === 'removeCourse' || (action.type === 'toggleAdded' && exists)) {
        const addedCourseIds = state.addedCourseIds.filter(course => course !== id);
        const expandedForward = new Set(state.expandedForward), autoExpandedCourseIds = new Set(state.autoExpandedCourseIds);
        if (autoExpandedCourseIds.has(id)) expandedForward.delete(id);
        autoExpandedCourseIds.delete(id);
        return { ...state, addedCourseIds, expandedForward, autoExpandedCourseIds,
          automaticConnections: requiredAutomaticConnections(graphRoots(addedCourseIds), state.automaticConnections),
          treeMessage: '', focusRequest: null };
      }
      if (exists) return { ...state, focusRequest: focus(state, id), treeMessage: '' };
      const plan = findCourseConnection(graphRoots(state.addedCourseIds), id, action.context.courses, action.context.dependents, {
        visibleCourseIds: action.context.visibleCourseIds,
        hiddenForwardConnections: state.hiddenForwardConnections,
        isForwardVisible: action.context.isVisible,
      });
      let connection = plan.connection;
      if (plan.reason === 'visible') {
        const anchors = graphRoots(state.addedCourseIds);
        const current = buildGraph(anchors, action.context.courses, action.context.dependents, state.expandedForward,
          state.expandedBackward, action.context.isVisible, state.hiddenForwardConnections, state.automaticConnections,
          state.revealedForwardConnections, new Set(state.addedCourseIds), state.autoExpandedCourseIds);
        connection = visibleConnection(anchors, id, current);
        if (!connection) {
          const required = requiredAutomaticConnections(anchors, state.automaticConnections);
          const targets = new Set(required.map(item => item.toRootId));
          connection = visibleConnection(required.map(item => item.fromRootId).filter(root => !targets.has(root)), id, current);
        }
      }
      const expandedForward = new Set(state.expandedForward);
      const autoExpandedCourseIds = new Set(state.autoExpandedCourseIds);
      if (plan.reason === 'unrelated' || !state.addedCourseIds.length) { expandedForward.add(id); autoExpandedCourseIds.add(id); }
      return {
        ...state,
        addedCourseIds: [...state.addedCourseIds, id],
        expandedForward, autoExpandedCourseIds,
        automaticConnections: (plan.autoReveal || plan.reason === 'visible') && connection ? addConnection(state.automaticConnections, connection) : state.automaticConnections,
        treeMessage: plan.reason === 'hidden' ? 'הקורס נוסף לעץ. החיבור שהוסתר נשמר סגור.' : plan.reason === 'filtered' ? 'הקורס נוסף לעץ. החיבור מוסתר במסננים הנוכחיים.' : plan.reason === 'long' ? 'הקורס נוסף לעץ. אפשר להציג את החיבור לפי הצורך.' : '',
        focusRequest: focus(state, id),
      };
    }
    case 'locateAdded':
    case 'revealConnection': {
      if (!state.addedCourseIds.includes(action.courseId)) return state;
      const anchors = graphRoots(state.addedCourseIds);
      if (action.type === 'locateAdded') {
        const owned = requiredAutomaticConnections([action.courseId], state.automaticConnections);
        if (owned.length) {
          const permitted = owned.every(connection => connection.steps.every(step =>
            [step.source, step.target].every(id => anchors.includes(id) || action.context.isVisible(id))));
          const hidden = new Set(state.hiddenForwardConnections);
          if (permitted) for (const connection of owned) for (const step of connection.steps) hidden.delete(forwardConnectionId(step.source, step.target, step.relation));
          return { ...state, hiddenForwardConnections: hidden, focusRequest: focus(state, action.courseId), treeMessage: permitted ? '' : 'החיבור מוסתר במסננים הנוכחיים.' };
        }
      }
      // A downstream addition must not replace its ancestor's connector with a circular ownership chain.
      const downstream = new Set([action.courseId]);
      for (let changed = true; changed;) {
        changed = false;
        for (const connection of state.automaticConnections) if (downstream.has(connection.fromRootId) && !downstream.has(connection.toRootId)) {
          downstream.add(connection.toRootId); changed = true;
        }
      }
      const roots = anchors.filter(id => !downstream.has(id));
      const plan = findCourseConnection(roots, action.courseId, action.context.courses, action.context.dependents, {
        visibleCourseIds: new Set([...action.context.visibleCourseIds].filter(id => id !== action.courseId)),
        hiddenForwardConnections: state.hiddenForwardConnections,
        isForwardVisible: action.context.isVisible,
        maxAutomaticNewNodes: Number.MAX_SAFE_INTEGER,
        maxAutomaticSteps: Number.MAX_SAFE_INTEGER,
      });
      if (!plan.connection) {
        const owned = requiredAutomaticConnections([action.courseId], state.automaticConnections);
        const hidden = new Set(state.hiddenForwardConnections);
        const permitted = owned.every(connection => connection.steps.every(step =>
          [step.source, step.target].every(id => roots.includes(id) || id === action.courseId || action.context.isVisible(id))));
        if (permitted) for (const connection of owned) for (const step of connection.steps) hidden.delete(forwardConnectionId(step.source, step.target, step.relation));
        return { ...state, hiddenForwardConnections: hidden, focusRequest: focus(state, action.courseId), treeMessage: permitted ? '' : 'החיבור מוסתר במסננים הנוכחיים.' };
      }
      if (plan.reason === 'filtered') return { ...state, treeMessage: 'החיבור מוסתר במסננים הנוכחיים.', focusRequest: focus(state, action.courseId) };
      const hidden = new Set(state.hiddenForwardConnections);
      for (const id of plan.blockedConnectionIds) hidden.delete(id);
      return {
        ...state,
        hiddenForwardConnections: hidden,
        automaticConnections: addConnection(state.automaticConnections, plan.connection),
        treeMessage: '',
        focusRequest: focus(state, action.courseId),
      };
    }
    case 'toggleForward': {
      const expanded = new Set(state.expandedForward);
      const autoExpandedCourseIds = new Set(state.autoExpandedCourseIds); autoExpandedCourseIds.delete(action.courseId);
      const automatic = automaticForwardSources(state);
      const revealed = new Set(state.revealedForwardConnections);
      if (action.active ?? (expanded.has(action.courseId) || automatic.has(action.courseId) || [...revealed].some(id => parseConnectionId(id)?.source === action.courseId))) {
        expanded.delete(action.courseId);
        const hidden = new Set(state.hiddenForwardConnections);
        for (const id of revealed) {
          if (parseConnectionId(id)?.source !== action.courseId) continue;
          revealed.delete(id); hidden.add(id);
        }
        for (const child of action.children) hidden.add(forwardConnectionId(action.courseId, child.courseId, child.relation));
        for (const connection of state.automaticConnections) {
          for (const step of connection.steps) {
            if (step.direction === 'forward' && step.source === action.courseId) hidden.add(forwardConnectionId(step.source, step.target, step.relation));
          }
        }
        return { ...state, expandedForward: expanded, autoExpandedCourseIds, revealedForwardConnections: revealed, hiddenForwardConnections: hidden };
      }
      expanded.add(action.courseId);
      return { ...state, expandedForward: expanded, autoExpandedCourseIds, hiddenForwardConnections: restoreDirectConnections(state.hiddenForwardConnections, action.courseId) };
    }
    case 'toggleBackward': {
      const selected = new Map(state.expandedBackward);
      const ids = new Set(selected.get(action.parentId));
      const effective = action.active ?? effectiveBackwardSelections(state).get(action.parentId)?.has(action.courseId);
      const hidden = new Set(state.hiddenForwardConnections);
      if (effective) {
        ids.delete(action.courseId);
        for (const connection of state.automaticConnections) {
          for (const step of connection.steps) {
            if (step.direction === 'backward' && step.target === action.parentId && step.source === action.courseId) hidden.add(forwardConnectionId(step.source, step.target, step.relation));
          }
        }
      } else ids.add(action.courseId);
      if (ids.size) selected.set(action.parentId, ids);
      else selected.delete(action.parentId);
      return { ...state, expandedBackward: selected, hiddenForwardConnections: hidden };
    }
    case 'collapseBackward': {
      const selected = new Map([...state.expandedBackward].map(([id, ids]) => [id, new Set([...ids].filter(id => id !== action.courseId))]));
      const hidden = new Set(state.hiddenForwardConnections);
      for (const connection of state.automaticConnections) {
        for (const step of connection.steps) {
          if (step.direction === 'backward' && step.source === action.courseId) hidden.add(forwardConnectionId(step.source, step.target, step.relation));
        }
      }
      return { ...state, expandedBackward: selected, hiddenForwardConnections: hidden };
    }
    case 'hideConnection':
      return { ...state, hiddenForwardConnections: new Set([...state.hiddenForwardConnections, action.connectionId]) };
    case 'restoreConnection':
    case 'revealConnections': {
      const hidden = new Set(state.hiddenForwardConnections);
      const revealed = new Set(state.revealedForwardConnections);
      const ids = action.type === 'restoreConnection' ? [action.connectionId] : action.connectionIds;
      for (const id of ids) {
        if (!parseConnectionId(id)) continue;
        hidden.delete(id);
        revealed.add(id);
      }
      // A manual connection is independent of full-course expansion and automatic-path ownership.
      return { ...state, revealedForwardConnections: revealed, hiddenForwardConnections: hidden };
    }
    case 'expandVisible':
      return { ...state, expandedForward: new Set([...state.expandedForward, ...action.courseIds]), autoExpandedCourseIds: new Set([...state.autoExpandedCourseIds].filter(id => !action.courseIds.includes(id))) };
    case 'resetBranches':
      return { ...state, expandedForward: new Set(graphRoots(state.addedCourseIds)), autoExpandedCourseIds: new Set(), revealedForwardConnections: new Set(), expandedBackward: new Map(), hiddenForwardConnections: new Set(), automaticConnections: [], treeMessage: '', focusRequest: null };
    case 'clearMessage':
      return { ...state, treeMessage: '' };
  }
}
