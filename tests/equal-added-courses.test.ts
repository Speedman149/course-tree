import test from 'node:test';
import assert from 'node:assert/strict';
import type {Course} from '../src/types';
import {buildCourseIndex,buildDependents,buildGraph,forwardConnectionId} from '../src/lib/graph';
import {initialExploration,explorationReducer,type ExplorationState} from '../src/lib/exploration';
import {defaultProgress,decodeProgress,encodeProgress,validateProgress,PROGRESS_VERSION,type ProgressDatabase} from '../src/lib/progress';
const A='02340114',B='02340218',C='02340247',U='01040031',TEAM='03940902';
const course=(id:string,prerequisite?:string):Course=>({id,name:id,aliases:id===A?['234114']:[],faculty:'הפקולטה למדעי המחשב',credits:2.5,
 requirements:prerequisite?{type:'course',courseId:prerequisite,relation:'strong'}:null,requirementsStatus:prerequisite?'known':'none',source:{url:'https://portalex.technion.ac.il/'}});
const records=[course(A),course(B,A),course(C,B),course(U),course(TEAM)],courses=buildCourseIndex(records),dependents=buildDependents(records);
const db:ProgressDatabase={courses,facultyIds:new Set(['cs']),programs:[],years:['2025-2026'],defaultYear:'2025-2026',defaultRoot:A};
const graph=(state:ExplorationState)=>buildGraph(state.addedCourseIds,courses,dependents,state.expandedForward,state.expandedBackward,()=>true,state.hiddenForwardConnections,state.automaticConnections,state.revealedForwardConnections,new Set(state.addedCourseIds),state.autoExpandedCourseIds);
const add=(state:ExplorationState,id:string)=>explorationReducer(state,{type:'addCourse',courseId:id,context:{courses,dependents,isVisible:()=>true,visibleCourseIds:new Set(graph(state).nodes.map(n=>n.id))}});
const remove=(state:ExplorationState,id:string)=>explorationReducer(state,{type:'removeCourse',courseId:id,context:{courses,dependents,isVisible:()=>true,visibleCourseIds:new Set(graph(state).nodes.map(n=>n.id))}});

test('a fresh default has exactly the same collection membership and removal behavior as later additions',()=>{
 const first=initialExploration(A);assert.deepEqual(first.addedCourseIds,[A]);assert.ok(graph(first).nodes.find(n=>n.id===A)?.added);
 const empty=remove(first,A);assert.deepEqual(empty.addedCourseIds,[]);assert.deepEqual(graph(empty).nodes,[]);
 const later=add(empty,A);assert.deepEqual(later.addedCourseIds,first.addedCourseIds);assert.deepEqual(graph(later),graph(first));
 assert.equal('primaryCourseId' in later,false);
});
test('adding an existing course requests a fresh focus without changing nodes, connections or collection',()=>{
 const before=add(initialExploration(A),C),again=add(before,C);
 assert.deepEqual(again.addedCourseIds,before.addedCourseIds);assert.deepEqual(graph(again),graph(before));
 assert.equal(again.focusRequest?.courseId,C);assert.ok(again.focusRequest!.sequence>before.focusRequest!.sequence);
});
test('ancestor and descendant additions retain the same real prerequisite arrows in either order',()=>{
 const left=graph(add(initialExploration(A),C)),right=graph(add(initialExploration(C),A));
 const arrows=(g:ReturnType<typeof graph>)=>g.edges.map(e=>[e.source,e.target,e.relation].join(':')).sort();
 assert.deepEqual(arrows(left),arrows(right));assert.equal(new Set(right.nodes.map(n=>n.id)).size,right.nodes.length);
 for(const id of [A,C])assert.ok(right.nodes.find(n=>n.id===id)?.added);
});
test('removing the first addition does not promote, remove, or reset the remaining additions',()=>{
 let state=add(add(initialExploration(A),C),U);state.expandedForward.add(C);state.expandedBackward.set(C,new Set([B]));
 const remaining=remove(state,A);assert.deepEqual(remaining.addedCourseIds,[C,U]);assert.ok(remaining.expandedForward.has(C));assert.ok(remaining.expandedBackward.get(C)?.has(B));
 assert.ok(graph(remaining).nodes.some(n=>n.id===C));assert.ok(graph(remaining).nodes.some(n=>n.id===U));assert.equal('primaryCourseId' in remaining,false);
});
test('clear-all removes every anchor and automatic owner while retaining explicit hidden/manual intent',()=>{
 let state=add(initialExploration(A),C);state.expandedForward.add(B);state.hiddenForwardConnections.add(forwardConnectionId(B,C,'strong'));
 const cleared=explorationReducer(state,{type:'clearAdded'});assert.deepEqual(cleared.addedCourseIds,[]);assert.deepEqual(graph(cleared).nodes,[]);assert.deepEqual(cleared.automaticConnections,[]);
 assert.ok(cleared.expandedForward.has(B));assert.deepEqual(cleared.hiddenForwardConnections,state.hiddenForwardConnections);
});
test('v6 migration merges a separate primary with additions once and preserves quantities, filters, viewport and connections',()=>{
 const raw={...defaultProgress(db),primaryCourseId:A,addedCourseIds:[U,C],expandedForward:[A,B],markedCourseIds:[TEAM],markedCourseQuantities:{[TEAM]:3},facultyIds:['cs'],viewport:{x:35,y:-20,zoom:.7},hiddenForwardConnections:[forwardConnectionId(A,B,'strong')]};
 const migrated=validateProgress(decodeProgress(JSON.stringify({version:6,progress:raw})),db);
 assert.deepEqual(migrated.addedCourseIds,[A,U,C]);assert.deepEqual(migrated.markedCourseQuantities,{[TEAM]:3});assert.deepEqual(migrated.markedCourseIds,[TEAM]);assert.deepEqual(migrated.facultyIds,['cs']);assert.deepEqual(migrated.viewport,raw.viewport);assert.deepEqual(migrated.hiddenForwardConnections,raw.hiddenForwardConnections);
 const encoded=JSON.parse(encodeProgress(migrated));assert.equal(encoded.version,7);assert.equal(PROGRESS_VERSION,7);assert.equal('primaryCourseId' in encoded.progress,false);
 assert.deepEqual(validateProgress(decodeProgress(encodeProgress(migrated)),db),migrated);
});
test('old-ID primary and repeated aliases merge to a single canonical course without dropping additions',()=>{
 const migrated=validateProgress({primaryCourseId:'234114',addedCourseIds:[A,'234114',U]},db);assert.deepEqual(migrated.addedCourseIds,[A,U]);
});
test('new empty selections survive validation, storage and legacy empty migrations',()=>{
 const empty={...defaultProgress(db),addedCourseIds:[],expandedForward:[],autoExpandedCourseIds:[],markedCourseIds:[TEAM],markedCourseQuantities:{[TEAM]:3}};
 assert.deepEqual(validateProgress(decodeProgress(encodeProgress(empty)),db),empty);
 for(const version of [3,4,5,6]){const raw=version<5?{pinnedRootIds:[]}:{primaryCourseId:'',addedCourseIds:[]};assert.deepEqual(validateProgress(decodeProgress(JSON.stringify({version,progress:raw})),db).addedCourseIds,[]);}
});
test('an incoming course URL appends a real connecting path while preserving the rest of the saved board',()=>{
 const state={...defaultProgress(db),addedCourseIds:[A,U],expandedForward:[A],markedCourseIds:[TEAM],markedCourseQuantities:{[TEAM]:3},viewport:{x:5,y:10,zoom:.8}};
 const next=validateProgress(state,db,C);assert.deepEqual(next.addedCourseIds,[A,U,C]);assert.deepEqual(next.markedCourseQuantities,state.markedCourseQuantities);assert.deepEqual(next.viewport,state.viewport);assert.equal(next.automaticConnections[0].toRootId,C);
 assert.deepEqual(validateProgress(next,db,C),next);
});
test('a fresh direct link starts at that course and an explicit link can add to a saved empty board',()=>{
 assert.deepEqual(validateProgress(null,db,C).addedCourseIds,[C]);
 const empty={...defaultProgress(db),addedCourseIds:[],expandedForward:[],autoExpandedCourseIds:[]};assert.deepEqual(validateProgress(empty,db,C).addedCourseIds,[C]);
});
