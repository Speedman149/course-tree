import {useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,GitBranch,MousePointer2,X} from 'lucide-react';
import type {Course} from '../types';
import {tutorialSteps} from './tutorial/content';
import {tutorialExamples} from './tutorial/examples';
import {AddedCoursesStep,BranchesStep,CardStep,FiltersStep,MarkedCoursesStep,PrerequisitesStep,ToolbarStep} from './tutorial/Steps';
const steps=[CardStep,BranchesStep,PrerequisitesStep,AddedCoursesStep,ToolbarStep,FiltersStep,MarkedCoursesStep];
/** An isolated walkthrough: the only application action it receives is closing the dialog. */
export default function HelpGuide({courses,onClose}:{courses:ReadonlyMap<string,Course>;onClose:()=>void}){
 const [current,setCurrent]=useState(0),body=useRef<HTMLDivElement>(null),heading=useRef<HTMLHeadingElement>(null),previous=useRef<number|null>(null);
 const examples=useMemo(()=>{const index=new Map(tutorialExamples.map(c=>[c.id,c as Course]));courses.forEach((c,id)=>index.set(id,c));return index;},[courses]);
 const step=tutorialSteps[current],Visual=steps[current];
 useLayoutEffect(()=>{
  body.current?.scrollTo(0,0);const changed=previous.current!==null;previous.current=current;
  if(changed){const frame=requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));return()=>cancelAnimationFrame(frame);}
 },[current]);
 return <div className="tutorial-guide" dir="rtl">
  <header className="tutorial-header"><span className="tutorial-brand-icon"><GitBranch size={22}/></span><div><span className="tutorial-eyebrow">סיור קצר במפה</span><h2 id="modal-title">איך משתמשים במפת הקורסים?</h2></div><button className="modal-close tutorial-close" type="button" aria-label="סגירה" onClick={onClose}><X size={20}/></button></header>
  <div className="tutorial-progress"><nav aria-label="שלבי המדריך">{tutorialSteps.map((s,i)=><button type="button" key={s.id} aria-label={`שלב ${i+1}: ${s.title}`} aria-current={i===current?'step':undefined} title={s.title} onClick={()=>setCurrent(i)}><span/></button>)}</nav><span className="tutorial-page-count">{current+1} מתוך {steps.length}</span><span className="tutorial-practice-tag"><MousePointer2 size={12}/>אפשר להתנסות כאן</span></div>
  <div className="tutorial-body" ref={body} data-tutorial-step={step.id}>
   <div className="tutorial-step-heading"><span aria-hidden="true">{String(current+1).padStart(2,'0')}</span><div><h3 ref={heading} tabIndex={-1}>{step.title}</h3><p>{step.subtitle}</p></div></div>
   <Visual key={step.id} courses={examples}/>
   <p className="tutorial-takeaway"><Check size={15}/>{step.takeaway}</p>
  </div>
  <footer className="tutorial-footer"><button type="button" className="tutorial-previous" disabled={current===0} onClick={()=>setCurrent(i=>i-1)}><ArrowRight size={15}/>הקודם</button><small>התרגול כאן לא משנה את המפה שלכם.</small><button type="button" className="tutorial-next" onClick={()=>current===steps.length-1?onClose():setCurrent(i=>i+1)}>{current===steps.length-1?'הבנתי, בואו נתחיל!':'הבא'}{current===steps.length-1?<Check size={15}/>:<ArrowLeft size={15}/>}</button></footer>
 </div>;
}
