import test from 'node:test';
import assert from 'node:assert/strict';
import type {Course,Requirement} from '../src/types';
import {buildCourseIndex,buildDependents,buildGraph,forwardConnectionId,instanceId,restoreDirectConnections} from '../src/lib/graph';
const leaf=(courseId:string,relation:'strong'|'concurrent'='strong'):Requirement=>({type:'course',courseId,relation});
const course=(id:string,requirements:Requirement|null=null):Course=>({id,name:id,faculty:'הפקולטה למדעי המחשב',requirements,requirementsStatus:requirements?'known':'none',source:{url:'https://example.test'}});
const b=forwardConnectionId('root','B','strong'),c=forwardConnectionId('root','C','strong');
const courses=[course('A'),course('B',leaf('A')),course('C',leaf('A')),course('D',leaf('B')),course('E',leaf('B')),course('F',leaf('C'))];
const index=buildCourseIndex(courses),dependents=buildDependents(courses);
const expanded=new Set(['root',b,c]);
const graph=(hidden:ReadonlySet<string>=new Set(),open:ReadonlySet<string>=expanded,visible:(id:string)=>boolean=()=>true)=>buildGraph('A',index,dependents,open,new Map(),visible,hidden);

test('connection IDs are stable source-path/course/relation identifiers',()=>{
 assert.equal(b,instanceId('root','forward','B','strong'));
 assert.notEqual(forwardConnectionId(b,'D','strong'),forwardConnectionId(c,'D','strong'));
 assert.notEqual(forwardConnectionId('root','B','strong'),forwardConnectionId('root','B','concurrent'));
});
test('hiding A to B removes only its reachable subtree and keeps C and F expanded',()=>{
 const before=[...expanded];const result=graph(new Set([b]));
 assert.deepEqual(result.nodes.map(n=>n.courseId),['A','C','F']);assert.deepEqual([...expanded],before);
 assert.ok(result.edges.every(e=>!e.source.startsWith(b)&&!e.target.startsWith(b)));
 const restored=graph();assert.deepEqual(restored.nodes.map(n=>n.courseId),['A','B','C','D','E','F']);
});
test('original course-level minus still collapses every direct child without deleting expansion memory',()=>{
 const open=new Set(expanded);open.delete('root');assert.deepEqual(graph(new Set([b]),open).nodes.map(n=>n.courseId),['A']);
 open.add('root');const restored=graph(restoreDirectConnections(new Set([b]),'root'),open);assert.equal(restored.nodes.length,6);
});
test('shared children and deeper descendants survive through an unaffected parent path',()=>{
 const shared=[course('A'),course('B',leaf('A')),course('C',leaf('A')),course('D',{type:'and',items:[leaf('B'),leaf('C')]}),course('E',leaf('D'))];
 const db=forwardConnectionId(b,'D','strong'),dc=forwardConnectionId(c,'D','strong');
 const open=new Set(['root',b,c,db,dc]);const run=(hidden:Set<string>)=>buildGraph('A',buildCourseIndex(shared),buildDependents(shared),open,new Map(),()=>true,hidden);
 const one=run(new Set([db]));assert.ok(!one.nodes.some(n=>n.id===db));assert.ok(one.nodes.some(n=>n.id===dc));assert.ok(one.nodes.some(n=>n.id===forwardConnectionId(dc,'E','strong')));
 assert.equal(one.nodes.filter(n=>n.courseId==='D').length,1);assert.equal(one.nodes.filter(n=>n.courseId==='E').length,1);
 const neither=run(new Set([db,dc]));assert.ok(!neither.nodes.some(n=>['D','E'].includes(n.courseId)));
 const restored=run(new Set([dc]));assert.ok(restored.nodes.some(n=>n.id===db));assert.ok(restored.nodes.some(n=>n.id===forwardConnectionId(db,'E','strong')));assert.ok(!restored.nodes.some(n=>n.id===dc));
});
test('restoring direct children does not erase individually hidden deeper connections',()=>{
 const bd=forwardConnectionId(b,'D','strong');const ce=forwardConnectionId(c,'E','strong');
 assert.deepEqual([...restoreDirectConnections(new Set([b,c,bd,ce]),'root')],[bd,ce]);
 assert.deepEqual([...restoreDirectConnections(new Set([b,c,bd,ce]),b)],[b,c,ce]);
});
test('faculty/catalog forward visibility and personal connection hiding remain independent',()=>{
 const hidden=new Set([forwardConnectionId(b,'D','strong')]);
 assert.deepEqual(graph(hidden,expanded,id=>id!=='C').nodes.map(n=>n.courseId),['A','B','E']);
 assert.deepEqual(graph(hidden).nodes.map(n=>n.courseId),['A','B','C','E','F']);assert.equal(hidden.size,1);
});
test('connection hiding never suppresses a selected backward prerequisite',()=>{
 const cyclic=[course('A',leaf('B')),course('B',leaf('A'))];const backward=new Map([['root',new Set(['B'])]]);
 const result=buildGraph('A',buildCourseIndex(cyclic),buildDependents(cyclic),new Set(['root']),backward,()=>false,new Set([b]));
 assert.deepEqual(result.nodes.map(n=>n.id),['root',instanceId('root','backward','B','strong')]);assert.equal(result.edges[0].direction,'backward');
});
test('same-course strong and concurrent connections can be hidden independently',()=>{
 const data=[course('A'),course('B',{type:'or',items:[leaf('A'),leaf('A','concurrent')]})];
 const result=buildGraph('A',buildCourseIndex(data),buildDependents(data),new Set(['root']),new Map(),()=>true,new Set([b]));
 assert.equal(result.nodes.length,2);assert.equal(result.nodes[1].relation,'concurrent');assert.equal(result.edges[0].relation,'concurrent');
});
test('repeated hiding/restoring keeps only root-reachable nodes and valid edges',()=>{
 const original=JSON.stringify(courses);for(let i=0;i<12;i++){
  const result=graph(i%2?new Set():new Set([b]));const ids=new Set(result.nodes.map(n=>n.id));
  assert.equal(result.nodes.length,i%2?6:3);assert.ok(result.edges.every(e=>ids.has(e.source)&&ids.has(e.target)));
  const reached=new Set(['root']);for(const e of result.edges)if(reached.has(e.source))reached.add(e.target);assert.equal(reached.size,result.nodes.length);
 }assert.equal(JSON.stringify(courses),original);
});
test('invalid obsolete connection IDs cannot remove unrelated nodes',()=>{
 assert.deepEqual(graph(new Set(['junk','root','root/f:obsolete:strong'])),graph());
});