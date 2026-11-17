/** Repair triage uses the real app membership function; the source audit stays independent. */
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {getCatalogRoles} from '../../src/lib/filters.ts';
const root=fileURLToPath(new URL('../../',import.meta.url));process.chdir(root);
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=(p:string)=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const objectHash=(value:any)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const out='audits/curriculum-repairs';fs.mkdirSync(out,{recursive:true});
const baselinePath=`${out}/before-state.json`;
if(!fs.existsSync(baselinePath)){
 const before=read('.cache/curriculum-repairs/before/catalogs.json');const sap=read('.cache/curriculum-repairs/before/courses.json');
 const records=new Map([...sap.courses,...before.referencedCourses].map(c=>[c.id,c]));
 fs.writeFileSync(baselinePath,JSON.stringify({
  runtimeHashes:{catalogs:hash('.cache/curriculum-repairs/before/catalogs.json'),courses:hash('.cache/curriculum-repairs/before/courses.json')},
  originalAuditHashes:Object.fromEntries(['accuracy-report.json','accuracy-report.md','input-lock.json','discrepancies.csv'].map(name=>[name,hash(`audits/curriculum-accuracy/${name}`)])),
  srcHashes:read('.cache/curriculum-repairs/before/src-hashes.json'),
  programs:before.programs.map(p=>({id:p.id,catalogYear:p.catalogYear,sha256:objectHash(p),eligibleCourseIds:[...records.keys()].filter(id=>getCatalogRoles(id,p,records as any).length>0).sort()})),
  courseHashes:Object.fromEntries(sap.courses.map(c=>[c.id,objectHash(c)])),
 },null,2)+'\n');
}
const before=read(baselinePath);const catalog=read('public/data/catalogs.json');const sap=read('public/data/courses.json');
const records=new Map([...sap.courses,...catalog.referencedCourses].map(c=>[c.id,c]));
const audit=read('audits/curriculum-accuracy/accuracy-report.json');
const evidence=read(`${out}/evidence/catalog-verification.json`);
const afterAudit=read(`${out}/after-corrections/accuracy-report.json`);
const fixed=new Set(['F-00067','F-00132','F-00133','F-00134','F-00135','F-00136','F-00139','F-00140','F-00141','F-00142','F-00143',...Array.from({length:34},(_,i)=>`F-${String(168+i).padStart(5,'0')}`)]);
function reason(f:any){
 const n=Number(f.id.slice(2));
 if(n===33||n===34)return 'Lab and both project alternatives already pass degree filtering. The difference is mandatory labeling / completion logic; all valid options are preserved.';
 if(n===54||n===55)return 'Default project and its official industrial substitute already pass the filter. Their one-of completion condition does not require a graph change.';
 if(n>=116&&n<=123)return 'Both catalog physics replacements are valid and already visible. Unconditional mandatory labels are a graduation classification issue; neither alternative is removed.';
 if(n===124||n===125)return '01340019 is a genuine compulsory course of this same degree. Its extra appearance inside a lab-choice pool is a grouping/credit-rule error, not an incorrect degree inclusion.';
 if(n===126)return 'Studio 02050586 appears in the degree semester table; the footnote distinguishes five studios for BSc and six for professional continuation. It remains available for exploration; no sixth-studio graduation obligation is enforced.';
 if(n===127||n===128)return 'The catalog permits either teaching-methods alternative; both are already visible. No course or prerequisite change is warranted.';
 if(n===129)return '03141000 is explicitly recommended within free choice. It is a valid option despite its inaccurate mandatory label; removing it would harm exploration.';
 if(n===130||n===131)return 'Both optics alternatives are source-listed and already available. A one-of graduation requirement is outside the repair scope.';
 if((n>=144&&n<=147)||(n>=153&&n<=160))return 'The course is already visible through its education-plan group. The missing mandatory role is metadata, not a graph or degree-filter omission.';
 if(n===202)return 'The root completion clause never creates graph prerequisites, but its inherited choice group also exposes 01140052/01140078. Page305 specifies 01140076 (Physics2P), without the standard-plan OR footnote. Optional-credit eligibility for the two inherited courses is not established; leave unchanged pending clarification.';
 throw Error(`No explicit disposition for ${f.id}`);
}
const changes=before.programs.map(p=>{
 const current=catalog.programs.find(c=>c.id===p.id);assert.ok(current,p.id);
 const eligible=[...records.keys()].filter(id=>getCatalogRoles(id,current,records as any).length>0).sort();
 const added=eligible.filter(id=>!p.eligibleCourseIds.includes(id));const removed=p.eligibleCourseIds.filter(id=>!eligible.includes(id));
 assert.deepEqual(removed,[],`${p.id}: valid options removed`);
 if(p.catalogYear==='2026-2027')assert.equal(objectHash(current),p.sha256,`${p.id}: separate year changed`);
 return {pathId:p.id,addedCourseIds:added,removedCourseIds:removed};
}).filter(p=>p.addedCourseIds.length||p.removedCourseIds.length);
const findings=audit.discrepancies.filter(f=>f.status==='confirmed_incorrect').map(f=>{
 const program=catalog.programs.find(p=>p.id===f.pathId);const old=before.programs.find(p=>p.id===f.pathId);
 const action=fixed.has(f.id)?'fixed':f.id==='F-00202'?'unresolved':'deliberately_ignored';
 const observations=[...evidence.observations.filter(o=>o.paths.includes(program.programId)&&o.courseIds.includes(f.courseId)),...(evidence.retainedFindingsRecheck??[]).filter(o=>o.findingId===f.id)];
 const now=f.courseId?getCatalogRoles(f.courseId,program,records as any):null;
 if(action==='fixed'){
  assert.ok(now?.length,`${f.id}: still filtered out`);
  assert.ok(observations.length,`${f.id}: missing independently rechecked evidence`);
  if(f.requirement==='mandatory_membership')assert.ok(program.mandatoryCourseIds.includes(f.courseId),f.id);
 }
 return {...f,action,visibleBefore:f.courseId?old.eligibleCourseIds.includes(f.courseId):null,visibleAfter:f.courseId?!!now.length:null,
  rolesAfter:now,reason:action==='fixed'?(f.id==='F-00067'?'Already eligible under an EE faculty rule; mandatory role now explicitly restored from page124.':'Source-listed course restored to degree selection with its verified role or conditional group.' ):reason(f),
  independentlyRecheckedEvidence:observations.map(o=>({file:'evidence/catalog-verification.json',pages:o.pages,interpretation:o.interpretation,visuallyRechecked:o.visuallyRechecked})),
 };
});
assert.equal(findings.length,78);assert.equal(findings.filter(f=>f.action==='fixed').length,45);
for(const [file,expected] of Object.entries(before.srcHashes))assert.equal(hash(file),expected,`Interface/source changed: ${file}`);
for(const [file,expected] of Object.entries(before.originalAuditHashes))assert.equal(hash(`audits/curriculum-accuracy/${file}`),expected,`Historical audit changed: ${file}`);
const changedCourses=sap.courses.filter(c=>objectHash(c)!==before.courseHashes[c.id]).map(c=>c.id);
assert.deepEqual(changedCourses,['00540417']);
const official=audit.officialCourseDataAudit.records.find(c=>c.courseId==='00540417');
const corrected=afterAudit.officialCourseDataAudit.records.find(c=>c.courseId==='00540417');
assert.equal(corrected.strongPrerequisites.status,'confirmed_correct');
const prerequisiteFinding={id:'OFFICIAL-00540417-2026_200',courseId:'00540417',term:'2026_200',action:'fixed',expected:official.strongPrerequisites.expected,actualBefore:official.strongPrerequisites.actual,actualAfter:corrected.strongPrerequisites.actual,
 reason:'Fresh official same-term response confirms four OR branches. Restored missing graph connections from 00540324 and 00540482 without deriving any edge from a degree requirement.',evidenceFile:'evidence/00540417-2026_200.official.json'};
const report={generatedAt:new Date().toISOString(),scope:'Course exploration and degree-filter repairs only; no graduation certification or interface change.',summary:{confirmedCurriculumFindingsReviewed:78,curriculumFindingsFixed:45,deliberatelyIgnored:32,unresolvedConfirmedFindings:1,officialPrerequisiteFindingsFixed:1,addedPathCourseSelections:changes.reduce((n,p)=>n+p.addedCourseIds.length,0),pathsGainingVisibleCourses:changes.length,removedPathCourseSelections:0,changedSAPCourseRecords:changedCourses,untouched2026Editions:20,interfaceSourceUnchanged:true,historicalAuditUnchanged:true},runtimeHashes:{catalogs:hash('public/data/catalogs.json'),courses:hash('public/data/courses.json')},membershipChanges:changes,findings,prerequisiteFinding,afterAuditTotals:afterAudit.totals,
 unresolved:[
  {question:'May Physics2/2L count as optional courses in Biomedical Physics, or should the inherited mandatory-choice pool be removed?',courses:['01140052','01140078'],pages:[304,305],action:'Unchanged; no completion rule is interpreted as a prerequisite edge.'},
  {question:'What are the actual IDs behind Haznek126xxxx/126xxx, and the conflicting course listings later in the chapter?',pages:[197,198,204,205],action:'No invented IDs or unreviewed semester import. The four paths remain partial; focus options are labeled as combined BSc/MSc.'},
  {question:'Obtain authoritative archived prerequisite rules for the four old-term courses with empty current official responses.',courses:['01040276','02040062','02360329','02360376'],term:'2024_201',action:'Historical graph edges retained; empty live fields are not proof of no prerequisites.'},
  {question:'Obtain official course metadata/prerequisites for01160027 and other catalog-only records.',courses:['01160027'],pages:[305],action:'Catalog-listed node is visible with unknown SAP details. No names, credits or prerequisite edges invented.'},
 ],
 verificationResultsFile: 'verification-results.json',
};
fs.writeFileSync(`${out}/triage.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary,null,2));