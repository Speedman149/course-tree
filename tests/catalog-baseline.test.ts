import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {CatalogDataset,CourseDataset,DegreeCatalog} from '../src/types';
import {createCourseVisibility,getCatalogRoles,getFacultyOptions} from '../src/lib/filters';
import {validateCatalog} from '../scripts/catalogs/coverage.mjs';
import {overview} from '../data/catalogs/overview.mjs';
const database=JSON.parse(readFileSync(new URL('../public/data/catalogs.json',import.meta.url),'utf8')) as CatalogDataset;
const report=JSON.parse(readFileSync(new URL('../public/data/catalog-coverage.json',import.meta.url),'utf8'));
const sap=JSON.parse(readFileSync(new URL('../public/data/courses.json',import.meta.url),'utf8')) as CourseDataset;
const courses=[...sap.courses,...database.referencedCourses!];const index=new Map(courses.map(course=>[course.id,course]));
const allFaculties=new Set(getFacultyOptions(courses).map(faculty=>faculty.id));
const program=(id:string)=>database.programs.find(program=>program.id===`${id}-2025-2026`)!;

test('independent overview is represented without inventing eligibility for unresolved paths',()=>{
 assert.equal(overview.length,57);
 for(const row of overview){const imported=program(row.programId);assert.ok(imported,`${row.programId} omitted`);assert.ok(imported.sourceRefs.length);}
 assert.equal(report.totals.overviewPathsRecorded,57);
 assert.equal(report.sourceAllPagesExtracted,true);
 assert.equal(report.allUndergraduateSectionsTextInspected,true);
 assert.equal(database.sources.find(source=>source.id==='2025-2026-full')!.pageCount,380);
 const unresolved=program('mathematics-cs-four-year');assert.equal(unresolved.coverage.status,'inventory-only');
 const unsafe:DegreeCatalog={...unresolved,mandatoryCourseIds:['02340114']};
 assert.deepEqual(getCatalogRoles('02340114',unsafe,index),[]);
 assert.equal(createCourseVisibility(courses,allFaculties,unsafe)('02340114'),false);
});

test('each documented double degree is distinct and uses its prescribed curriculum',()=>{
 for(const [id,faculties] of [['medicine-cs-double',['medicine','cs']],['medicine-data-engineering',['medicine','data']],['medicine-biomedical-engineering',['medicine','biomedical']]] as const){
  const catalog=program(id);assert.ok(catalog,id);assert.equal(catalog.programCategory,'double-degree');
  for(const faculty of faculties)assert.ok(catalog.facultyIds.includes(faculty));
  assert.ok(catalog.mandatoryCourseIds.length>20,`${id} must import its actual tables`);
  assert.ok((catalog.qualificationAwarded?.length??0)>=2);
  assert.equal(catalog.coverage.status,'partial');
 }
 assert.equal(program('cs-physics').programCategory,'combined');
 assert.notDeepEqual(program('cs-physics').mandatoryCourseIds,program('cs-three-year').mandatoryCourseIds);
});

test('baseline concentrations preserve different requirements and finite lists',()=>{
 const general=program('cs-four-year'); const cyber=database.programs.find(p=>p.catalogYear==='2025-2026'&&p.programId.includes('cyber'))!;
 assert.ok(cyber);assert.equal(cyber.programCategory,'concentration');
 assert.notDeepEqual(cyber.mandatoryCourseIds,general.mandatoryCourseIds);
 assert.ok(cyber.electiveGroups.length>0);assert.ok((cyber.requirementRules?.length??0)>0);
 const combined=program('electrical-physics');assert.equal(combined.programCategory,'combined');assert.ok(combined.electiveGroups.length>=10);
 const mathOnly=createCourseVisibility(courses,new Set(['math']),program('cs-three-year'));
 for(const course of courses)if(mathOnly(course.id))assert.ok((course.faculty==='הפקולטה למתמטיקה')||(course.faculties??[]).includes('הפקולטה למתמטיקה'));
});

test('published audit is candid about completeness and accounts for every imported explicit course',()=>{
 // The old importer text loses the 1160027 row; original-PDF visual evidence
 // independently verifies it. Keep the extraction warning visible, not a false pass.
 assert.deepEqual(report.unresolvedEvidence.map((row:any)=>[row.programId,row.courseIds]),[['biomedical-physics',['01160027']]]);
 const recheck=JSON.parse(readFileSync(new URL('../audits/curriculum-repairs/evidence/catalog-verification.json',import.meta.url),'utf8'));
 assert.ok(recheck.observations.some((row:any)=>row.visuallyRechecked&&row.courseIds.includes('01160027')&&row.pages.includes(305)));
 assert.equal(report.totals.fullyVerifiedCurricula,0);
 assert.ok(report.totals.partiallyImportedCurricula>50);
 assert.ok(report.totals.uniqueExplicitCourses>1500);
 assert.ok(report.totals.inventoryOnlyPaths>0);
 assert.ok(report.excludedGraduateSections.some(section=>section.pages.includes(313)));
 for(const catalog of database.programs.filter(program=>program.catalogYear==='2025-2026')){
  if(catalog.coverage.status==='inventory-only'){assert.equal(catalog.coverage.mandatoryComplete,false);assert.equal(catalog.coverage.electivesComplete,false);} assert.equal(catalog.coverage.electivesComplete,false);
  for(const id of [...catalog.mandatoryCourseIds,...catalog.electiveGroups.flatMap(group=>group.courseIds)])assert.ok(index.has(id),`${catalog.id}/${id} missing from UI records`);
 }
});

test('validation rejects cross-year source leakage and duplicate programs',()=>{
 validateCatalog(database);
 const current=database.programs.find(program=>program.catalogYear==='2026-2027')!;
 assert.throws(()=>validateCatalog({...database,programs:[{...program('cs-three-year'),sourceRefs:current.sourceRefs}]}),/Mixed catalog years/);
 assert.throws(()=>validateCatalog({...database,programs:[current,current]}),/Duplicate program/);
});
test('documented alternatives are visible while replaced background requirements remain excluded',()=>{
 const civil=program('civil-water');
 for(const id of ['01140077','01140078'])assert.ok(getCatalogRoles(id,civil,index).length>0);
 const learning=program('cs-learning-data');
 const algebra=learning.electiveGroups.find(group=>group.courseIds.includes('01040134')&&group.courseIds.includes('01040174'));
 assert.ok(algebra);assert.equal(algebra.role,'mandatory-choice');
 assert.equal(learning.mandatoryCourseIds.includes('01040174'),false);
 assert.equal(createCourseVisibility(courses,allFaculties,program('chemical-pharmaceutical'))('01340127'),false);
 for(const catalog of database.programs.filter(program=>program.catalogYear==='2025-2026'&&program.coverage.status!=='inventory-only')){
  const requiredOptions=new Set<string>();
  const visit=(rule:any)=>{if(rule.type==='course')requiredOptions.add(rule.courseId);for(const id of rule.replacementCourseIds??[])requiredOptions.add(id);for(const child of rule.items??[])visit(child);if(rule.requirement)visit(rule.requirement);};
  for(const rule of catalog.requirementRules??[])visit(rule);
  for(const id of requiredOptions)assert.ok(getCatalogRoles(id,catalog,index).length,`${catalog.id}: ${id} is a documented requirement option missing from membership`);
 }
});