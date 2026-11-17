import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import type {CatalogDataset, CourseDataset} from '../src/types';
import {createCourseVisibility, getCatalogRoles, getFacultyOptions} from '../src/lib/filters';
import {buildDependents} from '../src/lib/graph';
import {applyExplorationCorrections} from '../data/catalogs/exploration-corrections.mjs';
import {applyCourseCorrections, loadCourseCorrections} from '../scripts/course-corrections.mjs';
import {requirementLeaves, parseRequirement} from '../scripts/course-data.mjs';
const read = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const catalogs = read('public/data/catalogs.json') as CatalogDataset;
const sap = read('public/data/courses.json') as CourseDataset;
const courses = [...sap.courses, ...catalogs.referencedCourses!];
const index = new Map(courses.map(course => [course.id, course]));
const faculties = new Set(getFacultyOptions(courses).map(f => f.id));
const path = (id: string) => catalogs.programs.find(p => p.id === `${id}-2025-2026`)!;
// Expectations are transcribed from the original PDF pages, not the importer regions.
const sourceCases: [string, string[], number][] = [
 ['computer-engineering', ['00440102'],124],
 ['biomedical-physics', ['01160027'],305],
 ['medicine-biomedical-engineering', ['02740369','02740376'],306],
 ['medicine-biomedical-engineering', ['03350002','03360022'],307],
 ['architecture-sciences', ['03240033'],218],
 ['landscape-architecture', ['03240033'],220],
 ['biomedical-engineering', ['03240033'],304],
 ['biomedical-physics', ['03240033'],305],
 ['medicine-biomedical-engineering', ['03240033'],306],
 ...['chemistry-haznek','chemistry-haznek-pharmaceutical-biochemistry','chemistry-haznek-chemical-technologies','chemistry-haznek-molecular-quantum-technologies'].map(id => [id,['01040018','01040019','01340058','01240117'],196] as [string,string[],number]),
 ['chemistry-haznek-pharmaceutical-biochemistry', ['01340113','01270100','01340020','01270741','01270742','01340134'],197],
 ['chemistry-haznek-chemical-technologies', ['00940481','00540135'],197],
 ['chemistry-haznek-molecular-quantum-technologies', ['01270446','01270447','01260604','01260605','01270450','01270451','01280429','01160037','01160040','01180137'],197],
];
test('source-listed repairs actually pass degree filtering and carry the exact catalog page', () => {
 for (const [program, ids, page] of sourceCases) {
  const catalog=path(program);assert.ok(catalog,program);
  const visible=createCourseVisibility(courses,faculties,catalog);
  for (const id of ids) {assert.ok(index.has(id),`${program}/${id}: no displayed record`);assert.ok(visible(id),`${program}/${id}: filtered out`);assert.ok(getCatalogRoles(id,catalog,index).length);}
  assert.ok(catalog.sourceRefs.some(ref=>ref.sourceId==='2025-2026-full'&&ref.pages.includes(page)),`${program}: missing page ${page}`);
 }
 for (const id of ['00440102']) assert.ok(path('computer-engineering').mandatoryCourseIds.includes(id));
 for (const id of ['02740369','02740376']) assert.ok(path('medicine-biomedical-engineering').mandatoryCourseIds.includes(id));
});
test('conditional and advanced options remain choices, and Haznek remains explicitly partial', () => {
 for (const id of ['architecture-sciences','landscape-architecture','biomedical-engineering','biomedical-physics','medicine-biomedical-engineering']) {
  const p=path(id);assert.equal(p.mandatoryCourseIds.includes('03240033'),false);
  const role=getCatalogRoles('03240033',p,index);assert.ok(role.some(r=>r.conditional));
 }
 for (const id of ['chemistry-haznek','chemistry-haznek-pharmaceutical-biochemistry','chemistry-haznek-chemical-technologies','chemistry-haznek-molecular-quantum-technologies']) {
  const p=path(id);assert.equal(p.coverage.status,'partial');assert.equal(p.coverage.mandatoryComplete,false);assert.equal(p.coverage.electivesComplete,false);
  for(const group of p.electiveGroups)for(const course of group.courseIds)assert.equal(p.mandatoryCourseIds.includes(course),false);
 }
});
test('valid alternatives already available before the repair are preserved', () => {
 for (const [id, options] of [
  ['physics-four-year',['01140251','01140229','01140252']],
  ['biology-human-development',['01140051','01140071']],
  ['biology-chemistry',['01140051','01140071','01140052','01140075']],
  ['mapping-3-survey',['00140867','00140875']],
  ['mapping-3-mapping',['00140857','00140876']],
  ['biomedical-physics',['03360533','01160210','03340009','01160027']],
 ] as [string,string[]][]) for(const course of options) assert.ok(createCourseVisibility(courses,faculties,path(id))(course),`${id}/${course}`);
});
test('catalog repair never leaks into other sources or asserts complete curricula', () => {
 const other={programId:'computer-engineering',sourceId:'2026-2027-cs',mandatoryCourseIds:['02340114']};
 assert.deepEqual(applyExplorationCorrections(other),other);
 assert.deepEqual(other.mandatoryCourseIds,['02340114']);
});
test('official 00540417 OR branches restore both missing graph prerequisites', async () => {
 const corrections=await loadCourseCorrections(fileURLToPath(new URL('../',import.meta.url)));
 const correction=corrections.find(c=>c.courseId==='00540417')!;
 const course=index.get('00540417')!;
 assert.deepEqual(course.requirements,correction.requirements);
 assert.deepEqual(parseRequirement(course.rawRequirements!.replace(/^מקצועות קדם: /,'')),course.requirements);
 const leaves=new Set(requirementLeaves(course.requirements).map(r=>r.courseId));
 assert.deepEqual([...leaves].sort(),['00540309','00540316','00540319','00540321','00540322','00540324','00540330','00540482']);
 assert.equal(course.requirements!.type,'or');
 const graph=buildDependents(courses);
 for(const id of ['00540324','00540482']) assert.ok(graph.get(id)?.some(edge=>edge.courseId==='00540417'),`${id} edge missing`);
 assert.equal(requirementLeaves(course.requirements).some(r=>r.relation==='concurrent'),false);
});
test('official override is term scoped, idempotent, and refuses changed upstream/concurrent rules', () => {
 const corrections=read('data/course-corrections.json');const patch=corrections[0];
 const old={id:patch.courseId,source:{term:patch.term},requirements:patch.expectedInputRequirements};
 const result=applyCourseCorrections([old],corrections);assert.deepEqual(result.courses[0].requirements,patch.requirements);
 assert.deepEqual(applyCourseCorrections(result.courses,corrections).courses,result.courses);
 const other={...old,source:{term:'2025_200'}};
 assert.deepEqual(applyCourseCorrections([other],corrections).courses,[other]);
 const changed={...old,requirements:{type:'course',courseId:'00540322',relation:'concurrent'}};
 assert.throws(()=>applyCourseCorrections([changed],corrections),/Reverify official correction/);
});