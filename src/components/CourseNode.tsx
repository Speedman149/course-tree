import { createContext, useContext, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ArrowUpLeft, BookOpen, ChevronLeft, CircleHelp, GitBranch, Info, Minus, Plus, RotateCcw } from 'lucide-react';
import type { Course, Requirement, Relation } from '../types';
import { collectRequirements, type GraphNode } from '../lib/graph';

export interface ExplorerContextValue {
  courses: Map<string, Course>;
  dependents: Map<string, { courseId: string; relation: Relation }[]>;
  expandedForward: Set<string>;
  expandedBackward: Map<string, Set<string>>;
  toggleForward: (id: string) => void;
  toggleBackward: (id: string, courseId: string) => void;
  setRoot: (course: Course) => void;
  onHover: (id: string | null) => void;
  catalogTerm: string;
}
export const ExplorerContext = createContext<ExplorerContextValue>(null!);
export type CourseFlowNode = Node<{ graphNode: GraphNode }, 'course'>;

export function CourseLink({ course, id }: { course?: Course; id: string }) {
  const explorer = useContext(ExplorerContext);
  const [year, session] = (explorer?.catalogTerm ?? '2026_200').split('_');
  return <a className="course-link nodrag nopan" href={course?.source.url || `https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/${year}/${session}/SM/${id}`} target="_blank" rel="noopener noreferrer" dir="ltr" onClick={e => e.stopPropagation()}>{id}<ArrowUpLeft size={12}/></a>;
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
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const children = explorer.dependents.get(item.courseId) ?? [];
  const requirements = collectRequirements(course?.requirements);
  const expanded = explorer.expandedForward.has(id);
  const isRoot = item.direction === 'root';

  const showPanel = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(350, window.innerWidth - 24);
      const left = rect.left > width + 24 ? rect.left - width - 12 : Math.min(rect.right + 12, window.innerWidth - width - 12);
      setPosition({ left: Math.max(12, left), top: Math.max(90, Math.min(rect.top, window.innerHeight - 430)) });
    }
    setOpen(true);
    explorer.onHover(id);
  };
  const hidePanel = () => {
    if (!pinned) closeTimer.current = setTimeout(() => { setOpen(false); explorer.onHover(null); }, 200);
  };
  const close = () => { setPinned(false); setOpen(false); explorer.onHover(null); };
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    const outside = (event: PointerEvent) => { if (!cardRef.current?.contains(event.target as HTMLElement) && !panelRef.current?.contains(event.target as HTMLElement)) close(); };
    window.addEventListener('keydown', handler);
    window.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('pointerdown', outside); };
  }, [open]);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  return <>
    <div ref={cardRef} className={`course-node ${item.relation === 'concurrent' ? 'concurrent' : 'strong'} ${isRoot ? 'root-node' : ''} ${item.direction === 'backward' ? 'backward-node' : ''} ${item.cycle ? 'cycle-node' : ''}`} onMouseEnter={showPanel} onMouseLeave={hidePanel}>
      <Handle type="target" position={Position.Right}/>
      <Handle type="source" position={Position.Left}/>
      <div className="node-top"><span className="node-icon"><BookOpen size={16}/></span><CourseLink course={course} id={item.courseId}/>{isRoot && <span className="root-badge">נקודת מוצא</span>}{item.direction === 'backward' && <button className="backward-badge nodrag nopan" aria-label={`כיווץ ענף קדם ${course?.name ?? item.courseId}`} onClick={() => { close(); explorer.toggleBackward(item.parentId!, item.courseId); }}><Minus size={10}/>קדם</button>}</div>
      <div className="node-name">{course?.name ?? 'קורס ללא פרטים במאגר'}</div>
      <div className="node-meta"><span>{course?.faculty || 'הטכניון'}</span>{course?.credits !== undefined && <span>{course.credits} נק׳</span>}</div>
      <div className="node-bottom">
        <button className="node-info nodrag nopan" aria-label={`הצגת קדמים של ${course?.name ?? item.courseId}`} aria-expanded={open} onClick={() => { if (open && pinned) close(); else { setPinned(true); showPanel(); } }}><Info size={13}/><span>{item.cycle ? 'קשר מעגלי' : requirements.length ? `${requirements.length} קדמים ישירים` : course?.requirementsStatus === 'none' ? 'לא תועדו קדמים' : 'פרטי קדמים'}</span></button>
        {item.cycle ? <span className="cycle-label"><RotateCcw size={13}/>כבר מופיע בענף</span> : children.length > 0 && !item.missing ? <button className={`expand-button nodrag nopan ${expanded ? 'is-expanded' : ''}`} aria-label={`${expanded ? 'כיווץ' : 'הרחבת'} קורסי המשך של ${course?.name ?? item.courseId}`} aria-expanded={expanded} onClick={() => explorer.toggleForward(id)}>{expanded ? <Minus size={15}/> : <Plus size={15}/>}<span>{children.length}</span></button> : <span className="leaf-label">סוף הענף</span>}
      </div>
    </div>
    {open && createPortal(<div ref={panelRef} className="prerequisite-panel nodrag nopan" style={position} dir="rtl" role="dialog" aria-label={`קדמים של ${course?.name ?? item.courseId}`} onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current); }} onMouseLeave={hidePanel}>
      <div className="prerequisite-heading"><span className="panel-icon"><GitBranch size={17}/></span><div><strong>מה צריך לפני?</strong><span>הקדמים של {course?.name ?? item.courseId}</span></div><button className="icon-button" aria-label="סגירת חלונית קדמים" onClick={close}><Minus size={16}/></button></div>
      {requirements.length ? <>
        <div className="requirement-logic"><span>כלל הקבלה לקורס</span><div><RequirementExpression requirement={course!.requirements!} courses={explorer.courses}/></div></div>
        <div className="prerequisite-list">{requirements.map(req => {
          const prerequisite = explorer.courses.get(req.courseId);
          const backwardExpanded = explorer.expandedBackward.get(id)?.has(req.courseId);
          return <div className="prerequisite-row" key={`${req.courseId}-${req.relation}`}>
            <div className="prerequisite-row-content"><CourseLink course={prerequisite} id={req.courseId}/><strong>{prerequisite?.name ?? 'פרטי הקורס אינם במאגר'}</strong><span className={`relation-label ${req.relation}`}><i/>{req.relation === 'strong' ? 'קדם חזק · יש להשלים לפני' : 'מקצוע צמוד · אפשר במקביל'}</span></div>
            <button className={`prerequisite-expand ${backwardExpanded ? 'active' : ''}`} aria-label={`${backwardExpanded ? 'כיווץ' : 'הרחבת'} קדם ${prerequisite?.name ?? req.courseId}`} aria-expanded={!!backwardExpanded} disabled={item.cycle || item.missing} onClick={() => explorer.toggleBackward(id, req.courseId)}>{backwardExpanded ? <Minus size={16}/> : <Plus size={16}/>}</button>
          </div>;
        })}</div><p className="panel-hint">לחצו על + כדי להמשיך לחקור את הקדמים במפה.</p>
      </> : <div className="no-prerequisites"><CircleHelp size={22}/><p>{course?.requirementsStatus === 'none' ? 'לא תועדו קדמים לקורס הזה במקור. בדקו את כללי הרישום בקטלוג.' : 'אין במאגר מידע מפוענח על קדמים לקורס הזה.'}</p>{course?.rawRequirements && <p className="raw-requirements">{course.rawRequirements}</p>}</div>}
      {course && <div className="panel-footer"><a href={course.source.url} target="_blank" rel="noopener noreferrer">מידע במקור <ArrowUpLeft size={12}/></a>{!isRoot && <button onClick={() => { explorer.setRoot(course); close(); }}>הגדרה כנקודת מוצא <ChevronLeft size={12}/></button>}</div>}
    </div>, document.body)}
  </>;
}
