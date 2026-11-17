import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {courseFaculties,getFacultyOptions} from '../src/lib/filters.ts';
import {collectRequirements} from '../src/lib/graph.ts';
import type {Course} from '../src/types.ts';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const sap=JSON.parse(fs.readFileSync('public/data/courses.json','utf8'));
const catalogs=JSON.parse(fs.readFileSync('public/data/catalogs.json','utf8'));
const courses=[...new Map([...catalogs.referencedCourses,...sap.courses].map((c:Course)=>[c.id,c])).values()] as Course[];
const index=new Map(courses.map(c=>[c.id,c]));
// Count a shared course once in each documented owner; unique IDs within each faculty.
// Unattributed placeholders and unrecognized administrative units are not faculties.
const ranking=getFacultyOptions(courses).filter(f=>!f.id.startsWith('unit:')).sort((a,b)=>b.courseCount-a.courseCount||a.id.localeCompare(b.id));
const top=ranking.slice(0,12);const selected=new Set(top.map(f=>f.id));
const owners=(c:Course|undefined)=>c?courseFaculties(c).filter(id=>selected.has(id)):[];
const key=(a:string,b:string)=>[a,b].sort().join('|');
const direct=new Map<string,number>();const shared=new Map<string,number>();
const neighbors=new Map<string,Set<string>>();
let crossEdges=0;
for(const c of courses)for(const r of collectRequirements(c.requirements)){
 const a=owners(c),b=owners(index.get(r.courseId));
 for(const x of a)for(const y of b)if(x!==y){const k=key(x,y);direct.set(k,(direct.get(k)??0)+1/(a.length*b.length));crossEdges++;}
 if(!neighbors.has(c.id))neighbors.set(c.id,new Set());if(!neighbors.has(r.courseId))neighbors.set(r.courseId,new Set());
 neighbors.get(c.id)!.add(r.courseId);neighbors.get(r.courseId)!.add(c.id);
}
for(const nearby of neighbors.values()){
 const faculties=[...new Set([...nearby].flatMap(id=>owners(index.get(id))))];
 for(let i=0;i<faculties.length;i++)for(let j=i+1;j<faculties.length;j++){const k=key(faculties[i],faculties[j]);shared.set(k,(shared.get(k)??0)+1);}
}
const palette=['#2455A4','#087F8C','#7651B5','#6E7D22','#996B0B','#267546','#187DAA','#4446A1','#835187','#357F70','#806535','#516879'];
function lab(hex:string){
 const [r,g,b]=hex.match(/[a-f\d]{2}/gi)!.map(v=>parseInt(v,16)/255).map(v=>v>.04045?((v+.055)/1.055)**2.4:v/12.92);
 const f=(t:number)=>t>.008856?Math.cbrt(t):7.787*t+16/116;
 const x=f((.4124564*r+.3575761*g+.1804375*b)/.95047),y=f(.2126729*r+.7151522*g+.072175*b),z=f((.0193339*r+.119192*g+.9503041*b)/1.08883);
 return [116*y-16,500*(x-y),200*(y-z)];
}
const colors=palette.map(lab);const distance=(a:number,b:number)=>Math.hypot(...colors[a].map((v,i)=>v-colors[b][i]));
const pairs=top.flatMap((a,i)=>top.slice(i+1).map((b,j)=>({i,j:i+1+j,a:a.id,b:b.id,directEdges:direct.get(key(a.id,b.id))??0,sharedNeighborhoods:shared.get(key(a.id,b.id))??0})));
const weight=(p:typeof pairs[number])=>3*Math.log1p(p.directEdges)+Math.log1p(p.sharedNeighborhoods);
const score=(order:number[])=>pairs.reduce((sum,p)=>sum+weight(p)*Math.log(1+distance(order[p.i],order[p.j])),0);
let seed=74021;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
let best=palette.map((_,i)=>i),bestScore=score(best);
for(let trial=0;trial<120;trial++){
 const order=palette.map((_,i)=>i);for(let i=11;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 let current=score(order),improved=true;
 while(improved){improved=false;for(let i=0;i<12;i++)for(let j=i+1;j<12;j++){
  [order[i],order[j]]=[order[j],order[i]];const next=score(order);
  if(next>current+1e-8){current=next;improved=true;}else [order[i],order[j]]=[order[j],order[i]];
 }}
 if(current>bestScore){best=[...order];bestScore=current;}
}
const assignments=top.map((f,i)=>({id:f.id,label:f.label,courseCount:f.courseCount,accent:palette[best[i]]}));
const report={courseCount:courses.length,policy:'Deduplicate by canonical course ID. Count each shared course once per documented faculty. Exclude unattributed placeholders/unrecognized administrative units from faculty ranking; retain their neutral labels. Node color uses its primary offering faculty, or the alphabetically first documented owner if primary is absent.',ranking:ranking.map(({id,label,courseCount})=>({id,label,courseCount})),assignments,method:'Fixed non-red candidate accents; deterministic swap search maximizes graph-weighted CIELAB separation. Pair weight=3*log(1+direct prerequisite relationships)+log(1+shared one-hop neighborhoods). Neighborhoods include prerequisites and dependents; they approximate same-branch proximity, without changing graph logic.',weightedScore:bestScore,pairs:pairs.map(p=>({...p,labDistance:distance(best[p.i],best[p.j])})).sort((a,b)=>weight(b)-weight(a))};
fs.writeFileSync('docs/faculty-colors/analysis.json',JSON.stringify(report,null,2)+'\n');
fs.writeFileSync('src/data/faculty-palette.json',JSON.stringify(assignments,null,2)+'\n');
console.log(JSON.stringify({courses:courses.length,assignments,strongestConnections:report.pairs.slice(0,10)},null,2));