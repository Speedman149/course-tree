#!/usr/bin/env node
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { mergeSnapshots, requirementLeaves } from './course-data.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const cacheDir = resolve(option('--cache-dir', resolve(root, '.cache/course-data')));
const output = resolve(option('--output', resolve(root, 'public/data/courses.json')));
const offline = args.includes('--offline');
const refresh = args.includes('--refresh');
const defaultTerms = ['2023_201', '2024_200', '2024_201', '2024_202', '2025_200', '2025_201', '2025_202', '2026_200'];
const base = 'https://raw.githubusercontent.com/michael-maltsev/technion-sap-info-fetcher/gh-pages';
let terms = option('--terms', '')?.split(',').filter(Boolean) || [];

if (!terms.length && offline) {
  try {
    const manifest = JSON.parse(await readFile(resolve(cacheDir, 'manifest.json'), 'utf8'));
    terms = manifest.terms;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
if (!terms.length && args.includes('--discover')) {
  if (offline) throw new Error('--discover requires network access; omit it for an offline rebuild');
  const response = await fetch('https://api.github.com/repos/michael-maltsev/technion-sap-info-fetcher/git/trees/gh-pages?recursive=1', { headers: { 'User-Agent': 'course-tree-data-pipeline' }, signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`Source discovery failed: HTTP ${response.status}`);
  const tree = await response.json();
  terms = tree.tree.map(entry => /^courses_(\d{4}_\d{3})\.json$/.exec(entry.path)?.[1]).filter(Boolean);
}
if (!terms.length) terms = defaultTerms;
if (!terms.every(term => /^\d{4}_20[012]$/.test(term))) throw new Error('Terms must be comma-separated YYYY_200, YYYY_201, or YYYY_202');
terms = [...new Set(terms)].sort();
await mkdir(cacheDir, { recursive: true });

const snapshots = [];
for (const term of terms) {
  const file = resolve(cacheDir, `courses_${term}.json`);
  const url = `${base}/courses_${term}.json`;
  let bytes;
  if (!refresh || offline) {
    try { bytes = await readFile(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!bytes) {
    if (offline) throw new Error(`No cached snapshot for ${term}`);
    const response = await fetch(url, { signal: AbortSignal.timeout(45_000) });
    if (!response.ok) throw new Error(`Download ${term} failed: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    JSON.parse(bytes.toString('utf8')); // Validate before replacing a usable cache.
    await writeFile(`${file}.tmp`, bytes);
    await rename(`${file}.tmp`, file);
  }
  const records = JSON.parse(bytes.toString('utf8'));
  if (!Array.isArray(records) || records.length === 0) throw new Error(`Empty/invalid snapshot ${term}`);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  snapshots.push({ term, url, sha256, records });
  console.log(`${term}: ${records.length} source records`);
}

const courses = mergeSnapshots(snapshots);
const ids = new Set(courses.map(course => course.id));
const leaves = courses.flatMap(course => requirementLeaves(course.requirements));
const missing = [...new Set(leaves.filter(leaf => !ids.has(leaf.courseId)).map(leaf => leaf.courseId))].sort();
const statuses = Object.fromEntries(['known', 'none', 'unknown', 'unparsed'].map(status => [status, courses.filter(course => course.requirementsStatus === status).length]));
const faculties = [...new Set(courses.map(course => course.faculty))].sort();
const meta = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  defaultRootId: '02340114',
  courseCount: courses.length,
  facultyCount: faculties.length,
  faculties,
  termCount: terms.length,
  earliestTerm: terms[0],
  latestTerm: terms.at(-1),
  sourcePolicy: 'latest-record-per-course; never union prerequisite rules across terms',
  sourcePolicyHe: 'לכל קורס מוצגות הדרישות מהסמסטר האחרון שבו נמצא. דרישות מסמסטרים שונים אינן מאוחדות.',
  requirementStatuses: statuses,
  relationshipCount: leaves.length,
  concurrentRelationshipCount: leaves.filter(leaf => leaf.relation === 'concurrent').length,
  coursesWithChangedRequirements: courses.filter(course => course.requirementsChanged).length,
  missingReferencedCourseCount: missing.length,
  missingReferencedCourseIds: missing,
  ambiguousPolicy: 'Unbalanced, malformed, implicit, or mixed ungrouped operators and ambiguous concurrent lists are retained as raw text and omitted from the graph.',
  sources: snapshots.map(({ term, url, sha256, records }) => ({ term, url, sha256, recordCount: records.length })),
};
await mkdir(dirname(output), { recursive: true });
await writeFile(`${output}.tmp`, JSON.stringify({ meta, courses }));
await rename(`${output}.tmp`, output);
await writeFile(resolve(cacheDir, 'manifest.json'), JSON.stringify({ terms, sources: meta.sources }, null, 2));
console.log(JSON.stringify({ output, courses: courses.length, academicUnits: faculties.length, statuses, relationships: leaves.length, concurrent: meta.concurrentRelationshipCount, missingReferences: missing.length, changedRequirements: meta.coursesWithChangedRequirements }, null, 2));
