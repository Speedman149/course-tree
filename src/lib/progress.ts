import type { Course, DegreeCatalog } from '../types';
import { collectRequirements, forwardConnectionId, parseConnectionId, resolveCourseId, type CourseConnection, graphRoots, requiredAutomaticConnections } from './graph';

export const PROGRESS_KEY = 'course-tree.progress';
export const PROGRESS_VERSION = 5;

export interface Progress {
  primaryCourseId: string;
  addedCourseIds: string[];
  expandedForward: string[];
  autoExpandedCourseIds: string[];
  revealedForwardConnections: string[];
  hiddenForwardConnections: string[];
  expandedBackward: [string, string[]][];
  automaticConnections: CourseConnection[];
  facultyIds: string[] | null;
  catalogId: string;
  catalogYear: string;
  catalogFaculty: string;
  filterTab: 'faculty' | 'catalog';
  searchAll: boolean;
  markedCourseIds: string[];
  recent: string[];
  viewport: { x: number; y: number; zoom: number } | null;
}

export interface ProgressDatabase {
  courses: ReadonlyMap<string, Course>;
  facultyIds: ReadonlySet<string>;
  programs: readonly DegreeCatalog[] | null;
  years: readonly string[];
  defaultYear: string;
  defaultRoot: string;
}

export const defaultProgress = (db: ProgressDatabase): Progress => ({
  primaryCourseId: db.defaultRoot,
  addedCourseIds: [],
  expandedForward: [db.defaultRoot],
  autoExpandedCourseIds: [],
  revealedForwardConnections: [],
  hiddenForwardConnections: [],
  expandedBackward: [],
  automaticConnections: [],
  facultyIds: null,
  catalogId: '',
  catalogYear: db.defaultYear,
  catalogFaculty: '',
  filterTab: 'faculty',
  searchAll: false,
  markedCourseIds: [],
  recent: [],
  viewport: null,
});

interface ValidationIndex {
  courses: Map<string, Course>;
  knownIds: Set<string>;
  relationships: Set<string>;
  prerequisites: Map<string, Set<string>>;
}
const indexes = new WeakMap<ReadonlyMap<string, Course>, ValidationIndex>();

function validationIndex(courses: ReadonlyMap<string, Course>): ValidationIndex {
  const existing = indexes.get(courses);
  if (existing) return existing;
  const index: ValidationIndex = {
    courses: new Map(courses),
    knownIds: new Set(courses.keys()),
    relationships: new Set(),
    prerequisites: new Map(),
  };
  for (const course of courses.values()) {
    const prerequisites = new Set<string>();
    for (const requirement of collectRequirements(course.requirements)) {
      index.knownIds.add(requirement.courseId);
      prerequisites.add(requirement.courseId);
      index.relationships.add(forwardConnectionId(requirement.courseId, course.id, requirement.relation));
    }
    index.prerequisites.set(course.id, prerequisites);
  }
  indexes.set(courses, index);
  return index;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

/** Legitimate stored sets fit their database universe. A larger scan budget tolerates stale entries. */
function strings(value: unknown, limit = 6000): string[] {
  if (!Array.isArray(value)) return [];
  const result = new Set<string>();
  for (const id of value.slice(0, limit)) {
    if (typeof id === 'string' && id.length <= 5000) result.add(id);
  }
  return [...result];
}

function viewport(value: unknown): Progress['viewport'] {
  const view = record(value);
  if (![view.x, view.y, view.zoom].every(number => typeof number === 'number' && Number.isFinite(number))) return null;
  const { x, y, zoom } = view as { x: number; y: number; zoom: number };
  return Math.abs(x) < 1e7 && Math.abs(y) < 1e7 && zoom >= .15 && zoom <= 1.8 ? { x, y, zoom } : null;
}

interface LegacyInstance {
  courseId: string;
  parentCourseId?: string;
  connectionId?: string;
  direction?: 'forward' | 'backward';
}

function legacyResolver(rootId: string, index: ValidationIndex) {
  const cache = new Map<string, LegacyInstance | null>();
  return (path: string): LegacyInstance | null => {
    if (cache.has(path)) return cache.get(path)!;
    if (path.length > 5000 || !/^root(?:\/[fb]:\d{8}:(?:strong|concurrent))*$/.test(path)) return null;
    const parts = path.split('/');
    if (parts.length > 60) return null;
    let result: LegacyInstance = { courseId: rootId };
    for (const part of parts.slice(1)) {
      const [direction, courseId, relation] = part.split(':');
      const connection = direction === 'f'
        ? forwardConnectionId(result.courseId, courseId, relation as 'strong' | 'concurrent')
        : forwardConnectionId(courseId, result.courseId, relation as 'strong' | 'concurrent');
      if (!index.relationships.has(connection)) {
        cache.set(path, null);
        return null;
      }
      result = { courseId, parentCourseId: result.courseId, connectionId: connection, direction: direction === 'f' ? 'forward' : 'backward' };
    }
    cache.set(path, result);
    return result;
  };
}

function backwardSelections(
  value: unknown,
  index: ValidationIndex,
  resolveParent: (id: string) => string | null,
  rowLimit: number,
): Progress['expandedBackward'] {
  if (!Array.isArray(value)) return [];
  const selections = new Map<string, Set<string>>();
  let checkedIds = 0;
  const idBudget = Math.max(6000, index.relationships.size * 4);
  for (const pair of value.slice(0, rowLimit)) {
    if (!Array.isArray(pair) || typeof pair[0] !== 'string') continue;
    const parent = resolveParent(pair[0]);
    if (!parent) continue;
    const allowed = index.prerequisites.get(parent);
    if (!allowed?.size) continue;
    const selected = selections.get(parent) ?? new Set<string>();
    for (const id of strings(pair[1], Math.max(32, allowed.size * 4))) {
      if (++checkedIds > idBudget) break;
      if (allowed.has(id)) selected.add(id);
    }
    if (selected.size) selections.set(parent, selected);
    if (checkedIds > idBudget) break;
  }
  return [...selections].map(([id, ids]) => [id, [...ids]]);
}

function automaticConnections(value: unknown, pins: readonly string[], index: ValidationIndex): CourseConnection[] {
  if (!Array.isArray(value)) return [];
  const roots = new Set(pins);
  const result: CourseConnection[] = [];
  const seenPairs = new Set<string>();
  // One connector per added target is normal; the source universe bounds stale-record scanning.
  for (const candidate of value.slice(0, Math.max(index.knownIds.size, index.relationships.size))) {
    const connection = record(candidate);
    const from = connection.fromRootId;
    const to = connection.toRootId;
    if (typeof from !== 'string' || typeof to !== 'string' || from === to || !index.knownIds.has(from) || !index.knownIds.has(to)) continue;
    const key = JSON.stringify([from, to]);
    if (seenPairs.has(key) || !Array.isArray(connection.steps) || !connection.steps.length || connection.steps.length >= index.knownIds.size) continue;
    const steps: CourseConnection['steps'] = [];
    const visited = new Set([from]);
    let current = from;
    for (const candidate of connection.steps) {
      const step = record(candidate);
      if (typeof step.source !== 'string' || typeof step.target !== 'string' ||
        (step.relation !== 'strong' && step.relation !== 'concurrent') ||
        (step.direction !== 'forward' && step.direction !== 'backward')) break;
      const id = forwardConnectionId(step.source, step.target, step.relation);
      const previous = step.direction === 'forward' ? step.source : step.target;
      const next = step.direction === 'forward' ? step.target : step.source;
      if (previous !== current || visited.has(next) || !index.relationships.has(id)) break;
      visited.add(next);
      current = next;
      steps.push({ source: step.source, target: step.target, relation: step.relation, direction: step.direction });
    }
    if (current !== to || steps.length !== connection.steps.length) continue;
    seenPairs.add(key);
    result.push({ fromRootId: from, toRootId: to, steps });
  }
  return requiredAutomaticConnections([...roots], result);
}

export function validateProgress(value: unknown, db: ProgressDatabase, urlCourse?: string | null): Progress {
  const defaults = defaultProgress(db);
  const raw = record(value);
  const index = validationIndex(db.courses);
  const idScanLimit = Math.max(6000, index.knownIds.size * 4);
  const canonical = Object.hasOwn(raw, 'addedCourseIds') || Object.hasOwn(raw, 'pinnedRootIds');
  const legacyRoot = typeof raw.rootId === 'string' && index.knownIds.has(raw.rootId) ? raw.rootId : null;
  const collection = Object.hasOwn(raw, 'addedCourseIds') ? raw.addedCourseIds : raw.pinnedRootIds;
  let addedCourseIds = canonical && Array.isArray(collection)
    ? strings(collection, idScanLimit).filter(id => index.knownIds.has(id))
    : legacyRoot ? [legacyRoot] : defaults.addedCourseIds;
  let primaryCourseId = canonical && Array.isArray(collection)
    ? typeof raw.primaryCourseId === 'string'
      ? index.knownIds.has(raw.primaryCourseId) ? raw.primaryCourseId : raw.primaryCourseId === '' ? '' : addedCourseIds[0] ?? ''
      : addedCourseIds[0] ?? ''
    : legacyRoot ?? defaults.primaryCourseId;
  let keepBranches = canonical ? Array.isArray(collection) : legacyRoot !== null;

  const requested = typeof urlCourse === 'string' && urlCourse.length <= 64
    ? index.knownIds.has(urlCourse.trim()) ? urlCourse.trim() : resolveCourseId(urlCourse, index.courses)
    : null;
  if (requested && (requested !== primaryCourseId || Object.keys(raw).length === 0)) {
    primaryCourseId = requested;
    addedCourseIds = [requested];
    keepBranches = false;
  }

  let expandedForward = defaults.expandedForward;
  let hiddenForwardConnections: string[] = [];
  let revealedForwardConnections: string[] = [];
  let expandedBackward: Progress['expandedBackward'] = [];
  let connections: CourseConnection[] = [];
  if (keepBranches && canonical) {
    expandedForward = strings(raw.expandedForward, idScanLimit).filter(id => index.knownIds.has(id));
    hiddenForwardConnections = strings(raw.hiddenForwardConnections, Math.max(6000, index.relationships.size * 4))
      .filter(id => parseConnectionId(id) !== null && index.relationships.has(id));
    revealedForwardConnections = strings(raw.revealedForwardConnections, Math.max(6000, index.relationships.size * 4))
      .filter(id => parseConnectionId(id) !== null && index.relationships.has(id));
    expandedBackward = backwardSelections(raw.expandedBackward, index, id => index.knownIds.has(id) ? id : null, idScanLimit);
    connections = automaticConnections(raw.automaticConnections, graphRoots(primaryCourseId, addedCourseIds), index);
  } else if (keepBranches && legacyRoot) {
    const resolveInstance = legacyResolver(legacyRoot, index);
    expandedForward = [...new Set(strings(raw.expandedForward, 1500).flatMap(path => {
      const instance = resolveInstance(path);
      return instance ? [instance.courseId] : [];
    }))];
    hiddenForwardConnections = [...new Set(strings(raw.hiddenForwardConnections, 1500).flatMap(path => {
      const instance = resolveInstance(path);
      return instance?.direction === 'forward' && instance.connectionId ? [instance.connectionId] : [];
    }))];
    expandedBackward = backwardSelections(raw.expandedBackward, index, path => resolveInstance(path)?.courseId ?? null, 1500);
  } else {
    expandedForward = graphRoots(primaryCourseId, addedCourseIds);
  }

  const program = typeof raw.catalogId === 'string' ? db.programs?.find(program => program.id === raw.catalogId) : null;
  const catalogId = db.programs ? program?.id ?? '' : typeof raw.catalogId === 'string' ? raw.catalogId.slice(0, 200) : '';
  const validYear = typeof raw.catalogYear === 'string' &&
    (raw.catalogYear === '' || db.years.includes(raw.catalogYear) || (db.programs === null && /^\d{4}-\d{4}$/.test(raw.catalogYear)));
  const validCatalogFaculty = typeof raw.catalogFaculty === 'string' && raw.catalogFaculty.length <= 2000 &&
    (db.programs === null || db.facultyIds.has(raw.catalogFaculty) || db.programs.some(program => program.facultyIds.includes(raw.catalogFaculty as string)));

  return {
    primaryCourseId,
    addedCourseIds,
    expandedForward,
    autoExpandedCourseIds: keepBranches && canonical ? strings(raw.autoExpandedCourseIds, idScanLimit).filter(id => addedCourseIds.includes(id) && expandedForward.includes(id)) : [],
    revealedForwardConnections,
    hiddenForwardConnections,
    expandedBackward,
    automaticConnections: connections,
    facultyIds: raw.facultyIds === null || !Array.isArray(raw.facultyIds) ? null : strings(raw.facultyIds).filter(id => db.facultyIds.has(id)),
    catalogId,
    catalogYear: validYear ? raw.catalogYear as string : program?.catalogYear ?? defaults.catalogYear,
    catalogFaculty: validCatalogFaculty ? raw.catalogFaculty as string : '',
    filterTab: raw.filterTab === 'catalog' ? 'catalog' : 'faculty',
    searchAll: raw.searchAll === true,
    markedCourseIds: strings(raw.markedCourseIds, idScanLimit).filter(id => index.knownIds.has(id)),
    recent: strings(raw.recent, 100).filter(id => index.knownIds.has(id)).slice(0, 4),
    viewport: keepBranches ? viewport(raw.viewport) : null,
  };
}

export function decodeProgress(raw: string | null): unknown {
  if (!raw || raw.length > 2_000_000) return null;
  try {
    const saved = record(JSON.parse(raw));
    if (!saved.progress || typeof saved.progress !== 'object' || Array.isArray(saved.progress)) return null;
    if (saved.version === 1) return { ...record(saved.progress), hiddenForwardConnections: [] };
    return saved.version === 2 || saved.version === 3 || saved.version === 4 || saved.version === PROGRESS_VERSION ? saved.progress : null;
  } catch {
    return null;
  }
}

export function encodeProgress(progress: Progress): string {
  return JSON.stringify({ version: PROGRESS_VERSION, savedAt: new Date().toISOString(), progress });
}
