import test from 'node:test';
import assert from 'node:assert/strict';
import type {Course, DegreeCatalog, Requirement} from '../src/types';
import {buildCourseIndex, buildDependents, buildGraph, forwardConnectionId, forwardExpansionState} from '../src/lib/graph';
import {initialExploration, explorationReducer, type ExplorationState} from '../src/lib/exploration';
import {createCourseVisibility} from '../src/lib/filters';
import {defaultProgress, validateProgress, decodeProgress, encodeProgress, PROGRESS_VERSION, type ProgressDatabase} from '../src/lib/progress';

const A='00000001', B='00000002', C='00000003', D='00000004', E='00000005', F='00000006', G='00000007', H='00000008', X='00000009';
const leaf=(courseId:string):Requirement=>({type:'course',courseId,relation:'strong'});
const course=(id:string,requirements:Requirement|null=null,faculty='הפקולטה למדעי המחשב'):Course=>({id,name:id,faculty,requirements,requirementsStatus:requirements?'known':'none',source:{url:'https://portalex.technion.ac.il/'}});
const records=[course(A),course(B,leaf(A)),course(C,leaf(B)),course(D,leaf(C)),course(E,{type:'or',items:[leaf(B),leaf(X)]}),course(F,leaf(B),'הפקולטה למתמטיקה'),course(G,leaf(B)),course(H,leaf(E)),course(X)];
const courses=buildCourseIndex(records), dependents=buildDependents(records);
const edge=(source:string,target:string)=>forwardConnectionId(source,target,'strong');
const all=()=>true;
const graph=(state:ExplorationState,visible=all)=>buildGraph([state.primaryCourseId,...state.addedCourseIds].filter(Boolean),courses,dependents,state.expandedForward,state.expandedBackward,visible,state.hiddenForwardConnections,state.automaticConnections,state.revealedForwardConnections);
const expansion=(state:ExplorationState,visible=all)=>forwardExpansionState(B,dependents,new Set(graph(state,visible).edges.filter(e=>e.directions.includes('forward')).map(e=>forwardConnectionId(e.source,e.target,e.relation))),visible);
const pin=(state:ExplorationState,id:string)=>explorationReducer(state,{type:'toggleAdded',courseId:id,context:{courses,dependents,visibleCourseIds:new Set(graph(state).nodes.map(n=>n.id)),isVisible:all}});
const initial=()=>pin(initialExploration(A),D);
const reveal=(state:ExplorationState,id:string)=>explorationReducer(state,{type:'restoreConnection',connectionId:edge(B,id)});
const revealAll=(state:ExplorationState,visible=all)=>explorationReducer(state,{type:'revealConnections',connectionIds:expansion(state,visible).remaining.map(c=>forwardConnectionId(B,c.courseId,c.relation))});
const ids=(state:ExplorationState,visible=all)=>new Set(graph(state,visible).nodes.map(n=>n.id));
const program:DegreeCatalog={id:'partial-program',programId:'partial',officialName:'מסלול בדיקה',facultyIds:['cs'],degreeType:'B.Sc.',catalogYear:'2025-2026',mandatoryCourseIds:[A,B,C,D,E,F,H,X],additionalEligibleCourseIds:[],electiveGroups:[],sourceRefs:[],coverage:{status:'verified-listed',notes:[]}};
const db:ProgressDatabase={courses,facultyIds:new Set(['cs','math']),programs:[program],years:['2025-2026'],defaultYear:'2025-2026',defaultRoot:A};

test('automatic connector is partial and counts unopened connections rather than absent cards',()=>{
 const state=initial();
 assert.equal(state.expandedForward.has(B),false);
 assert.equal(expansion(state).status,'partial');
 assert.deepEqual(expansion(state).remaining.map(c=>c.courseId),[E,F,G]);
 assert.equal(state.hiddenForwardConnections.size,0);
 const shared=pin(state,X);
 assert.ok(ids(shared).has(E));
 assert.ok(expansion(shared).remaining.some(c=>c.courseId===E));
});

test('revealing one extra connection leaves siblings unopened and does not recursively expand',()=>{
 const state=reveal(initial(),E);
 assert.deepEqual(ids(state),new Set([A,B,C,D,E]));
 assert.deepEqual(expansion(state).remaining.map(c=>c.courseId),[F,G]);
 assert.equal(state.expandedForward.has(B),false);
 assert.deepEqual([...state.revealedForwardConnections],[edge(B,E)]);
 assert.equal(state.hiddenForwardConnections.size,0);
 assert.equal(ids(state).has(H),false);
});

test('manual reveals survive automatic pin ownership removal where still reachable',()=>{
 let state=reveal(initial(),E);
 state=pin(state,D);
 assert.ok(ids(state).has(E));
 assert.equal(ids(state).has(C),false);
 assert.equal(ids(state).has(D),false);
 assert.equal(expansion(state).status,'partial');
});

test('show-all opens only direct connections and a minus/plus cycle retains its original behavior',()=>{
 let state=revealAll(reveal(initial(),E));
 assert.equal(expansion(state).status,'expanded');
 for(const id of [C,D,E,F,G])assert.ok(ids(state).has(id));
 assert.equal(ids(state).has(H),false);
 state=explorationReducer(state,{type:'toggleForward',courseId:B,active:true,children:dependents.get(B)!});
 assert.equal(expansion(state).status,'collapsed');
 assert.equal(state.revealedForwardConnections.size,0);
 assert.deepEqual(ids(state),new Set([A,B,D]));
 state=explorationReducer(state,{type:'toggleForward',courseId:B,active:false,children:dependents.get(B)!});
 assert.equal(expansion(state).status,'expanded');
 assert.ok(state.expandedForward.has(B));
 assert.equal(ids(state).has(H),false);
});

test('intentional hides remain distinct from unopened siblings and restore exactly one connection',()=>{
 let state=reveal(initial(),E);
 state=explorationReducer(state,{type:'hideConnection',connectionId:edge(B,E)});
 assert.ok(state.hiddenForwardConnections.has(edge(B,E)));
 assert.equal(state.hiddenForwardConnections.has(edge(B,F)),false);
 const again=pin(pin(state,D),D);
 assert.equal(ids(again).has(E),false);
 state=reveal(again,E);
 assert.equal(state.hiddenForwardConnections.has(edge(B,E)),false);
 assert.ok(ids(state).has(E));
 assert.equal(ids(state).has(F),false);
 assert.equal(ids(state).has(G),false);
});

test('shared children and pre-expanded descendants are reused when adding a new connection',()=>{
 let state=pin(initial(),X);
 state=explorationReducer(state,{type:'toggleForward',courseId:E,active:false,children:dependents.get(E)!});
 const before=graph(state);
 state=reveal(state,E);
 const after=graph(state);
 assert.deepEqual(new Set(after.nodes.map(n=>n.id)),new Set(before.nodes.map(n=>n.id)));
 assert.equal(after.nodes.filter(n=>n.id===E).length,1);
 assert.ok(ids(state).has(H));
 assert.equal(after.edges.filter(e=>e.source===B&&e.target===E).length,1);
 assert.equal(after.edges.filter(e=>e.source===X&&e.target===E).length,1);
 state=explorationReducer(state,{type:'toggleBackward',parentId:E,courseId:B,active:false});
 assert.equal(graph(state).edges.filter(e=>e.source===B&&e.target===E).length,1);
});

test('faculty and catalog intersections govern counters, reveals, and latent filtered selections',()=>{
 const csOnly=createCourseVisibility(records,new Set(['cs']),program);
 let state=initial();
 assert.deepEqual(expansion(state,csOnly).remaining.map(c=>c.courseId),[E]);
 state=revealAll(state,csOnly);
 assert.equal(expansion(state,csOnly).status,'expanded');
 assert.equal(ids(state,csOnly).has(F),false);
 assert.equal(ids(state,csOnly).has(G),false);
 assert.equal(state.revealedForwardConnections.has(edge(B,F)),false);
 const both=createCourseVisibility(records,new Set(['cs','math']),program);
 assert.deepEqual(expansion(state,both).remaining.map(c=>c.courseId),[F]);
 assert.equal(ids(state,both).has(F),false);
 state=reveal(state,F);
 assert.ok(ids(state,both).has(F));
 assert.equal(ids(state,csOnly).has(F),false);
 assert.ok(state.revealedForwardConnections.has(edge(B,F)));
 assert.deepEqual(expansion(state,all).remaining.map(c=>c.courseId),[G]);
});

test('parallel strong/concurrent connections have separate counts and share their course node',()=>{
 const mixed=[course(A),course(B,{type:'and',items:[leaf(A),{type:'course',courseId:A,relation:'concurrent'}]})];
 const deps=buildDependents(mixed),index=buildCourseIndex(mixed),strong=edge(A,B);
 const before=buildGraph([A],index,deps,new Set(),new Map(),all,new Set(),[],new Set([strong]));
 const status=forwardExpansionState(A,deps,new Set(before.edges.map(e=>forwardConnectionId(e.source,e.target,e.relation))),all);
 assert.equal(status.status,'partial');assert.equal(status.remaining.length,1);
 assert.equal(status.remaining[0].relation,'concurrent');
 const after=buildGraph([A],index,deps,new Set(),new Map(),all,new Set(),[],new Set([strong,forwardConnectionId(A,B,'concurrent')]));
 assert.equal(after.nodes.length,2);assert.equal(after.edges.length,2);
});

test('schema6 preserves partial intent, validates real keys, and clears it for a different root',()=>{
 let state=reveal(initial(),E);
 state=explorationReducer(state,{type:'hideConnection',connectionId:edge(B,C)});
 const snapshot={...defaultProgress(db),addedCourseIds:state.addedCourseIds,expandedForward:[...state.expandedForward],revealedForwardConnections:[...state.revealedForwardConnections],hiddenForwardConnections:[...state.hiddenForwardConnections],automaticConnections:state.automaticConnections,markedCourseIds:[E],catalogId:program.id,facultyIds:['cs']};
 const valid=validateProgress(decodeProgress(encodeProgress(snapshot)),db);
 assert.deepEqual(valid,snapshot);assert.equal(PROGRESS_VERSION,6);
 const restored=explorationReducer(initialExploration(A),{type:'restore',saved:valid});
 assert.deepEqual(graph(restored),graph(state));
 const cleaned=validateProgress({...snapshot,revealedForwardConnections:[edge(B,E),edge(B,E),'junk',edge(A,D),'__proto__->constructor:strong']},db);
 assert.deepEqual(cleaned.revealedForwardConnections,[edge(B,E)]);
 assert.deepEqual(validateProgress(snapshot,db,X).revealedForwardConnections,[]);
 assert.equal(explorationReducer(state,{type:'resetBranches'}).revealedForwardConnections.size,0);
 assert.equal(explorationReducer(state,{type:'selectRoot',courseId:X}).revealedForwardConnections.size,0);
});

test('existing schema3 sessions migrate with automatic paths and preferences intact',()=>{
 const state=initial();
 const snapshot={...defaultProgress(db),addedCourseIds:state.addedCourseIds,automaticConnections:state.automaticConnections,markedCourseIds:[E],facultyIds:['cs'],catalogId:program.id,hiddenForwardConnections:[edge(B,F)]};
 const {revealedForwardConnections:_,...old}=snapshot;
 const valid=validateProgress(decodeProgress(JSON.stringify({version:3,progress:old})),db);
 assert.deepEqual(valid,{...old,revealedForwardConnections:[]});
 const restored=explorationReducer(initialExploration(A),{type:'restore',saved:valid});
 assert.equal(expansion(restored).status,'partial');
 assert.equal(restored.hiddenForwardConnections.has(edge(B,F)),true);
});


test('show-all preserves automatic ownership of connections that were already active',()=>{
 let state=revealAll(initial());
 assert.equal(state.revealedForwardConnections.has(edge(B,C)),false);
 assert.equal(expansion(state).status,'expanded');
 state=pin(state,D);
 assert.equal(ids(state).has(C),false);
 assert.equal(ids(state).has(D),false);
 for(const id of [E,F,G])assert.ok(ids(state).has(id));
});
