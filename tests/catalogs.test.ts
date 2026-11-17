import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { CatalogDataset, CourseDataset } from '../src/types';
import { createCourseVisibility, getCatalogRoles, getFacultyOptions } from '../src/lib/filters';
import { extractIds } from '../scripts/catalogs/build.mjs';
const database=JSON.parse(readFileSync(new URL('../public/data/catalogs.json',import.meta.url),'utf8')) as CatalogDataset;
const sourceCourses=JSON.parse(readFileSync(new URL('../public/data/courses.json',import.meta.url),'utf8')) as CourseDataset;
const courses=[...sourceCourses.courses,...database.referencedCourses!];const index=new Map(courses.map(c=>[c.id,c]));
const all=new Set(getFacultyOptions(courses).map(f=>f.id));
const program=(id:string)=>database.programs.find(p=>p.id===id)!;
test('all declared mandatory and elective options remain selectable, including records absent from SAP',()=>{
 assert.equal(new Set(database.programs.map(p=>p.id)).size,database.programs.length);
 for(const catalog of database.programs){
  const visible=createCourseVisibility(courses,all,catalog);
  for(const id of [...catalog.mandatoryCourseIds,...catalog.electiveGroups.flatMap(g=>g.courseIds)]){
   assert.equal(visible(id),true,`${catalog.id}: ${id} was lost`);
   assert.match(id,/^\d{8}$/);
  }
 }
 for(const course of database.referencedCourses!){assert.equal(course.requirementsStatus,'unknown');assert.equal(course.requirements,null);assert.equal(course.catalogOnly,true);}
});
test('reviewed biology List A includes all seven official options rather than a four-course sample',()=>{
 const biology=program('biology-general-2026-2027');const list=biology.electiveGroups.find(g=>g.name==='רשימה א׳')!;
 assert.deepEqual([...list.courseIds].sort(),['01340069','01340153','01340039','01340164','01340155','01340157','02760413'].sort());
 assert.ok(list.sourceRefs.some(ref=>ref.sourceId==='2026-2027-13'&&ref.pages.includes(3)));
 const listB=biology.electiveGroups.find(g=>g.name.startsWith('רשימה ב'))!;assert.equal(listB.courseIds.length,28);assert.ok(listB.courseIds.includes('00640615'));assert.ok(listB.courseIds.includes('01360038'));
});
test('reviewed CS List B preserves all 68 options, including first/last rows and cross-faculty courses',()=>{
 const cs=program('cs-three-year-2026-2027');const list=cs.electiveGroups.find(g=>g.name.startsWith('רשימה ב'))!;
 assert.equal(list.courseIds.length,68);
 for(const id of ['00360044','00440105','01040122','01150203','01340142','02140909'])assert.ok(list.courseIds.includes(id));
 assert.equal(createCourseVisibility(courses,all,cs)('01040031'),true);
 assert.equal(createCourseVisibility(courses,all,cs)('01240225'),false);
});
test('catalog years preserve actual changed requirements and never import an unresolved list from another edition',()=>{
 const old=program('cs-three-year-2025-2026'),current=program('cs-three-year-2026-2027');
 assert.equal(getCatalogRoles('01040033',old,index).length>0,true);
 assert.equal(getCatalogRoles('01040033',current,index).length,0);
 assert.equal(old.mandatoryCourseIds.includes('02360766'),false);assert.equal(current.mandatoryCourseIds.includes('02360766'),true);
 assert.ok(current.electiveGroups.some(g=>g.rules.some(r=>r.id==='unresolved-math-list'&&!r.automatic)));
});
test('physics retains the seven choices in list 2 and the coordinated lab alternatives',()=>{
 const physics=program('physics-three-year-2026-2027');
 assert.equal(physics.electiveGroups.find(g=>g.name.startsWith('רשימת בחירה 2'))!.courseIds.length,7);
 assert.deepEqual(physics.electiveGroups.find(g=>g.name.startsWith('תכניות המעבדה'))!.courseIds,['01140021','01140034','01140035','01140038']);
});
test('Aerospace imports all 80 current cross-faculty options without importing the prerequisite columns',()=>{
 const aerospace=program('aerospace-engineering-2026-2027');
 const list=aerospace.electiveGroups.find(g=>g.name.startsWith('בחירה מפקולטות אחרות'))!;
 assert.equal(list.courseIds.length,80);
 for(const id of ['00160210','00340404','00460212','01060400','02360927'])assert.ok(list.courseIds.includes(id));
 assert.equal(list.courseIds.includes('00840311'),false); // A prerequisite from the adjacent column, not an option.
 assert.deepEqual(list.sourceRefs,[{sourceId:'2026-2027-08-cross-faculty',pages:[1,2,3]}]);
 const ee=program('electrical-engineering-2026-2027');
 assert.ok(ee.electiveGroups.some(g=>g.rules.some(r=>r.id==='ee-external-year-unresolved'&&!r.automatic&&r.sourceUrls?.length===1)));
});
test('PDF number normalization joins only printed leading-zero fragments and expands explicit short ranges',()=>{
 assert.deepEqual(extractIds('0 3140124 0940202 0 960578 00850101-4'),['03140124','00940202','00960578','00850101','00850102','00850103','00850104']);
 assert.deepEqual(extractIds('2026/2027 023044-1-000 12.5 26.0'),[]);
});
test('each imported edition and group has a pinned official source and valid PDF pages',()=>{
 const sources=new Map(database.sources.map(s=>[s.id,s]));
 for(const source of database.sources){assert.match(new URL(source.url).hostname,/(^|\.)technion\.ac\.il$/);assert.match(source.sha256,/^[a-f0-9]{64}$/);}
 for(const catalog of database.programs)for(const ref of [...catalog.sourceRefs,...catalog.electiveGroups.flatMap(g=>g.sourceRefs)]){
  const source=sources.get(ref.sourceId)!;assert.ok(source);assert.equal(source.catalogYear,catalog.catalogYear);
  for(const page of ref.pages){assert.ok(page>=1&&page<=source.pageCount);}
 }
});
