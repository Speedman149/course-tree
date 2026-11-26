import {useId,useLayoutEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {ArrowUpLeft,BookOpen,Check,Info,Minus,Plus} from 'lucide-react';
import type {Course} from '../../types';
import {courseAppearance} from '../../lib/faculty-colors';
import {officialSourceURL} from '../../lib/urls';
import type {TutorialAnnotation} from './content';

/** Measures actual HTML targets, so leaders stay attached at every viewport/font size. */
export function AnnotatedDemo({notes,active,onSelect,children,wide=false}:{notes:TutorialAnnotation[];active:string;onSelect:(id:string)=>void;children:ReactNode;wide?:boolean}){
 const host=useRef<HTMLDivElement>(null),label=useRef<HTMLDivElement>(null),[path,setPath]=useState('');
 const marker=useId().replace(/:/g,''),note=notes.find(n=>n.id===active)??notes[0];
 useLayoutEffect(()=>{
  const element=host.current;if(!element)return;
  let frame=0;
  const measure=()=>{
   const target=element.querySelector<HTMLElement>(`[data-tutorial-target="${note.id}"]`),caption=label.current;
   element.querySelectorAll('[data-tutorial-active]').forEach(e=>e.removeAttribute('data-tutorial-active'));
   if(!target||!caption||!target.getClientRects().length){setPath('');return;}
   target.dataset.tutorialActive='true';
   const h=element.getBoundingClientRect(),t=target.getBoundingClientRect(),c=caption.getBoundingClientRect();
   const compact=window.matchMedia('(max-width:700px)').matches||wide;
   const regionElement=target.closest('[data-tutorial-region]'),region=regionElement?.getBoundingClientRect()??t;
   const card=target.closest('.tutorial-course-card')?.getBoundingClientRect();
   if(card&&(note.id==='number'||note.id==='mark')){
    // Reach the crowded top/bottom controls from outside the card, not across a neighbor.
    const top=note.id==='number',rail=card.left-h.left-12,ey=(top?t.top-5:t.bottom+5)-h.top;
    const sy=compact?c.bottom-h.top+5:c.top-h.top+c.height/2,sx=compact?c.left-h.left+8:c.right-h.left+5;
    const lane=(top?card.top-14:card.bottom+14)-h.top,ex=t.left-h.left+t.width/2;
    setPath(`M${sx},${sy} C${rail},${sy} ${rail},${lane} ${rail},${lane} L${ex},${lane} L${ex},${ey}`);
   }else if(compact){
    const sy=c.bottom-h.top+5;
    const illustration=element.querySelector('.tutorial-illustration')!.getBoundingClientRect();
    const top=note.id==='backward'||((target===regionElement||t.top<region.top+22)&&region.top<illustration.top+45);
    if(top){
     const ex=t.left-h.left+t.width/2,ey=t.top-h.top-5,sx=Math.max(c.left-h.left+8,Math.min(ex,c.right-h.left-8));
     setPath(`M${sx},${sy} C${sx},${(sy+ey)/2} ${ex},${(sy+ey)/2} ${ex},${ey}`);
    }else{
     const left=t.left+t.width/2<region.left+region.width/2;
     const rail=Math.max(5,Math.min((left?region.left-10:region.right+10)-h.left,h.width-5));
     const sx=Math.max(c.left-h.left+8,Math.min(rail,c.right-h.left-8)),ex=(left?t.left-5:t.right+5)-h.left,ey=t.top-h.top+t.height/2;
     setPath(`M${sx},${sy} Q${rail},${sy} ${rail},${sy+16} L${rail},${ey-12} Q${rail},${ey} ${rail+(left?12:-12)},${ey} L${ex},${ey}`);
    }
   }else{
    const left=note.side==='left',sx=(left?c.right+5:c.left-5)-h.left,sy=c.top-h.top+c.height/2;
    const ex=(left?t.left-5:t.right+5)-h.left,ey=t.top-h.top+t.height/2,mx=(sx+ex)/2;
    setPath(`M${sx},${sy} C${mx},${sy} ${mx},${ey} ${ex},${ey}`);
   }
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
  const resize=new ResizeObserver(schedule);resize.observe(element);element.querySelectorAll('[data-tutorial-target]').forEach(e=>resize.observe(e));
  const mutation=new MutationObserver(schedule);mutation.observe(element,{childList:true,subtree:true});
  window.addEventListener('resize',schedule);schedule();
  return()=>{cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect();window.removeEventListener('resize',schedule);};
 },[note.id,note.side,wide]);
 return <div className="tutorial-demo-shell">
  <div ref={host} className={`tutorial-annotated${wide?' tutorial-wide':''}`}>
   <div ref={label} className={`tutorial-callout ${note.side==='left'?'on-left':'on-right'}`} role="note"><span className="tutorial-callout-kicker">{note.label}</span><strong>{note.description}</strong></div>
   <div className="tutorial-illustration">{children}</div>
   <svg className="tutorial-leader" aria-hidden="true"><defs><marker id={'leader-'+marker} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="none" stroke="currentColor" strokeWidth="1.5"/></marker></defs>{path&&<path d={path} markerEnd={`url(#leader-${marker})`}/>}</svg>
  </div>
  <div className="tutorial-topics" aria-label="פרטים בהמחשה">{notes.map(n=><button key={n.id} type="button" aria-pressed={n.id===active} onClick={()=>{onSelect(n.id);host.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});}}>{n.label}</button>)}</div>
 </div>;
}
export function DemoCourseCard({course,marked=false,expanded=false,onMark,onExpand,onInfo,added=true,dependentCount}:{course:Course;marked?:boolean;expanded?:boolean;onMark?:()=>void;onExpand?:()=>void;onInfo?:()=>void;added?:boolean;dependentCount?:number}){
 const appearance=courseAppearance(course);
 return <article data-tutorial-region className={`tutorial-course-card${marked?' is-marked':''}`} style={{'--demo-faculty':appearance.accent} as CSSProperties} aria-label={`כרטיס הדגמה: ${course.name}`}>
  <div className="tutorial-card-top"><span className="tutorial-book"><BookOpen size={19}/></span><a data-tutorial-target="number" className="tutorial-course-number" href={officialSourceURL(course.source.url)} target="_blank" rel="noopener noreferrer" dir="ltr">{course.id}<ArrowUpLeft size={12}/></a>{added&&<span className="tutorial-added"><Check size={11}/>נוסף לעץ</span>}</div>
  <h4 data-tutorial-target="name">{course.name}</h4>
  <div className="tutorial-card-meta"><span data-tutorial-target="faculty"><i/>{appearance.label}</span><span data-tutorial-target="credits">{course.credits??'—'} נק׳</span></div>
  <div className="tutorial-card-bottom"><button type="button" data-tutorial-target="info" disabled={!onInfo} onClick={onInfo}><Info size={14}/>פרטי קדמים</button><div><button type="button" className="tutorial-mark" data-tutorial-target="mark" aria-label="סימון הקורס בהדגמה" aria-pressed={marked} onClick={onMark}><Check size={17}/></button><button type="button" data-tutorial-target="expand" className="tutorial-expand" aria-label={expanded?'סגירת קורסי המשך בהדגמה':'פתיחת קורסי המשך בהדגמה'} aria-expanded={expanded} disabled={!onExpand} onClick={onExpand}>{expanded?<Minus size={16}/>:<Plus size={16}/>}<span>{dependentCount??'?'}</span></button></div></div>
 </article>;
}
export interface MiniNode {id:string;name:string;className?:string;added?:boolean;backward?:boolean;accent?:string;expanded?:boolean;onExpand?:()=>void;onBackward?:()=>void;target?:string}
export interface MiniEdge {id:string;source:string;target:string;backward?:boolean;onHide?:()=>void;label?:string}
export function DemoGraph({nodes,edges,className='',children}:{nodes:MiniNode[];edges:MiniEdge[];className?:string;children?:ReactNode}){
 const host=useRef<HTMLDivElement>(null),marker=useId().replace(/:/g,''),[lines,setLines]=useState<{id:string;d:string;x:number;y:number}[]>([]);
 const topology=nodes.map(n=>n.id).join('|')+';'+edges.map(e=>e.id).join('|');
 useLayoutEffect(()=>{
  const element=host.current;if(!element)return;let frame=0;
  const measure=()=>{
   const box=element.getBoundingClientRect(),vertical=window.matchMedia('(max-width:700px)').matches&&!className.includes('horizontal');
   setLines(edges.flatMap(edge=>{
    const s=element.querySelector<HTMLElement>(`[data-demo-node="${edge.source}"]`)?.getBoundingClientRect(),t=element.querySelector<HTMLElement>(`[data-demo-node="${edge.target}"]`)?.getBoundingClientRect();if(!s||!t)return [];
    const x1=(vertical?s.left+s.width/2:s.left)-box.left,y1=(vertical?s.bottom:s.top+s.height/2)-box.top;
    // Separate incoming handles so each connection keeps its own usable minus button.
    const incoming=edges.filter(e=>e.target===edge.target),offset=(incoming.findIndex(e=>e.id===edge.id)-(incoming.length-1)/2)*34;
    const x2=(vertical?t.left+t.width/2+offset:t.right)-box.left,y2=(vertical?t.top:t.top+t.height/2+offset)-box.top;
    const d=vertical?`M${x1},${y1} C${x1},${(y1+y2)/2} ${x2},${(y1+y2)/2} ${x2},${y2}`:`M${x1},${y1} C${(x1+x2)/2},${y1} ${(x1+x2)/2},${y2} ${x2},${y2}`;
    return [{id:edge.id,d,x:vertical?x2:x2+19,y:vertical?y2-20:y2}];
   }));
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};const resize=new ResizeObserver(schedule);resize.observe(element);element.querySelectorAll('[data-demo-node]').forEach(n=>resize.observe(n));window.addEventListener('resize',schedule);schedule();
  return()=>{cancelAnimationFrame(frame);resize.disconnect();window.removeEventListener('resize',schedule);};
 },[topology,className]);
 return <div data-tutorial-region className={'tutorial-flow '+className} ref={host}>
  <svg className="tutorial-flow-lines" aria-hidden="true"><defs>{[false,true].map(green=><marker key={String(green)} id={`flow-${marker}-${green}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill={green?'#589c89':'#b1a0d5'}/></marker>)}</defs>{lines.map(line=>{const edge=edges.find(e=>e.id===line.id);return <path key={line.id} d={line.d} className={edge?.backward?'is-backward':''} markerEnd={`url(#flow-${marker}-${!!edge?.backward})`}/>;})}</svg>
  {nodes.map(node=><article key={node.id} data-demo-node={node.id} data-tutorial-target={node.target} className={`tutorial-mini-card ${node.className??''}`} style={{'--demo-faculty':node.accent??'#7651b5'} as CSSProperties}>
   <span className="tutorial-mini-top"><BookOpen size={14}/>{node.added&&<span><Check size={9}/>נוסף לעץ</span>}{node.backward&&<button type="button" className="tutorial-backward-badge" data-tutorial-target="backward" onClick={node.onBackward} aria-label="סגירת הקדם בהדגמה"><Minus size={10}/>קדם</button>}</span>
   <strong>{node.name}</strong>{node.onExpand&&<button type="button" className="tutorial-mini-expand" data-tutorial-target={node.id==='a'?'expand':undefined} aria-expanded={node.expanded} aria-label={`${node.expanded?'סגירת':'פתיחת'} ענפים של ${node.name} בהדגמה`} onClick={node.onExpand}>{node.expanded?<Minus size={14}/>:<Plus size={14}/>}<span>קורסי המשך</span></button>}
  </article>)}
  {lines.map(line=>{const edge=edges.find(e=>e.id===line.id);return edge?.onHide?<button key={line.id} type="button" className="tutorial-edge-hide" style={{left:line.x,top:line.y}} onClick={edge.onHide} aria-label={edge.label} data-tutorial-target={edge.id===edges.find(e=>e.onHide)?.id?'connection':undefined}><Minus size={13}/></button>:null;})}
  {children}
 </div>;
}
