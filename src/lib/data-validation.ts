import type { CatalogDataset, CourseDataset } from '../types';
import { officialSourceURL } from './urls';

export const MAX_DATASET_BYTES = 16 * 1024 * 1024;
const COURSE_ID = /^\d{8}$/;
const YEAR = /^\d{4}-\d{4}$/;
type RecordValue = Record<string, unknown>;

function check(condition: unknown): asserts condition {
  if (!condition) throw new Error('Invalid academic dataset');
}
function record(value: unknown): RecordValue {
  check(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as RecordValue;
}
function array(value: unknown, max = 50_000): unknown[] {
  check(Array.isArray(value) && value.length <= max);
  return value;
}
function text(value: unknown, max = 20_000): value is string {
  return typeof value === 'string' && value.length <= max;
}
function strings(value: unknown, pattern?: RegExp): value is string[] {
  return Array.isArray(value) && value.length <= 50_000 &&
    value.every(item => text(item, 2000) && (!pattern || pattern.test(item)));
}
function numberFields(value: RecordValue, keys: string[]): void {
  for (const key of keys) check(value[key] === undefined || (typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0));
}

/** Bound all nesting and work, including metadata fields unused by the UI. */
function boundedJSON(value: unknown): void {
  const pending = [{ value, depth: 0 }];
  const seen = new WeakSet<object>();
  let count = 0;
  while (pending.length) {
    const item = pending.pop()!;
    check(++count <= 1_000_000 && item.depth <= 48);
    if (typeof item.value === 'string') check(item.value.length <= 100_000);
    if (item.value === null || typeof item.value !== 'object') continue;
    check(!seen.has(item.value));
    seen.add(item.value);
    const values = Array.isArray(item.value) ? item.value : Object.values(item.value);
    check(values.length <= 100_000);
    for (const child of values) pending.push({ value: child, depth: item.depth + 1 });
  }
}

function courseRequirement(value: unknown): void {
  if (value === null) return;
  const node = record(value);
  if (node.type === 'course') {
    check(text(node.courseId) && COURSE_ID.test(node.courseId));
    check(node.relation === 'strong' || node.relation === 'concurrent');
    return;
  }
  check(node.type === 'and' || node.type === 'or');
  for (const child of array(node.items, 2000)) courseRequirement(child);
}

function course(value: unknown): string {
  const row = record(value);
  check(text(row.id) && COURSE_ID.test(row.id));
  check(text(row.name, 2000) && row.name.length > 0 && text(row.faculty, 2000));
  check(row.faculties === undefined || strings(row.faculties));
  check(row.aliases === undefined || strings(row.aliases, /^\d{5,8}$/));
  check(row.availableSourceTerms === undefined || strings(row.availableSourceTerms, /^\d{4}_\d{3}$/));
  check(row.catalogOnly === undefined || typeof row.catalogOnly === 'boolean');
  check(['known', 'none', 'unknown', 'unparsed'].includes(row.requirementsStatus as string));
  check(row.rawRequirements === undefined || text(row.rawRequirements));
  numberFields(row, ['credits']);
  const source = record(row.source);
  check(officialSourceURL(source.url));
  check(source.term === undefined || (text(source.term) && /^\d{4}_\d{3}$/.test(source.term)));
  check(source.label === undefined || text(source.label));
  courseRequirement(row.requirements);
  return row.id;
}

function uniqueCourses(value: unknown): void {
  const seen = new Set<string>();
  for (const row of array(value)) {
    const id = course(row);
    check(!seen.has(id));
    seen.add(id);
  }
}

function references(value: unknown, sources: Set<string>): void {
  for (const item of array(value, 2000)) {
    const ref = record(item);
    check(text(ref.sourceId) && sources.has(ref.sourceId));
    check(Array.isArray(ref.pages) && ref.pages.length <= 2000 && ref.pages.every(page => Number.isInteger(page) && page > 0));
    check(ref.printedPages === undefined || (Array.isArray(ref.printedPages) && ref.printedPages.every(page => Number.isInteger(page))));
    check(ref.section === undefined || text(ref.section));
  }
}

function curriculumRequirement(value: unknown, sources: Set<string>): void {
  const node = record(value);
  check(node.id === undefined || text(node.id));
  check(node.label === undefined || text(node.label));
  if (node.sourceRefs !== undefined) references(node.sourceRefs, sources);
  numberFields(node, ['minimumCourses', 'minimumCredits', 'maximumCredits']);
  switch (node.type) {
    case 'course':
      check(text(node.courseId) && COURSE_ID.test(node.courseId));
      break;
    case 'group':
      check(text(node.groupId));
      break;
    case 'condition':
      check(text(node.text));
      if (node.requirement !== undefined) curriculumRequirement(node.requirement, sources);
      break;
    case 'substitution':
      check(strings(node.originalCourseIds, COURSE_ID) && strings(node.replacementCourseIds, COURSE_ID));
      check(node.description === undefined || text(node.description));
      break;
    default:
      check(node.type === 'all' || node.type === 'any' || node.type === 'choose');
      for (const child of array(node.items, 2000)) curriculumRequirement(child, sources);
  }
}

export function validateCourseDataset(value: unknown): CourseDataset {
  boundedJSON(value);
  const data = record(value);
  const meta = record(data.meta);
  numberFields(meta, ['courseCount', 'facultyCount', 'termCount', 'relationshipCount', 'missingReferencedCourseCount']);
  for (const key of ['earliestTerm', 'latestTerm']) check(meta[key] === undefined || text(meta[key], 64));
  if (meta.requirementStatuses !== undefined) {
    const statuses = record(meta.requirementStatuses);
    check(Object.values(statuses).every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0));
  }
  check(array(data.courses).length > 0);
  uniqueCourses(data.courses);
  return value as CourseDataset;
}

export function validateCatalogDataset(value: unknown): CatalogDataset {
  boundedJSON(value);
  const data = record(value);
  const meta = record(data.meta);
  check(strings(meta.years, YEAR));
  check(meta.notes === undefined || strings(meta.notes));
  check(meta.defaultYear === undefined || (text(meta.defaultYear) && YEAR.test(meta.defaultYear)));
  if (meta.coverageStats !== undefined) {
    const stats = record(meta.coverageStats);
    check(Object.values(stats).every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0));
  }
  const sources = new Set<string>();
  for (const item of array(data.sources, 2000)) {
    const source = record(item);
    check(text(source.id) && !sources.has(source.id) && officialSourceURL(source.url));
    check(text(source.catalogYear) && YEAR.test(source.catalogYear));
    sources.add(source.id);
  }
  const editions = new Set<string>();
  for (const item of array(data.programs, 5000)) {
    const row = record(item);
    check(text(row.id) && !editions.has(row.id));
    editions.add(row.id);
    check(text(row.programId) && text(row.officialName) && text(row.degreeType));
    check(strings(row.facultyIds) && text(row.catalogYear) && YEAR.test(row.catalogYear));
    check(row.track === undefined || text(row.track));
    check(row.parentProgramId === undefined || text(row.parentProgramId));
    check(row.qualificationAwarded === undefined || strings(row.qualificationAwarded));
    check(row.programCategory === undefined || ['standard', 'combined', 'dual-major', 'double-degree', 'concentration', 'additional-degree', 'teaching-qualification'].includes(row.programCategory as string));
    numberFields(row, ['durationYears']);
    check(strings(row.mandatoryCourseIds, COURSE_ID) && strings(row.additionalEligibleCourseIds, COURSE_ID));
    references(row.sourceRefs, sources);
    const coverage = record(row.coverage);
    check(['verified-listed', 'partial', 'inventory-only'].includes(coverage.status as string) && strings(coverage.notes));
    for (const key of ['mandatoryComplete', 'electivesComplete', 'visuallyVerified']) check(coverage[key] === undefined || typeof coverage[key] === 'boolean');
    const groups = new Set<string>();
    for (const item of array(row.electiveGroups, 2000)) {
      const group = record(item);
      check(text(group.id) && !groups.has(group.id) && text(group.name));
      groups.add(group.id);
      check(['mandatory', 'mandatory-choice', 'elective', 'specialization', 'additional'].includes(group.role as string));
      check(strings(group.courseIds, COURSE_ID) && strings(group.conditions));
      check(group.requiredCourseIds === undefined || strings(group.requiredCourseIds, COURSE_ID));
      check(group.offeringFacultyId === undefined || text(group.offeringFacultyId));
      numberFields(group, ['creditsMin', 'minimumCourses', 'maximumCredits']);
      references(group.sourceRefs, sources);
      for (const item of array(group.rules, 2000)) {
        const rule = record(item);
        check(text(rule.id) && text(rule.description) && typeof rule.automatic === 'boolean');
        check(['faculty', 'all-courses', 'approval', 'course-prefix'].includes(rule.kind as string));
        check(rule.coursePrefixes === undefined || strings(rule.coursePrefixes, /^\d{1,8}$/));
        check(rule.facultyIds === undefined || strings(rule.facultyIds));
        check(rule.excludeCourseIds === undefined || strings(rule.excludeCourseIds, COURSE_ID));
        check(rule.sourceUrls === undefined || (Array.isArray(rule.sourceUrls) && rule.sourceUrls.every(url => officialSourceURL(url))));
      }
    }
    if (row.requirementRules !== undefined) for (const rule of array(row.requirementRules, 2000)) curriculumRequirement(rule, sources);
  }
  if (data.referencedCourses !== undefined) uniqueCourses(data.referencedCourses);
  return value as CatalogDataset;
}

/** Limit decompressed bytes even if Content-Length is absent or misleading. */
export async function readDatasetJSON(response: Response): Promise<unknown> {
  check(response.ok && response.body);
  const length = response.headers.get('content-length');
  if (length !== null && (!Number.isFinite(Number(length)) || Number(length) > MAX_DATASET_BYTES)) {
    await response.body.cancel();
    throw new Error('Academic dataset is too large');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const chunks: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_DATASET_BYTES) {
        throw new Error('Academic dataset is too large');
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(chunks.join(''));
}
