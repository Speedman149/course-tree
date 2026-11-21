import test from 'node:test';
import assert from 'node:assert/strict';
import type { Course, DegreeCatalog, Requirement } from '../src/types';
import { courseFaculties, createCourseVisibility, getCatalogRoles, getFacultyOptions } from '../src/lib/filters';
import { buildCourseIndex, buildDependents, buildGraph } from '../src/lib/graph';
const cs='הפקולטה למדעי המחשב', math='הפקולטה למתמטיקה';
const leaf=(courseId:string):Requirement=>({type:'course',courseId,relation:'strong'});
const course=(id:string,faculty:string,requirements:Requirement|null=null):Course=>({id,name:id,faculty,requirements,requirementsStatus:requirements?'known':'none',source:{url:'https://example.test/'+id}});
const catalog:DegreeCatalog={id:'p-2026',programId:'p',facultyIds:['cs'],officialName:'תואר',degreeType:'B.Sc.',catalogYear:'2026-2027',mandatoryCourseIds:['A','B'],electiveGroups:[{id:'list-a',name:'רשימה א׳',role:'elective',courseIds:['C','B'],conditions:['יש לבחור לפי כללי הקבוצה'],rules:[],sourceRefs:[]}],additionalEligibleCourseIds:[],sourceRefs:[],coverage:{status:'verified-listed',notes:[]}};
test('faculty ownership uses source labels, merges documented spelling variants, and supports multiple owners',()=>{
 const joint={...course('J',cs),faculties:[cs,math]};
 assert.deepEqual(courseFaculties(joint),['cs','math']);
 const options=getFacultyOptions([joint,course('A','הפקולטה להנדסת אווירונוטיקה וחלל'),course('B','הפקולטה להנדסת אוירונוטיקה וחלל')]);
 assert.equal(options.length,3);assert.equal(options.find(f=>f.id==='aerospace')?.courseCount,2);
 assert.equal(createCourseVisibility([joint],new Set(['math']),null)('J'),true);
});
test('faculty selection, clear all, and restoration affect visibility without changing records',()=>{
 const records=[course('A',cs),course('B',math)]; const original=JSON.stringify(records);
 assert.equal(createCourseVisibility(records,new Set(['cs']),null)('B'),false);
 assert.equal(createCourseVisibility(records,new Set(['cs','math']),null)('B'),true);
 assert.equal(createCourseVisibility(records,new Set(),null)('A'),false);
 assert.equal(JSON.stringify(records),original);
});
test('degree membership includes all listed electives, multiple roles, and cross-faculty mandatory courses',()=>{
 const records=[course('A',cs),course('B',math),course('C',math),course('D',cs)]; const index=buildCourseIndex(records);
 const visible=createCourseVisibility(records,new Set(['cs','math']),catalog);
 for(const id of ['A','B','C'])assert.equal(visible(id),true);assert.equal(visible('D'),false);
 assert.equal(getCatalogRoles('B',catalog,index).length,2);
 const combined=createCourseVisibility(records,new Set(['math']),catalog);
 assert.equal(combined('A'),false);assert.equal(combined('B'),true);assert.equal(combined('C'),true);
});
test('forward filtering prunes a path without connecting across hidden nodes, then restores its expansion',()=>{
 const records=[course('A',cs),course('B',math,leaf('A')),course('C',cs,leaf('B')),course('D',cs,leaf('A'))];
 const index=buildCourseIndex(records),deps=buildDependents(records); const expansion=new Set(['A','B']);
 const before=buildGraph(['A'],index,deps,expansion,new Map());
 const filtered=buildGraph(['A'],index,deps,expansion,new Map(),createCourseVisibility(records,new Set(['cs']),null));
 assert.deepEqual(filtered.nodes.map(n=>n.courseId),['A','D']);assert.equal(expansion.has('B'),true);
 assert.deepEqual(buildGraph(['A'],index,deps,expansion,new Map()),before);
});
test('backward exploration ignores every filter; forward branches off backward nodes still respect filters',()=>{
 const records=[course('A',cs),course('B',math,leaf('A')),course('C',cs,leaf('B')),course('D',math,leaf('B'))];
 const index=buildCourseIndex(records),deps=buildDependents(records);
 const back=new Map([['C',new Set(['B'])],['B',new Set(['A'])]]);
 const graph=buildGraph(['C'],index,deps,new Set(['B']),back,()=>false);
 assert.deepEqual(graph.nodes.map(n=>n.courseId),['C','B','A']);assert.equal(graph.nodes[0].direction,'root');
});
test('open approval rules do not silently make every course eligible',()=>{
 const c={...catalog,mandatoryCourseIds:[],electiveGroups:[{id:'approval',name:'אישור',role:'elective' as const,courseIds:[],conditions:[],rules:[{id:'r',kind:'all-courses' as const,automatic:false,description:'באישור'}],sourceRefs:[]}]};
 const records=[course('Z',cs)];assert.equal(createCourseVisibility(records,new Set(['cs']),c)('Z'),false);
});
test('explicit broad faculty rules are evaluated in their catalog year and do not imply cross-faculty ownership',()=>{
 const c={...catalog,mandatoryCourseIds:[],electiveGroups:[{id:'all-cs',name:'רשימה א',role:'elective' as const,courseIds:[],conditions:[],rules:[{id:'r',kind:'faculty' as const,facultyIds:['cs'],automatic:true,description:'כל מקצועות הפקולטה'}],sourceRefs:[]}]};
 const records=[{...course('X',cs),availableSourceTerms:['2026_200']},{...course('Y',cs),availableSourceTerms:['2025_200']},course('Z',math)];
 const visible=createCourseVisibility(records,new Set(['cs','math']),c);
 assert.equal(visible('X'),true);assert.equal(visible('Y'),false);assert.equal(visible('Z'),false);
});
