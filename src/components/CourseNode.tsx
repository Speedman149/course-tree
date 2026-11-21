import { officialSourceURL } from '../lib/urls';
import type { CSSProperties } from 'react';
import { courseAppearance } from '../lib/faculty-colors';
import { createContext, useContext, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ArrowUpLeft, BookOpen, Bug, Check, ChevronLeft, CircleHelp, GitBranch, Info, Minus, Plus, RotateCcw } from 'lucide-react';
import type { Course, Requirement, Relation, DegreeCatalog } from '../types';
import type { CatalogRole } from '../lib/filters';
import { collectRequirements, forwardConnectionId, forwardExpansionState, type GraphNode } from '../lib/graph';

export interface ExplorerContextValue {
  courses: Map<string, Course>;
  dependents: Map<string, { courseId: string; relation: Relation }[]>;
  primaryCourseId: string;
  addedCourseIds: readonly string[];
  setCourseAdded: (courseId:string,added:boolean)=>void;
  collapseBackward: (courseId:string)=>void;
  focusedCourseId: string | null;
  expandedForward: Set<string>;
  activeForwardConnections: ReadonlySet<string>;
  expandedBackward: Map<string, Set<string>>;
  toggleForward: (id: string) => void;
  toggleBackward: (id: string, courseId: string) => void;
  setRoot: (course: Course) => void;
  catalogTerm: string;
  isVisible: (id: string) => boolean;
  activeCatalog: DegreeCatalog | null;
  catalogRoles: (id: string) => CatalogRole[];
  hasFilters: boolean;
  markedCourseIds: ReadonlySet<string>;
  toggleMarked: (courseId:string)=>void;
  reportCourse:(courseId:string)=>void;
  hiddenForwardConnections:ReadonlySet<string>;
  hideForwardConnection:(connectionId:string,parentId:string)=>void;
  restoreForwardConnection:(connectionId:string,parentId:string)=>void;
  revealAllForwardConnections:(parentId:string)=>void;
}
export const ExplorerContext = createContext<ExplorerContextValue>(null!);
export type CourseFlowNode = Node<{ graphNode: GraphNode }, 'course'>;

export function CourseLink({ course, id }: { course?: Course; id: string }) {
  const explorer = useContext(ExplorerContext);
  const [year, session] = (explorer?.catalogTerm ?? '2026_200').split('_');
  return <a className="course-link nodrag nopan" href={officialSourceURL(course?.source.url) || `https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/${year}/${session}/SM/${id}`} target="_blank" rel="noopener noreferrer" dir="ltr" onClick={e => e.stopPropagation()}>{id}<ArrowUpLeft size={12}/></a>;
}

export function RequirementExpression({ requirement, courses }: { requirement: Requirement; courses: Map<string, Course> }) {
  if (requirement.type === 'course') return <span className={`expression-course ${requirement.relation}`} title={courses.get(requirement.courseId)?.name}><CourseLink course={courses.get(requirement.courseId)} id={requirement.courseId}/></span>;
  return <span className={`expression-group ${requirement.type}`}>( {requirement.items.map((item, index) => <span key={index}>{index > 0 && <b className="expression-operator">{requirement.type === 'and' ? 'וגם' : 'או'}</b>}<RequirementExpression requirement={item} courses={courses}/></span>)} )</span>;
}

export default function CourseNode({ data, id }: NodeProps<CourseFlowNode>) {
  const explorer = useContext(ExplorerContext);
  const item = data.graphNode;
  const course = explorer.courses.get(item.courseId);
  const [open, setOpen] = useState(false);
  const [panelHeld, setPanelHeld] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const children = explorer.dependents.get(item.courseId) ?? [];
  const expansion = forwardExpansionState(id, explorer.dependents, explorer.activeForwardConnections, explorer.isVisible);
  const visibleChildren = expansion.eligible;
  const hiddenChildren = children.length - visibleChildren.length;
  const remainingBranches = expansion.status === 'collapsed'
    ? expansion.remaining.filter(child => explorer.hiddenForwardConnections.has(forwardConnectionId(id, child.courseId, child.relation)))
    : expansion.remaining;
  const roles = explorer.catalogRoles(item.courseId);
  const requirements = collectRequirements(course?.requirements);
  const expanded = expansion.status !== 'collapsed';
  const isAdded = item.added;
  const isRoot = id === explorer.primaryCourseId;
  const isBackward = item.backwardParents.length > 0;
  const isConcurrent = item.relations.includes('concurrent');
  const marked=explorer.markedCourseIds.has(item.courseId);
  const appearance=courseAppearance(course);

  const showPanel = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(350, window.innerWidth - 24);
      const left = rect.left > width + 24 ? rect.left - width - 12 : Math.min(rect.right + 12, window.innerWidth - width - 12);
      setPosition({ left: Math.max(12, left), top: Math.max(90, Math.min(rect.top, window.innerHeight - 430)) });
    }
    setOpen(true);

  };
  const hidePanel = () => {
    if (!panelHeld) closeTimer.current = setTimeout(() => { setOpen(false);  }, 200);
  };
  const close = () => { setPanelHeld(false); setOpen(false);  };
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    const outside = (event: PointerEvent) => { if (!cardRef.current?.contains(event.target as HTMLElement) && !panelRef.current?.contains(event.target as HTMLElement)) close(); };
    window.addEventListener('keydown', handler);
    window.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('pointerdown', outside); };
  }, [open]);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  const finishBranchReveal = () => {
    const origin = document.activeElement;
    requestAnimationFrame(() => {
      // Restore lost focus without overriding a newer keyboard/pointer action.
      const active = document.activeElement;
      if (active && active !== document.body && active !== origin) return;
      const details = cardRef.current?.querySelector<HTMLDetailsElement>('.branch-restores');
      if (details?.open) {

        details.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
      } else cardRef.current?.querySelector<HTMLButtonElement>('.expand-button')?.focus({ preventScroll: true });
    });
  };

  return <>
    <div ref={cardRef} data-expansion={expansion.status} data-faculty={appearance.id} data-marked={marked} style={{'--faculty-accent':appearance.accent} as CSSProperties} className={`course-node ${marked ? 'user-marked' : ''} ${isConcurrent && item.relations.length === 1 ? 'concurrent' : 'strong'} ${isRoot ? 'root-node' : ''} ${isAdded ? 'is-added' : ''} ${explorer.focusedCourseId === item.courseId ? 'is-focused' : ''} ${isBackward ? 'backward-node' : ''} ${item.cycle ? 'cycle-node' : ''} ${(isRoot || isAdded) && !explorer.isVisible(item.courseId) ? 'outside-filter-root' : ''}`} onMouseEnter={showPanel} onMouseLeave={hidePanel}>
      <Handle type="target" position={Position.Right}/>
      <Handle type="source" position={Position.Left}/>
      <div className="node-top"><span className="node-icon"><BookOpen size={16}/></span><CourseLink course={course} id={item.courseId}/>{isAdded && <button className="root-badge added-badge nodrag nopan" title="הסר מהעץ" aria-label={`הסר מהעץ ${item.courseId}`} onClick={event => {event.stopPropagation();close();explorer.setCourseAdded(item.courseId,false);}}><Check size={10}/>נוסף לעץ</button>}{isBackward && <button className="backward-badge nodrag nopan" aria-label={`כיווץ ענף קדם ${course?.name ?? item.courseId}`} onClick={() => { close(); explorer.collapseBackward(item.courseId); }}><Minus size={10}/>קדם</button>}{isConcurrent && <span className="relationship-chip concurrent">מקצוע צמוד</span>}</div>
      <div className="node-name">{course?.name ?? 'קורס ללא פרטים במאגר'}</div>
      <div className="node-meta"><span className="node-faculty-label" title={course?.faculties?.length?course.faculties.join(' · '):course?.faculty}>{appearance.label}</span>{course?.credits !== undefined && <span>{course.credits} נק׳</span>}</div>
      <div className="node-bottom">
        <button className="node-info nodrag nopan" aria-label={`הצגת קדמים של ${course?.name ?? item.courseId}`} aria-expanded={open} onClick={() => { if (open && panelHeld) close(); else { setPanelHeld(true); showPanel(); } }}><Info size={13}/><span>{requirements.length ? `${requirements.length} קדמים ישירים` : course?.requirementsStatus === 'none' ? 'לא תועדו קדמים' : 'פרטי קדמים'}</span></button>
        <div className="node-controls"><button className={`mark-button nodrag nopan ${marked?'is-marked':''}`} aria-label={`סימון אישי של ${item.courseId}`} aria-pressed={marked} title={marked?'ביטול סימון אישי':'סימון אישי — אינו אישור השלמה'} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();close();explorer.toggleMarked(item.courseId);}}><Check size={15}/></button>
        {(visibleChildren.length > 0 || (expanded && children.length > 0)) && !item.missing ? <button className={`expand-button nodrag nopan ${expanded ? 'is-expanded' : ''}`} aria-label={`${expanded ? 'כיווץ' : 'הרחבת'} קורסי המשך של ${course?.name ?? item.courseId}`} aria-expanded={expanded} onClick={() => explorer.toggleForward(id)}>{expanded ? <Minus size={15}/> : <Plus size={15}/>}<span>{visibleChildren.length}</span></button> : <span className="leaf-label">{hiddenChildren ? `${hiddenChildren} המשכים מוסתרים` : 'סוף הענף'}</span>}</div>
      </div>
      {remainingBranches.length>0 && !item.missing && <details className="branch-restores nodrag nopan nowheel" onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();event.currentTarget.open=false;}}}>
        <summary aria-label={`הצגת ענפים מוסתרים של ${item.courseId}`}><Plus size={12}/>הצגת ענפים ({remainingBranches.length})</summary>
        <div className="branch-restore-list">{remainingBranches.map(child=>{const connection=forwardConnectionId(id,child.courseId,child.relation);return <button key={connection} data-restore-connection={connection} aria-label={`החזרת הענף ${child.courseId} דרך ${item.courseId}`} title={explorer.courses.get(child.courseId)?.name} onClick={()=>{close();explorer.restoreForwardConnection(connection,id);finishBranchReveal();}}><Plus size={13}/><span><b dir="ltr">{child.courseId}</b> {explorer.courses.get(child.courseId)?.name??'קורס המשך'}</span></button>;})}<button className="branch-reveal-all" aria-label={`הצגת כל הענפים של ${item.courseId}`} onClick={()=>{close();explorer.revealAllForwardConnections(id);finishBranchReveal();}}><Plus size={13}/>הצג את כל הענפים</button></div>
      </details>}
      {hiddenChildren > 0 && visibleChildren.length > 0 && <span className="hidden-connections-label">{hiddenChildren} קשרי המשך מוסתרים בסינון</span>}
    </div>
    {open && createPortal(<div ref={panelRef} className="prerequisite-panel nodrag nopan" style={{ ...position, maxHeight: `calc(100dvh - ${position.top + 14}px)` }} dir="rtl" role="dialog" aria-label={`קדמים של ${course?.name ?? item.courseId}`} onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current); }} onMouseLeave={hidePanel}>
      <div className="prerequisite-heading"><span className="panel-icon"><GitBranch size={17}/></span><div><strong>מה צריך לפני?</strong><span>הקדמים של {course?.name ?? item.courseId}</span></div><button className="icon-button" aria-label="סגירת חלונית קדמים" onClick={close}><Minus size={16}/></button></div>
      {item.cycle && <p className="panel-filter-note"><RotateCcw size={12}/> קיים מעגל בקשרי המקצוע במקור. כל מקצוע מוצג פעם אחת, ואפשר להמשיך לחקור.</p>}
      <button className="course-feedback-link course-add-action" aria-label={`${isAdded ? 'הסר מהעץ' : 'הוסף לעץ'} ${item.courseId}`} aria-pressed={isAdded} onClick={() => { close(); explorer.setCourseAdded(item.courseId,!isAdded); }}>{isAdded ? <Check size={13}/> : <Plus size={13}/>}{isAdded ? 'הסר מהעץ' : 'הוסף לעץ'}</button>
      {explorer.activeCatalog && <div className="course-catalog-roles"><strong>בקטלוג הנבחר</strong>{roles.length ? roles.map(role => <span key={role.id} title={role.description}>{role.label}{role.conditional ? ' · בכפוף לתנאים' : ''}</span>) : <span>מחוץ לרשימות המיובאות של הקטלוג</span>}</div>}
      {requirements.length ? <>
        <div className="requirement-logic"><span>כלל הקבלה לקורס</span><div><RequirementExpression requirement={course!.requirements!} courses={explorer.courses}/></div></div>
        <div className="prerequisite-list">{requirements.map(req => {
          const prerequisite = explorer.courses.get(req.courseId);
          const backwardExpanded = explorer.expandedBackward.get(id)?.has(req.courseId);
          return <div className="prerequisite-row" key={`${req.courseId}-${req.relation}`}>
            <div className="prerequisite-row-content"><CourseLink course={prerequisite} id={req.courseId}/><strong>{prerequisite?.name ?? 'פרטי הקורס אינם במאגר'}</strong>{explorer.hasFilters && !explorer.isVisible(req.courseId) && <span className="prerequisite-outside-filter">מחוץ לסינון · ניתן לחקור אחורה</span>}{explorer.activeCatalog && explorer.catalogRoles(req.courseId).map(role => <span className="prerequisite-catalog-role" key={role.id} title={role.description}>{role.label}</span>)}<span className={`relation-label ${req.relation}`}><i/>{req.relation === 'strong' ? 'קדם חזק · יש להשלים לפני' : 'מקצוע צמוד · אפשר במקביל'}</span></div>
            <button className={`prerequisite-expand ${backwardExpanded ? 'active' : ''}`} aria-label={`${backwardExpanded ? 'כיווץ' : 'הרחבת'} קדם ${prerequisite?.name ?? req.courseId}`} aria-expanded={!!backwardExpanded} disabled={item.missing} onClick={() => explorer.toggleBackward(id, req.courseId)}>{backwardExpanded ? <Minus size={16}/> : <Plus size={16}/>}</button>
          </div>;
        })}</div><p className="panel-hint">לחצו על + כדי להמשיך לחקור את הקדמים במפה.</p>
      </> : <div className="no-prerequisites"><CircleHelp size={22}/><p>{course?.requirementsStatus === 'none' ? 'לא תועדו קדמים לקורס הזה במקור. בדקו את כללי הרישום בקטלוג.' : 'אין במאגר מידע מפוענח על קדמים לקורס הזה.'}</p>{course?.rawRequirements && <p className="raw-requirements">{course.rawRequirements}</p>}</div>}
      {hiddenChildren > 0 && <p className="panel-filter-note">{hiddenChildren} קשרי המשך מוסתרים במסננים. הקדמים מוצגים במלואם וניתנים לפתיחה.</p>}
      <button className="course-feedback-link" onClick={()=>{close();explorer.reportCourse(item.courseId);}}><Bug size={12}/>דיווח על מידע בקורס</button>
      {course && <div className="panel-footer"><a href={officialSourceURL(course.source.url)} target="_blank" rel="noopener noreferrer">מידע במקור <ArrowUpLeft size={12}/></a>{(!isRoot || explorer.addedCourseIds.some(courseId => courseId !== id)) && <button onClick={() => { explorer.setRoot(course); close(); }}>פתח עץ חדש <ChevronLeft size={12}/></button>}</div>}
    </div>, document.body)}
  </>;
}
