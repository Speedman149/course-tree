import {useMemo,useState} from 'react';
import {BookOpen,Bug,Check,ChevronDown,Focus,Layers,ListPlus,Menu,Minus,Plus,RotateCcw,Save,Search,ShieldCheck,SlidersHorizontal,X} from 'lucide-react';
import type {Course} from '../../types';
import {buildDependents,collectRequirements} from '../../lib/graph';
import {courseAppearance,facultyColor,facultyDisplayColor} from '../../lib/faculty-colors';
import {evaluatePrerequisites} from '../../lib/prerequisite-satisfaction';
import {creditTotalFormat,summarizeMarkedCredits} from '../../lib/marked-credits';
import {normalizedQuantity} from '../../lib/repeatable-courses';
import {RequirementExpression} from '../CourseNode';
import PrerequisiteHighlightToggle from '../PrerequisiteHighlightToggle';
import {AnnotatedDemo,DemoCourseCard,DemoGraph,type MiniNode,type MiniEdge} from './Visuals';
import {tutorialSteps} from './content';
import {tutorialExamples,tutorialIds as ids} from './examples';
export interface StepProps {courses:ReadonlyMap<string,Course>}

export function CardStep({courses}:StepProps){
 const dependentCount=useMemo(()=>courses.size>tutorialExamples.length?buildDependents([...courses.values()]).get(ids.intro)?.length:undefined,[courses]);
 const [active,setActive]=useState('name'),[marked,setMarked]=useState(false),[expanded,setExpanded]=useState(false);
 return <AnnotatedDemo notes={tutorialSteps[0].notes} active={active} onSelect={setActive}>
  <DemoCourseCard course={courses.get(ids.intro)!} dependentCount={dependentCount} marked={marked} expanded={expanded} onMark={()=>{setMarked(!marked);setActive('mark');}} onExpand={()=>{setExpanded(!expanded);setActive('expand');}} onInfo={()=>setActive('info')}/>
 </AnnotatedDemo>;
}
export function BranchesStep(){
 const [active,setActive]=useState('connection'),[expanded,setExpanded]=useState(true),[children,setChildren]=useState({b:true,c:true}),[hidden,setHidden]=useState(new Set<string>());
 const hide=(edge:string)=>{setHidden(previous=>new Set([...previous,edge]));setActive('restore');};
 const restore=(edge:string)=>setHidden(previous=>new Set([...previous].filter(id=>id!==edge)));
 const b=expanded&&!hidden.has('ab'),c=expanded&&!hidden.has('ac'),d=(b&&children.b&&!hidden.has('bd'))||(c&&children.c&&!hidden.has('cd'));
 const nodes:MiniNode[]=[{id:'a',name:'קורס א׳',added:true,className:'flow-a',expanded,onExpand:()=>{setExpanded(!expanded);if(!expanded)setHidden(new Set([...hidden].filter(id=>!['ab','ac'].includes(id))));setActive('expand');}}];
 if(b)nodes.push({id:'b',name:'קורס ב׳',className:'flow-b',expanded:children.b,onExpand:()=>setChildren({...children,b:!children.b})});
 if(c)nodes.push({id:'c',name:'קורס ג׳',className:'flow-c',expanded:children.c,onExpand:()=>setChildren({...children,c:!children.c})});
 if(d)nodes.push({id:'d',name:'קורס משותף',className:'flow-d',target:'shared'});
 const edges:MiniEdge[]=[];
 for(const [id,source,target,visible] of [['ab','a','b',b],['ac','a','c',c],['bd','b','d',b&&children.b&&d&&!hidden.has('bd')],['cd','c','d',c&&children.c&&d&&!hidden.has('cd')]] as const)if(visible)edges.push({id,source,target,onHide:()=>hide(id),label:`הסתרת החיבור ${source} אל ${target} בהדגמה`});
 return <AnnotatedDemo wide notes={tutorialSteps[1].notes} active={active} onSelect={setActive}>
  <div data-tutorial-region className="tutorial-branch-example">
   <DemoGraph nodes={nodes} edges={edges} className={!expanded?'is-collapsed':''}/>
   <div className="tutorial-branch-actions" data-tutorial-target="restore"><details open={hidden.size>0||undefined}><summary><Plus size={13}/>הצגת ענפים ({hidden.size})</summary><div>{[...hidden].map(edge=><button key={edge} type="button" onClick={()=>restore(edge)} aria-label={`החזרת החיבור ${edge} בהדגמה`}><Plus size={13}/>{edge==='ab'?'א׳ ← ב׳':edge==='ac'?'א׳ ← ג׳':edge==='bd'?'ב׳ ← הקורס המשותף':'ג׳ ← הקורס המשותף'}</button>)}<button type="button" onClick={()=>{setHidden(new Set());setExpanded(true);}}>הצג את כל הענפים</button></div></details>
   <button type="button" className="tutorial-restart" onClick={()=>{setExpanded(true);setChildren({b:true,c:true});setHidden(new Set());}}>התחלה מחדש</button></div>
   <div className="tutorial-map-navigation" data-tutorial-target="navigation"><span><Plus size={15}/><Minus size={15}/><Focus size={15}/></span><small>במפה: גררו להזזה, גללו לשינוי קנה מידה</small></div>
   <p className="tutorial-demo-status" role="status">{!expanded?'רק קורס א׳ מוצג. לחצו + כדי לפתוח שוב.':b&&c?'שני ענפים פתוחים. נסו את ה־− הקטן על אחד החצים.':b||c?'ענף אחד נשאר פתוח. קורס משותף נשאר אם יש אליו חיבור אחר.':'הענפים מוסתרים. אפשר להחזיר אותם דרך ״הצגת ענפים״.'}</p>
  </div>
 </AnnotatedDemo>;
}
export function PrerequisitesStep({courses}:StepProps){
 const course=courses.get(ids.requirements)!,requirements=collectRequirements(course.requirements),[opened,setOpened]=useState<string|null>(requirements[0]?.courseId??null),[active,setActive]=useState('prerequisite');
 const map=useMemo(()=>new Map(courses),[courses]);
 return <AnnotatedDemo wide notes={tutorialSteps[2].notes} active={active} onSelect={id=>{setActive(id);if(id==='backward'&&!opened)setOpened(requirements[0].courseId);}}>
  <div className="tutorial-prerequisites-layout">
   <div data-tutorial-region className="tutorial-prerequisite-panel" data-tutorial-target="panel"><header><span className="tutorial-panel-icon"><BookOpen size={18}/></span><div><strong>מה צריך לפני?</strong><small>{course.name}</small></div><Minus size={15}/></header>
    <div className="tutorial-rule" data-tutorial-target="logic"><small>כלל הקבלה לקורס</small><RequirementExpression requirement={course.requirements!} courses={map}/><div className="tutorial-logic-key"><span>וגם <b>כל התנאים בקבוצה</b></span><span>או <b>חלופה אחת</b></span></div></div>
    {requirements.map((req,i)=>{const c=courses.get(req.courseId)!;return <div className="tutorial-prerequisite-row" key={req.courseId}><span><small dir="ltr">{req.courseId}</small><strong>{c?.name??'קורס קדם'}</strong><small>קדם חזק · יש להשלים לפני</small></span><button type="button" data-tutorial-target={i===0?'prerequisite':undefined} className={opened===req.courseId?'active':''} aria-label={`פתיחת קדם בהדגמה ${req.courseId}`} aria-expanded={opened===req.courseId} onClick={()=>{setOpened(opened===req.courseId?null:req.courseId);setActive('prerequisite');}}>{opened===req.courseId?<Minus size={16}/>:<Plus size={16}/>}</button></div>;})}
    <p>הרשימה כוללת חלופות. הכלל המלא הוא שקובע.</p>
   </div>
   <div className="tutorial-backward-preview"><span className="tutorial-mini-eyebrow">כך נראה קדם שנפתח</span><DemoGraph className="tutorial-prerequisite-flow horizontal" nodes={[
    {id:'after',name:course.name,className:'prereq-after',accent:facultyDisplayColor(courseAppearance(course).id)},
    ...(opened?[{id:'before',name:courses.get(opened)?.name??'קורס קדם',backward:true,className:'prereq-before',accent:facultyDisplayColor(courseAppearance(courses.get(opened)).id),onBackward:()=>setOpened(null)}]:[])
   ]} edges={opened?[{id:'back',source:'before',target:'after',backward:true}]:[]}/><span className="tutorial-concurrent">מקצוע צמוד <small>סוג קשר נפרד; כפוף לכללי הרישום</small></span></div>
  </div>
 </AnnotatedDemo>;
}
export function AddedCoursesStep({courses}:StepProps){
 const [active,setActive]=useState('search'),[added,setAdded]=useState<string[]>([ids.data,ids.discrete,ids.sport]),[query,setQuery]=useState('אלגוריתמים'),[focused,setFocused]=useState('');
 const pool=[ids.algorithms,ids.data,ids.discrete,ids.sport].map(id=>courses.get(id)!);
 const candidates=pool.filter(c=>`${c.name} ${c.id}`.includes(query.trim())).slice(0,3);
 const add=(id:string)=>{setAdded(old=>old.includes(id)?old:[...old,id]);setFocused(id);setActive('shared');};
 const connected=added.some(id=>id!==ids.sport),nodes:MiniNode[]=connected?[
  ...(added.includes(ids.data)?[{id:'data',name:courses.get(ids.data)!.name,added:true,className:'added-data'}]:[]),
  ...(added.includes(ids.discrete)?[{id:'math',name:courses.get(ids.discrete)!.name,added:true,className:'added-math'}]:[]),
  {id:'algo',name:courses.get(ids.algorithms)!.name,added:added.includes(ids.algorithms),className:`added-algo ${focused===ids.algorithms?'demo-focused':''}`,target:'shared'}
 ]:[];
 return <AnnotatedDemo wide notes={tutorialSteps[3].notes} active={active} onSelect={setActive}>
  <div className="tutorial-added-layout"><div className="tutorial-search-collection"><div data-tutorial-target="search" data-tutorial-region className="tutorial-search-demo"><label><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="שם או מספר קורס…" aria-label="חיפוש קורס בהדגמה"/></label><div>{candidates.map(c=><button type="button" key={c.id} onClick={()=>add(c.id)}><BookOpen size={15}/><span>{c.name}<small dir="ltr">{c.id}</small></span>{added.includes(c.id)&&<Check size={15}/>}</button>)}</div></div>
   <div data-tutorial-region className="tutorial-collection-demo" data-tutorial-target="collection"><header><ListPlus size={16}/><strong>קורסים שהוספתי ({added.length})</strong></header><button type="button" className="tutorial-clear-added" disabled={!added.length} onClick={()=>setAdded([])}>הסרת כל הקורסים</button>{added.map(id=><div className="tutorial-added-row" key={id}><span>{courses.get(id)!.name}</span><button type="button" aria-label={`הסרת ${id} מההדגמה`} onClick={()=>setAdded(added.filter(x=>x!==id))}><X size={14}/></button></div>)}{!added.length&&<p>לא הוספתם קורסים עדיין</p>}</div></div>
   <div data-tutorial-region className="tutorial-added-map"><DemoGraph className="tutorial-added-flow" nodes={nodes} edges={connected?[{id:'data-algo',source:'data',target:'algo'},{id:'math-algo',source:'math',target:'algo'}]:[]}/>{added.includes(ids.sport)&&<div className="tutorial-separate-course" data-tutorial-target="separate"><BookOpen size={16}/><strong>{courses.get(ids.sport)!.name}</strong><span>קורס נוסף, בלי חיבור למסלול הזה</span></div>}{!added.length&&<p className="tutorial-empty-example">בחירת תוצאה תוסיף קורס למפה.</p>}<small>חלק מהמפה לדוגמה · אותו קורס מוצג פעם אחת</small></div>
  </div>
 </AnnotatedDemo>;
}
export function ToolbarStep({courses}:StepProps){
 const [active,setActive]=useState('highlight'),[layers,setLayers]=useState(0),[enabled,setEnabled]=useState(false),[filters,setFilters]=useState(false),[marks,setMarks]=useState(new Set<string>([ids.data,ids.discrete]));
 const course=courses.get(ids.algorithms)!,satisfied=enabled&&evaluatePrerequisites(course,marks).status==='satisfied';
 return <AnnotatedDemo wide notes={tutorialSteps[4].notes} active={active} onSelect={setActive}>
  <div className="tutorial-toolbar-example"><div data-tutorial-region className="tutorial-toolbar-demo"><button type="button" data-tutorial-target="filters" className={filters?'active':''} onClick={()=>{setFilters(!filters);setActive('filters');}}><SlidersHorizontal size={15}/>מסננים</button><span data-tutorial-target="highlight"><PrerequisiteHighlightToggle enabled={enabled} onChange={v=>{setEnabled(v);setActive('highlight');}}/></span><button type="button" data-tutorial-target="reset" onClick={()=>{setLayers(0);setActive('reset');}}><RotateCcw size={15}/>איפוס ענפים</button><button type="button" data-tutorial-target="layer" onClick={()=>{setLayers(Math.min(2,layers+1));setActive('layer');}}><Layers size={15}/>עוד שכבה</button></div>
   <div className="tutorial-mobile-tools-hint"><Menu size={15}/>בטלפון, רוב הכלים נמצאים בתוך ״כלים״.</div>
   <div className="tutorial-highlight-play"><div><span className="tutorial-mini-eyebrow">סימונים בהדגמה</span>{[ids.data,ids.discrete].map(id=><label key={id}><input type="checkbox" checked={marks.has(id)} onChange={()=>setMarks(old=>{const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);return next;})}/><span>{courses.get(id)!.name}</span></label>)}</div><div className={`tutorial-highlight-result${satisfied?' is-satisfied':''}`} style={{'--demo-faculty':facultyDisplayColor(courseAppearance(course).id)} as React.CSSProperties}>{satisfied&&<span className="tutorial-green-check"><Check size={15}/></span>}<BookOpen size={18}/><strong>{course.name}</strong><small>{satisfied?'הקדמים הרגילים מסומנים':'נסו להפעיל את ההדגשה'}</small></div></div>
   {layers>0&&<div className="tutorial-extra-layer" role="status"><span>קורס המשך לדוגמה</span>{layers>1&&<span>שכבה נוספת</span>}</div>}{filters&&<div className="tutorial-filter-preview">מסנני פקולטה וקטלוג — בשלב הבא</div>}
   <p className="tutorial-mini-note">גם סימונים מחוץ למפה נכללים. מקצועות צמודים ותנאי רישום נוספים אינם נבדקים.</p>
  </div>
 </AnnotatedDemo>;
}
export function FiltersStep(){
 const [active,setActive]=useState('faculty-tab'),[tab,setTab]=useState('faculty'),[faculties,setFaculties]=useState(new Set(['מדעי המחשב','מתמטיקה','פיזיקה'])),[catalog,setCatalog]=useState('all');
 const choose=(id:string)=>{setActive(id);if(id==='faculty-tab')setTab('faculty');else {setTab('catalog');if(id==='groups')setCatalog('sample');}};
 return <AnnotatedDemo wide notes={tutorialSteps[5].notes} active={active} onSelect={choose}>
  <div className="tutorial-filters-layout"><div data-tutorial-region className="tutorial-filter-panel"><header><SlidersHorizontal size={18}/><strong>בוחרים מה לגלות</strong></header><div className="tutorial-filter-tabs" role="tablist" aria-label="מסננים בהדגמה">{[{id:'faculty',label:'סינון לפי פקולטה',target:'faculty-tab'},{id:'catalog',label:'קטלוג תואר',target:'catalog-tab'}].map(t=><button type="button" key={t.id} role="tab" data-tutorial-target={t.target} aria-selected={tab===t.id} tabIndex={tab===t.id?0:-1} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?'faculty':event.key==='End'?'catalog':tab==='faculty'?'catalog':'faculty';setTab(next);setActive(next+'-tab');const parent=event.currentTarget.parentElement;requestAnimationFrame(()=>parent?.querySelector<HTMLButtonElement>(`[data-tutorial-target="${next}-tab"]`)?.focus());}} onClick={()=>{setTab(t.id);setActive(t.target);}}>{t.label}</button>)}</div>
   <div className="tutorial-filter-content">{tab==='faculty'?<><p>בחרו מה להציג בקורסי ההמשך</p>{['מדעי המחשב','מתמטיקה','פיזיקה'].map((f,i)=><label key={f}><input type="checkbox" checked={faculties.has(f)} onChange={()=>setFaculties(old=>{const n=new Set(old);if(n.has(f))n.delete(f);else n.add(f);return n;})}/><i style={{background:facultyDisplayColor(['cs','math','physics'][i])}}/>{f}</label>)}</>:<><div className="tutorial-catalog-controls"><span>שנת קטלוג <b>2025–2026</b></span><label>מסלול<select aria-label="קטלוג בהדגמה" value={catalog} onChange={e=>setCatalog(e.target.value)}><option value="all">כל המקצועות</option><option value="sample">תכנית לדוגמה</option></select></label></div>{catalog==='sample'?<div data-tutorial-target="groups" className="tutorial-catalog-groups">{['חובה מפורשת','בחירה','מסלול / התמחות'].map(g=><details key={g}><summary>{g}<ChevronDown size={13}/></summary><p>כאן מופיעות הרשימות המיובאות וקישורי המקור, כשקיימים נתונים.</p></details>)}</div>:<p>כל המקצועות — ללא סינון לפי קטלוג</p>}</>}</div>
  </div><div className="tutorial-filter-result"><span className="tutorial-mini-eyebrow">קורסי המשך בתצוגה</span>{['מדעי המחשב','מתמטיקה','פיזיקה'].map(f=><div className={faculties.has(f)&&(catalog==='all'||f!=='פיזיקה')?'':'is-filtered'} key={f}><BookOpen size={15}/>{f}<small>{faculties.has(f)&&(catalog==='all'||f!=='פיזיקה')?'מוצג':'מסונן'}</small></div>)}<span className="tutorial-filter-kept">קורס שנוסף במפורש נשאר במפה</span><span className="tutorial-backward-kept">גם קדמים מחוץ לסינון ניתנים לחקירה</span></div></div>
  <p className="tutorial-mini-note"><ShieldCheck size={13}/>הקטלוג עוזר להתמקד; ייבוא חלקי או בחירת מסלול אינם אישור זכאות לתואר.</p>
 </AnnotatedDemo>;
}
export function MarkedCoursesStep({courses}:StepProps){
 const [active,setActive]=useState('total'),[marked,setMarked]=useState(new Set<string>([ids.intro,ids.sport])),[quantity,setQuantity]=useState(2),[open,setOpen]=useState(true),[added,setAdded]=useState(new Set<string>([ids.intro]));
 const quantities={[ids.sport]:quantity},summary=summarizeMarkedCredits(courses,marked,quantities),sport=courses.get(ids.sport)!;
 const toggleIntro=()=>{setMarked(old=>{const n=new Set(old);if(n.has(ids.intro))n.delete(ids.intro);else n.add(ids.intro);return n;});setActive('mark');};
 return <AnnotatedDemo wide notes={tutorialSteps[6].notes} active={active} onSelect={id=>{setActive(id);if(id==='marked-list'||id==='add-marked'||id==='total'||id==='quantity')setOpen(true);}}>
  <div className="tutorial-marked-layout"><div className="tutorial-marked-card-wrap"><DemoCourseCard course={courses.get(ids.intro)!} marked={marked.has(ids.intro)} onMark={toggleIntro} /></div><div data-tutorial-region className="tutorial-marked-collection"><button type="button" className="tutorial-list-trigger" data-tutorial-target="marked-list" aria-expanded={open} onClick={()=>{setOpen(!open);setActive('marked-list');}}><Check size={15}/>רשימת מסומנים ({marked.size})<ChevronDown size={15}/></button>{open&&<div className="tutorial-marked-list"><strong data-tutorial-target="total" className="tutorial-credit-total">{summary.missingCreditCount?'נק״ז ידוע':'סה״כ נק״ז'}: {creditTotalFormat.format(summary.knownCredits)}{summary.missingCreditCount>0&&<small>ל־{summary.missingCreditCount} מקצועות חסר נתון נק״ז</small>}</strong>{[...marked].map(id=><div className="tutorial-marked-row" key={id}><span><Check size={13}/><strong>{courses.get(id)!.name}</strong></span><button type="button" data-tutorial-target={id===ids.intro?'add-marked':undefined} aria-label={`${added.has(id)?'הסרת':'הוספת'} קורס מסומן בהדגמה ${id}`} aria-pressed={added.has(id)} onClick={()=>setAdded(old=>{const n=new Set(old);if(n.has(id))n.delete(id);else n.add(id);return n;})}>{added.has(id)?<Check size={14}/>:<Plus size={14}/>}<small>{added.has(id)?'נוסף לעץ':'הוסף לעץ'}</small></button>{id===ids.sport&&<div data-tutorial-target="quantity" className="tutorial-quantity"><span>מספר פעמים</span><button type="button" aria-label="הפחתת כמות ספורט בהדגמה" disabled={quantity<=1} onClick={()=>{setQuantity(normalizedQuantity(sport,quantity-1));setActive('quantity');}}><Minus size={13}/></button><output aria-label="כמות ספורט בהדגמה">{quantity}</output><button type="button" aria-label="הגדלת כמות ספורט בהדגמה" disabled={normalizedQuantity(sport,quantity+1)===quantity} onClick={()=>{setQuantity(normalizedQuantity(sport,quantity+1));setActive('quantity');}}><Plus size={13}/></button></div>}</div>)}{!marked.size&&<p>עדיין אין קורסים מסומנים</p>}</div>}
   <div data-tutorial-target="clear" className="tutorial-reset-controls"><button type="button" disabled={!marked.size} onClick={()=>{setMarked(new Set());setQuantity(1);setActive('clear');}}>ניקוי סימונים</button><button type="button" onClick={()=>{setMarked(new Set());setQuantity(1);setAdded(new Set([ids.intro]));setOpen(true);setActive('clear');}}>איפוס התקדמות שמורה</button></div>
  </div></div><div className="tutorial-save-note"><Save size={19}/><span><strong>ההתקדמות שלכם נשמרת אוטומטית בדפדפן.</strong><small>במפה שלכם, כששמירה מקומית זמינה. השמירה מקומית למכשיר ולדפדפן הזה.</small></span></div><p className="tutorial-mini-note"><Bug size={13}/>לדיווח על תקלה או לשליחת משוב — כפתור הדיווח בראש האתר.</p>
 </AnnotatedDemo>;
}
