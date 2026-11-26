import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {tutorialSteps} from '../src/components/tutorial/content';
import {tutorialExamples} from '../src/components/tutorial/examples';
import {AddedCoursesStep,BranchesStep,CardStep,FiltersStep,MarkedCoursesStep,PrerequisitesStep,ToolbarStep} from '../src/components/tutorial/Steps';
import type {Course} from '../src/types';
const data=JSON.parse(readFileSync(new URL('../public/data/courses.json',import.meta.url),'utf8')).courses as Course[];
test('seven concise tutorial steps cover current controls without obsolete concepts',()=>{
 assert.equal(tutorialSteps.length,7);assert.equal(new Set(tutorialSteps.map(s=>s.id)).size,7);
 for(const step of tutorialSteps){assert.ok(step.title.length<55);assert.ok(step.notes.length>=3&&step.notes.length<=7);assert.equal(new Set(step.notes.map(n=>n.id)).size,step.notes.length);for(const n of step.notes)assert.ok(n.description.length<130);}
 assert.doesNotMatch(JSON.stringify(tutorialSteps),/React Flow|pinned|שורש ראשי|קורסים נעוצים/);
});
test('loading-only illustration examples exactly match current course names, IDs, credits, faculty and prerequisite expressions',()=>{
 for(const example of tutorialExamples){const current=data.find(c=>c.id===example.id);assert.ok(current,example.id);for(const field of ['id','name','faculty','credits','requirements','requirementsStatus'] as const)assert.deepEqual(example[field],current[field],example.id+' '+field);assert.equal(example.source.url,current.source.url);}
});
test('all seven presentation steps render without mutating their shared read-only course records',()=>{
 const courses=new Map(tutorialExamples.map(c=>[c.id,structuredClone(c) as Course]));const before=JSON.stringify([...courses]);
 for(const Step of [CardStep,BranchesStep,PrerequisitesStep,AddedCoursesStep,ToolbarStep,FiltersStep,MarkedCoursesStep])assert.match(renderToStaticMarkup(createElement(Step,{courses})),/tutorial-/);
 assert.equal(JSON.stringify([...courses]),before);
 const rules=renderToStaticMarkup(createElement(PrerequisitesStep,{courses}));assert.match(rules,/וגם/);assert.match(rules,/או/);assert.match(rules,/expression-group/);
});
