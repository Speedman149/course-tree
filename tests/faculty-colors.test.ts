import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {facultyPalette,facultyColor,courseAppearance,NEUTRAL_FACULTY_COLOR,MARKED_COURSE_COLOR} from '../src/lib/faculty-colors';
import {collectRequirements} from '../src/lib/graph';
import {courseFaculties} from '../src/lib/filters';
import type {Course} from '../src/types';
const read=(path:string)=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url),'utf8'));
const courses=[...new Map([...read('public/data/catalogs.json').referencedCourses,...read('public/data/courses.json').courses].map((c:Course)=>[c.id,c])).values()] as Course[];
test('twelve colored faculties are ranked by unique actual course ownership',()=>{
 const owners=new Map<string,Set<string>>();
 for(const c of courses)for(const owner of courseFaculties(c))if(!owner.startsWith('unit:')){if(!owners.has(owner))owners.set(owner,new Set());owners.get(owner)!.add(c.id);}
 const ranked=[...owners].map(([id,ids])=>({id,count:ids.size})).sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id));
 assert.equal(facultyPalette.length,12);assert.deepEqual(facultyPalette.map(f=>({id:f.id,count:f.courseCount})),ranked.slice(0,12));
});
test('faculty accents are distinct and avoid the reserved red hue family',()=>{
 assert.equal(new Set(facultyPalette.map(f=>f.accent)).size,12);
 for(const {accent} of facultyPalette){
  const [r,g,b]=accent.match(/[a-f\d]{2}/gi)!.map(v=>parseInt(v,16)/255);const hi=Math.max(r,g,b),lo=Math.min(r,g,b),delta=hi-lo;
  const hue=delta===0?0:((hi===r?(g-b)/delta:hi===g?(b-r)/delta+2:(r-g)/delta+4)*60+360)%360;
  assert.ok(hue>35&&hue<310,`${accent} could be mistaken for reserved red`);assert.notEqual(accent,MARKED_COURSE_COLOR);
 }
});
test('shared ownership uses the documented primary faculty consistently',()=>{
 const original=courses.find(c=>courseFaculties(c).includes('cs'))!;
 const shared={...original,faculty:'הפקולטה למדעי המחשב',faculties:['הפקולטה למתמטיקה','הפקולטה למדעי המחשב']};
 assert.equal(courseAppearance(shared).id,'cs');assert.equal(courseAppearance(shared).accent,facultyColor('cs'));
 assert.equal(courseAppearance({...shared,faculties:[...shared.faculties].reverse()}).accent,facultyColor('cs'));
 assert.equal(facultyColor('unattributed'),NEUTRAL_FACULTY_COLOR);
});
test('highly connected faculty pairs receive measurable perceptual separation',()=>{
 const report=read('docs/faculty-colors/analysis.json');
 for(const pair of report.pairs.slice(0,10))assert.ok(pair.labDistance>45,`${pair.a}/${pair.b} too similar`);
 const index=new Map(courses.map(c=>[c.id,c]));let crossEdges=0;
 for(const course of courses)for(const leaf of collectRequirements(course.requirements)){
  const prerequisite=index.get(leaf.courseId);if(!prerequisite)continue;
  const a=courseFaculties(course).filter(id=>facultyPalette.some(f=>f.id===id));const b=courseFaculties(prerequisite).filter(id=>facultyPalette.some(f=>f.id===id));
  for(const x of a)for(const y of b)if((x==='cs'&&y==='ee')||(x==='ee'&&y==='cs'))crossEdges+=1/(a.length*b.length);
 }
 assert.equal(report.pairs.find(p=>p.a==='cs'&&p.b==='ee').directEdges,crossEdges);assert.equal(crossEdges,80);
});