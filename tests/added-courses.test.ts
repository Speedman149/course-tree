import test from 'node:test';
import assert from 'node:assert/strict';
import type {Course} from '../src/types';
import {buildCourseIndex,buildDependents,buildGraph,graphRoots,forwardConnectionId} from '../src/lib/graph';
import {initialExploration,explorationReducer,type ExplorationState} from '../src/lib/exploration';
import {defaultProgress,validateProgress,encodeProgress,decodeProgress,PROGRESS_VERSION,type ProgressDatabase} from '../src/lib/progress';
const records:Course[]=Array.from({length:505},(_,i)=>({id:String(10000000+i),name:'course '+i,faculty:'הפקולטה למדעי המחשב',requirements:i?{type:'course',courseId:String(10000000+i-1),relation:'strong'}:null,requirementsStatus:i?'known':'none',source:{url:'https://portalex.technion.ac.il/'}}));
const courses=buildCourseIndex(records),deps=buildDependents(records),id=(i:number)=>records[i].id;
const graph=(s:ExplorationState,visible=(id:string)=>true)=>buildGraph(graphRoots(s.primaryCourseId,s.addedCourseIds),courses,deps,s.expandedForward,s.expandedBackward,visible,s.hiddenForwardConnections,s.automaticConnections,s.revealedForwardConnections,new Set(s.addedCourseIds));
const context=(s:ExplorationState,visible=(id:string)=>true)=>({courses,dependents:deps,visibleCourseIds:new Set(graph(s,visible).nodes.map(n=>n.id)),isVisible:visible});
const add=(s:ExplorationState,i:number)=>explorationReducer(s,{type:'addCourse',courseId:id(i),context:context(s)});
const remove=(s:ExplorationState,i:number)=>explorationReducer(s,{type:'removeCourse',courseId:id(i),context:context(s)});
const db:ProgressDatabase={courses,facultyIds:new Set(['cs']),programs:[],years:['2025-2026'],defaultYear:'2025-2026',defaultRoot:id(0)};
const snapshot=(s:ExplorationState)=>({...defaultProgress(db),primaryCourseId:s.primaryCourseId,addedCourseIds:s.addedCourseIds,expandedForward:[...s.expandedForward],autoExpandedCourseIds:[...s.autoExpandedCourseIds],revealedForwardConnections:[...s.revealedForwardConnections],expandedBackward:[...s.expandedBackward].map(([a,b])=>[a,[...b]] as [string,string[]]),hiddenForwardConnections:[...s.hiddenForwardConnections],automaticConnections:s.automaticConnections});

test('fresh exploration is independent of the explicit additions collection',()=>{
 const s=initialExploration(id(0));assert.deepEqual(s.addedCourseIds,[]);
 assert.equal(graph(s).nodes.find(n=>n.id===id(0))!.added,false);
 const a=add(s,1);assert.deepEqual(a.addedCourseIds,[id(1)]);
 assert.equal(graph(a).nodes.filter(n=>n.id===id(1)).length,1);
 assert.equal(graph(a).nodes.find(n=>n.id===id(1))!.added,true);
 assert.deepEqual(add(a,1).addedCourseIds,[id(1)]);
});

test('500 additions and more than 48 owned paths persist without a selection cap or duplicate nodes',()=>{
 let s=initialExploration(id(0));for(let i=1;i<=500;i++)s=add(s,i);
 assert.equal(s.addedCourseIds.length,500);assert.ok(s.automaticConnections.length>48);
 const g=graph(s);assert.equal(g.nodes.length,501);assert.equal(g.edges.length,500);
 assert.equal(new Set(g.nodes.map(n=>n.id)).size,g.nodes.length);
 assert.equal(new Set(g.edges.map(e=>e.id)).size,g.edges.length);
 const saved=validateProgress(decodeProgress(encodeProgress(snapshot(s))),db);
 assert.equal(saved.addedCourseIds.length,500);assert.equal(saved.automaticConnections.length,s.automaticConnections.length);
 assert.equal(saved.primaryCourseId,id(0));
});

test('removing an intermediate addition preserves connector segments required by another addition',()=>{
 let s=add(add(initialExploration(id(0)),3),5);
 assert.equal(s.automaticConnections.length,2);s=remove(s,3);
 assert.deepEqual(s.addedCourseIds,[id(5)]);assert.equal(s.automaticConnections.length,2);
 const g=graph(s);for(let i=0;i<=5;i++)assert.ok(g.nodes.some(n=>n.id===id(i)));
 assert.equal(g.nodes.find(n=>n.id===id(3))!.added,false);
 s=remove(s,5);assert.equal(s.automaticConnections.length,0);
 assert.deepEqual(graph(s).nodes.map(n=>n.id),[id(0),id(1)]);
});

test('removing all additions retains manual exploration, primary course and saved markings',()=>{
 let s=add(initialExploration(id(0)),3);s=explorationReducer(s,{type:'toggleForward',courseId:id(1),active:false,children:deps.get(id(1))!});
 s=remove(s,3);assert.deepEqual(s.addedCourseIds,[]);assert.equal(s.primaryCourseId,id(0));
 assert.ok(graph(s).nodes.some(n=>n.id===id(2)));
 const saved=validateProgress({...snapshot(s),markedCourseIds:[id(4)],facultyIds:['cs']},db,id(0));
 assert.deepEqual(saved.addedCourseIds,[]);assert.deepEqual(saved.markedCourseIds,[id(4)]);assert.deepEqual(saved.facultyIds,['cs']);
});

test('locating a collapsed addition explicitly restores its path without changing unrelated hides',()=>{
 let s=add(initialExploration(id(0)),4);const hidden=forwardConnectionId(id(2),id(3),'strong');
 s=explorationReducer(s,{type:'hideConnection',connectionId:hidden});s.hiddenForwardConnections.add(forwardConnectionId(id(6),id(7),'strong'));
 assert.equal(graph(s).nodes.some(n=>n.id===id(3)),false);
 s=explorationReducer(s,{type:'locateAdded',courseId:id(4),context:context(s)});
 assert.equal(s.hiddenForwardConnections.has(hidden),false);assert.ok(s.hiddenForwardConnections.has(forwardConnectionId(id(6),id(7),'strong')));
 assert.ok(graph(s).nodes.some(n=>n.id===id(3)));assert.deepEqual(s.addedCourseIds,[id(4)]);
});

test('locating an added course never disables a filter excluding an intermediate course',()=>{
 let s=add(initialExploration(id(0)),4);const visible=(courseId:string)=>courseId!==id(2);
 s=explorationReducer(s,{type:'locateAdded',courseId:id(4),context:context(s,visible)});
 assert.equal(graph(s,visible).nodes.some(n=>n.id===id(2)),false);assert.match(s.treeMessage,/סינון|מסננ/);
});

test('legacy pin versions 3 and 4 migrate idempotently without resurrecting removed additions',()=>{
 for(const version of [3,4]){
  const legacy={pinnedRootIds:[id(0),id(3)],expandedForward:[id(0)],expandedBackward:[],hiddenForwardConnections:[],automaticConnections:[],markedCourseIds:[id(2)],facultyIds:['cs']};
  const saved=validateProgress(decodeProgress(JSON.stringify({version,progress:legacy})),db);
  assert.equal(saved.primaryCourseId,id(0));assert.deepEqual(saved.addedCourseIds,[id(0),id(3)]);assert.deepEqual(saved.markedCourseIds,[id(2)]);
  assert.deepEqual(validateProgress(decodeProgress(encodeProgress(saved)),db),saved);
  const removed={...saved,addedCourseIds:[]};assert.deepEqual(validateProgress(decodeProgress(encodeProgress(removed)),db,id(0)).addedCourseIds,[]);
  assert.equal(JSON.parse(encodeProgress(saved)).version,PROGRESS_VERSION);assert.equal('pinnedRootIds' in JSON.parse(encodeProgress(saved)).progress,false);
 }
 const empty=validateProgress(decodeProgress(JSON.stringify({version:4,progress:{pinnedRootIds:[]}})),db);
 assert.equal(empty.primaryCourseId,'');assert.deepEqual(empty.addedCourseIds,[]);
});

test('valid source relationships are required before auxiliary connector roots can appear',()=>{
 const bad={fromRootId:'fake',toRootId:id(4),steps:[{source:'fake',target:id(4),relation:'strong' as const,direction:'forward' as const}]};
 assert.equal(buildGraph([id(4)],courses,deps,new Set(),new Map(),()=>true,new Set(),[bad]).nodes.length,1);
});


test('locating an existing addition preserves its original upstream connector and avoids ownership cycles',()=>{
 let s=add(add(initialExploration(id(0)),3),5);
 const before=structuredClone(s.automaticConnections);
 s=explorationReducer(s,{type:'locateAdded',courseId:id(3),context:context(s)});
 assert.deepEqual(s.automaticConnections,before);
 for(let i=0;i<=5;i++)assert.ok(graph(s).nodes.some(n=>n.id===id(i)));
 s=explorationReducer({...s,addedCourseIds:[id(0),...s.addedCourseIds]},{type:'locateAdded',courseId:id(0),context:context(s)});
 assert.deepEqual(s.automaticConnections,before);
});


test('a removed independent start stays only while another addition needs its source-supported path',()=>{
 const standalone='99999999';const byId=new Map(courses);byId.set(standalone,{...records[0],id:standalone});
 const visible=(s:ExplorationState,filter=(id:string)=>true)=>buildGraph(graphRoots(s.primaryCourseId,s.addedCourseIds),byId,deps,s.expandedForward,s.expandedBackward,filter,s.hiddenForwardConnections,s.automaticConnections,s.revealedForwardConnections,new Set(s.addedCourseIds));
 const ctx=(s:ExplorationState)=>({courses:byId,dependents:deps,visibleCourseIds:new Set(visible(s).nodes.map(n=>n.id)),isVisible:()=>true});
 let s=initialExploration(standalone);
 s=explorationReducer(s,{type:'addCourse',courseId:id(3),context:ctx(s)});
 s=explorationReducer(s,{type:'addCourse',courseId:id(5),context:ctx(s)});
 s=explorationReducer(s,{type:'removeCourse',courseId:id(3),context:ctx(s)});
 assert.ok(visible(s).nodes.some(n=>n.id===id(3)));assert.equal(visible(s).nodes.find(n=>n.id===id(3))!.added,false);
 assert.equal(visible(s,courseId=>courseId!==id(3)).nodes.some(n=>n.id===id(3)),false);
 const hidden=explorationReducer(s,{type:'hideConnection',connectionId:forwardConnectionId(id(3),id(4),'strong')});
 assert.equal(visible(hidden).nodes.some(n=>n.id===id(3)),false);
 s=explorationReducer(s,{type:'removeCourse',courseId:id(5),context:ctx(s)});
 assert.deepEqual(visible(s).nodes.map(n=>n.id),[standalone]);
});


test('removing an automatic independent start drops unrelated auto children but preserves explicit manual exploration',()=>{
 const b='99000001',c='99000002',d='99000003',y='99000004';const leaf=(courseId:string)=>({type:'course' as const,courseId,relation:'strong' as const});
 const extra=[{...records[0],id:b},{...records[0],id:c,requirements:leaf(b)},{...records[0],id:d,requirements:leaf(c)},{...records[0],id:y,requirements:leaf(b)}];
 const list=[records[0],...extra],index=buildCourseIndex(list),children=buildDependents(list);
 const visible=(s:ExplorationState)=>buildGraph(graphRoots(s.primaryCourseId,s.addedCourseIds),index,children,s.expandedForward,s.expandedBackward,()=>true,s.hiddenForwardConnections,s.automaticConnections,s.revealedForwardConnections,new Set(s.addedCourseIds),s.autoExpandedCourseIds);
 const ctx=(s:ExplorationState)=>({courses:index,dependents:children,visibleCourseIds:new Set(visible(s).nodes.map(n=>n.id)),isVisible:()=>true});
 let state=initialExploration(id(0));state=explorationReducer(state,{type:'addCourse',courseId:b,context:ctx(state)});state=explorationReducer(state,{type:'addCourse',courseId:d,context:ctx(state)});
 assert.ok(visible(state).nodes.some(n=>n.id===y));const manual=explorationReducer(state,{type:'expandVisible',courseIds:[b]});
 state=explorationReducer(state,{type:'removeCourse',courseId:b,context:ctx(state)});
 assert.ok(visible(state).nodes.some(n=>n.id===b));assert.equal(visible(state).nodes.some(n=>n.id===y),false);
 const kept=explorationReducer(manual,{type:'removeCourse',courseId:b,context:ctx(manual)});assert.ok(visible(kept).nodes.some(n=>n.id===y));
 const stored=validateProgress({...defaultProgress({...db,courses:index}),primaryCourseId:id(0),addedCourseIds:[b,d],expandedForward:[id(0),b],autoExpandedCourseIds:[b,'stale']},{...db,courses:index});
 assert.deepEqual(stored.autoExpandedCourseIds,[b]);
});


test('adding an already visible auto child owns its existing route without opening any extra connections',()=>{
 const b='98000001',c='98000002',y='98000003';const leaf=(courseId:string)=>({type:'course' as const,courseId,relation:'strong' as const});
 const list=[records[0],{...records[0],id:b},{...records[0],id:c,requirements:leaf(b)},{...records[0],id:y,requirements:leaf(b)}];
 const index=buildCourseIndex(list),children=buildDependents(list);
 const visible=(s:ExplorationState)=>buildGraph(graphRoots(s.primaryCourseId,s.addedCourseIds),index,children,s.expandedForward,s.expandedBackward,()=>true,s.hiddenForwardConnections,s.automaticConnections,s.revealedForwardConnections,new Set(s.addedCourseIds),s.autoExpandedCourseIds);
 const ctx=(s:ExplorationState)=>({courses:index,dependents:children,visibleCourseIds:new Set(visible(s).nodes.map(n=>n.id)),isVisible:()=>true});
 let s=initialExploration(id(0));s=explorationReducer(s,{type:'addCourse',courseId:b,context:ctx(s)});const before=visible(s);
 s=explorationReducer(s,{type:'addCourse',courseId:c,context:ctx(s)});assert.deepEqual(visible(s).nodes.map(n=>n.id),before.nodes.map(n=>n.id));assert.deepEqual(visible(s).edges.map(e=>e.id),before.edges.map(e=>e.id));
 s=explorationReducer(s,{type:'removeCourse',courseId:b,context:ctx(s)});assert.ok(visible(s).nodes.some(n=>n.id===b));assert.equal(visible(s).nodes.some(n=>n.id===y),false);assert.ok(visible(s).edges.some(e=>e.source===b&&e.target===c));
});
