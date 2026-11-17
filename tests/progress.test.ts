import test from 'node:test';
import assert from 'node:assert/strict';
import {PROGRESS_KEY,encodeProgress,decodeProgress,defaultProgress,validateProgress,type ProgressDatabase} from '../src/lib/progress';
import type {Course,DegreeCatalog} from '../src/types';
const course=(id:string,requirements:Course['requirements']=null):Course=>({id,name:id,faculty:'test',requirements,requirementsStatus:requirements?'known':'none',source:{url:'https://example.test'}});
const leaf=(courseId:string)=>({type:'course',courseId,relation:'strong'} as const);
const a=course('02340114'),b=course('02340218',leaf(a.id)),c=course('02340247',leaf(b.id));
const db:ProgressDatabase={courses:new Map([a,b,c].map(c=>[c.id,c])),facultyIds:new Set(['cs','math']),programs:[{id:'cs-three-year-2025-2026',catalogYear:'2025-2026',facultyIds:['cs']} as DegreeCatalog],years:['2025-2026','2026-2027'],defaultYear:'2025-2026',defaultRoot:a.id};
test('versioned progress round-trips stable identifiers, not course data',()=>{
 const state={...defaultProgress(db),markedCourseIds:[b.id]};
 assert.deepEqual(decodeProgress(encodeProgress(state)),state);assert.equal(PROGRESS_KEY,'course-tree.progress');
 assert.equal(encodeProgress(state).includes('requirements'),false);
});
test('corrupt, oversized, unsupported and absent storage safely fall back',()=>{
 for(const raw of [null,'{oops','null','[]','{"version":999,"progress":{}}','x'.repeat(2_000_001)])assert.equal(decodeProgress(raw),null);
 assert.deepEqual(validateProgress(null,db),defaultProgress(db));
});
test('invalid individual courses, faculty IDs and catalogs do not erase unrelated progress',()=>{
 const saved={...defaultProgress(db),rootId:b.id,facultyIds:['math','missing'],catalogId:'gone',markedCourseIds:[b.id,'99999999'],recent:[a.id,'99999999'],viewport:{x:20,y:35,zoom:.7}};
 const valid=validateProgress(saved,db);assert.deepEqual(valid.facultyIds,['math']);assert.deepEqual(valid.markedCourseIds,[b.id]);assert.equal(valid.rootId,b.id);assert.equal(valid.catalogId,'');assert.deepEqual(valid.recent,[a.id]);assert.deepEqual(valid.viewport,saved.viewport);
});
test('restores only actual forward/backward paths, retaining collapsed or filter-hidden descendants',()=>{
 const saved={...defaultProgress(db),rootId:b.id,expandedForward:['root/f:02340247:strong','root/f:99999999:strong','junk'],expandedBackward:[['root',[a.id,c.id]],['root/f:02340247:strong',[b.id]],['root/b:99999999:strong',[a.id]]],facultyIds:[]};
 const valid=validateProgress(saved,db);assert.deepEqual(valid.expandedForward,['root/f:02340247:strong']);assert.deepEqual(valid.expandedBackward,[['root',[a.id]],['root/f:02340247:strong',[b.id]]]);assert.deepEqual(valid.facultyIds,[]);
});
test('explicit root URLs replace graph configuration while retaining markings and filters',()=>{
 const saved={...defaultProgress(db),rootId:b.id,markedCourseIds:[c.id],facultyIds:['math'],viewport:{x:10,y:20,zoom:1},expandedBackward:[['root',[a.id]]]};
 const valid=validateProgress(saved,db,c.id);assert.equal(valid.rootId,c.id);assert.deepEqual(valid.markedCourseIds,[c.id]);assert.deepEqual(valid.facultyIds,['math']);assert.deepEqual(valid.expandedBackward,[]);assert.deepEqual(valid.expandedForward,['root']);assert.equal(valid.viewport,null);
});
test('an invalid root discards its branches, not valid markings or catalog selection',()=>{
 const saved={...defaultProgress(db),rootId:'99999999',catalogId:db.programs![0].id,markedCourseIds:[b.id],expandedForward:['root/f:02340247:strong']};
 const valid=validateProgress(saved,db);assert.equal(valid.rootId,a.id);assert.equal(valid.catalogId,db.programs![0].id);assert.deepEqual(valid.markedCourseIds,[b.id]);assert.deepEqual(valid.expandedForward,['root']);
});
test('empty faculty selection, all-years browsing and collapsed root survive',()=>{
 const saved={...defaultProgress(db),facultyIds:[],catalogYear:'',expandedForward:[]};
 const valid=validateProgress(saved,db);assert.deepEqual(valid.facultyIds,[]);assert.equal(valid.catalogYear,'');assert.deepEqual(valid.expandedForward,[]);
});
test('invalid viewports are discarded without discarding the exploration',()=>{
 for(const viewport of [{x:null,y:0,zoom:1},{x:0,y:0,zoom:20},{x:Infinity,y:0,zoom:1},{x:0,y:0,zoom:-1}]){
  const valid=validateProgress({...defaultProgress(db),markedCourseIds:[b.id],viewport},db);assert.equal(valid.viewport,null);assert.deepEqual(valid.markedCourseIds,[b.id]);
 }
});
test('catalog download failure preserves the selected catalog until validation is possible',()=>{
 const valid=validateProgress({...defaultProgress(db),catalogId:'cs-three-year-2025-2026',markedCourseIds:[b.id]},{...db,programs:null});assert.equal(valid.catalogId,'cs-three-year-2025-2026');assert.deepEqual(valid.markedCourseIds,[b.id]);
});
test('referenced courses without full records can retain their personal marking',()=>{
 const unknown='01040031';const referring=course(c.id,leaf(unknown));
 const valid=validateProgress({...defaultProgress(db),markedCourseIds:[unknown]},{...db,courses:new Map([...db.courses,[c.id,referring]])});assert.deepEqual(valid.markedCourseIds,[unknown]);
});
test('version1 sessions migrate without losing graph, filters or course markings',()=>{
 const prior={...defaultProgress(db),rootId:b.id,markedCourseIds:[a.id],facultyIds:['math'],catalogId:db.programs![0].id};
 const old={...prior} as Partial<typeof prior>;delete old.hiddenForwardConnections;
 const migrated=validateProgress(decodeProgress(JSON.stringify({version:1,progress:old})),db);
 assert.equal(migrated.rootId,b.id);assert.deepEqual(migrated.markedCourseIds,[a.id]);assert.deepEqual(migrated.facultyIds,['math']);assert.equal(migrated.catalogId,prior.catalogId);assert.deepEqual(migrated.hiddenForwardConnections,[]);
 assert.equal(JSON.parse(encodeProgress(migrated)).version,2);
});
test('valid hidden forward connections survive independent of collapsed ancestors and filters',()=>{
 const hidden='root/f:02340218:strong/f:02340247:strong';
 const state={...defaultProgress(db),expandedForward:[],facultyIds:[],hiddenForwardConnections:[hidden,'root','bad','root/b:02340218:strong','root/f:99999999:strong','root/f:02340218:concurrent']};
 const valid=validateProgress(state,db);assert.deepEqual(valid.hiddenForwardConnections,[hidden]);assert.deepEqual(valid.expandedForward,[]);assert.deepEqual(valid.facultyIds,[]);
});
test('changing the root clears connection visibility while retaining unrelated valid user progress',()=>{
 const state={...defaultProgress(db),hiddenForwardConnections:['root/f:02340218:strong'],markedCourseIds:[c.id]};
 const valid=validateProgress(state,db,c.id);assert.deepEqual(valid.hiddenForwardConnections,[]);assert.deepEqual(valid.markedCourseIds,[c.id]);
});