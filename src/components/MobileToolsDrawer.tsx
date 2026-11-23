import {useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {Check, ChevronDown, Layers, ListPlus, RotateCcw, Settings2, X} from 'lucide-react';
import type {Course} from '../types';
import {MARKED_COURSE_COLOR} from '../lib/faculty-colors';
import {AddedCoursesContent, MarkedCoursesContent} from './CourseCollections';
import PrerequisiteHighlightToggle from './PrerequisiteHighlightToggle';

interface Props {
  courses: ReadonlyMap<string, Course>;
  addedCourseIds: readonly string[];
  markedCourseIds: ReadonlySet<string>;
  visibleCourseIds: ReadonlySet<string>;
  highlightSatisfiedPrerequisites: boolean;
  storageAvailable: boolean;
  onAddedChange: (id: string, added: boolean) => void;
  onLocateAddedCourse: (id: string) => void;
  onFocusCourse: (id: string) => void;
  onSelectCourse: (id: string) => void;
  onToggleMarked: (id: string) => void;
  onHighlightChange: (enabled: boolean) => void;
  onExpandLayer: () => void;
  onResetBranches: () => void;
  onClearMarks: () => void;
  onResetProgress: () => void;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  fallbackFocusRef: RefObject<HTMLButtonElement | null>;
}

/** Modal mobile presentation. Collections and all actions still use the tree's existing state. */
export default function MobileToolsDrawer(props: Props) {
  const {onClose, triggerRef, fallbackFocusRef} = props;
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [bounds, setBounds] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    const update = () => {
      const view = window.visualViewport;
      const width = view?.width ?? innerWidth;
      const panelWidth = Math.min(380, Math.max(0, width - 32));
      setBounds({top: view?.offsetTop ?? 0, left: (view?.offsetLeft ?? 0) + width - panelWidth, width: panelWidth, height: view?.height ?? innerHeight});
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);
  useEffect(() => {
    const {scrollX, scrollY} = window;
    const body = document.body;
    const saved = {position: body.style.position, top: body.style.top, left: body.style.left, width: body.style.width, overflow: body.style.overflow};
    Object.assign(body.style, {position: 'fixed', top: `${-scrollY}px`, left: `${-scrollX}px`, width: '100%', overflow: 'hidden'});
    const frame = requestAnimationFrame(() => closeRef.current?.focus({preventScroll: true}));
    return () => {
      cancelAnimationFrame(frame);
      Object.assign(body.style, saved);
      window.scrollTo(scrollX, scrollY);
      requestAnimationFrame(() => (triggerRef.current ?? fallbackFocusRef.current)?.focus({preventScroll: true}));
    };
  }, [triggerRef, fallbackFocusRef]);

  return createPortal(<div className="mobile-tools-backdrop" onPointerDown={event => {if (event.target === event.currentTarget) onClose();}}>
    <aside ref={panelRef} id="mobile-tools-drawer" className="mobile-tools-panel" role="dialog" aria-modal="true" aria-labelledby="mobile-tools-title" dir="rtl" style={{...bounds, '--marked-course': MARKED_COURSE_COLOR} as CSSProperties} onKeyDown={event => {
      if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); onClose(); return;}
      if (event.key !== 'Tab') return;
      const elements = [...event.currentTarget.querySelectorAll<HTMLElement>('button,input,summary,a[href]')].filter(el => !el.hasAttribute('disabled') && el.tabIndex >= 0 && el.getClientRects().length > 0);
      const index = elements.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) {event.preventDefault(); elements.at(-1)?.focus();}
      else if (!event.shiftKey && (index < 0 || index === elements.length - 1)) {event.preventDefault(); elements[0]?.focus();}
    }}>
      <header className="mobile-tools-heading"><Settings2 size={20}/><div><h2 id="mobile-tools-title">כלים</h2><p>הקורסים והאפשרויות שלכם</p></div><button ref={closeRef} type="button" aria-label="סגירת הכלים" onClick={onClose}><X size={20}/></button></header>
      <div className="mobile-tools-content">
        <details className="mobile-tools-section" data-tools-section="added">
          <summary aria-label="קורסים שהוספתי" aria-describedby="tools-added-count"><ListPlus size={17}/><strong>קורסים שהוספתי</strong><span className="tools-count" id="tools-added-count">{props.addedCourseIds.length}</span><ChevronDown size={15}/></summary>
          <AddedCoursesContent courses={props.courses} addedCourseIds={props.addedCourseIds} onAddedChange={props.onAddedChange} onLocateCourse={props.onLocateAddedCourse} onNavigate={onClose}/>
        </details>
        <details className="mobile-tools-section" data-tools-section="marked">
          <summary aria-label="רשימת מסומנים" aria-describedby="tools-marked-count"><Check size={17}/><strong>רשימת מסומנים</strong><span className="tools-count" id="tools-marked-count">{props.markedCourseIds.size}</span><ChevronDown size={15}/></summary>
          <MarkedCoursesContent courses={props.courses} addedCourseIds={props.addedCourseIds} markedCourseIds={props.markedCourseIds} visibleCourseIds={props.visibleCourseIds} onAddedChange={props.onAddedChange} onFocusCourse={props.onFocusCourse} onSelectCourse={props.onSelectCourse} onToggleMarked={props.onToggleMarked} onNavigate={onClose}/>
          <button className="tools-clear-marks" type="button" disabled={!props.markedCourseIds.size} onClick={props.onClearMarks}>ניקוי סימונים</button>
        </details>
        <section className="mobile-tools-section tools-display" aria-labelledby="tools-display-title">
          <h3 id="tools-display-title">אפשרויות תצוגה</h3>
          <PrerequisiteHighlightToggle enabled={props.highlightSatisfiedPrerequisites} onChange={props.onHighlightChange}/>
          <div className="tools-branch-actions"><button type="button" onClick={props.onExpandLayer}><Layers size={16}/>עוד שכבה</button><button type="button" onClick={props.onResetBranches}><RotateCcw size={16}/>איפוס ענפים</button></div>
          <div className="tools-legend" aria-label="מקרא"><span><i className="legend-faculty"/>מסגרת: פקולטה</span><span><i className="legend-marked"/>סימון אישי</span><span><i className="legend-node strong"/>קדם חזק</span><span><i className="legend-node concurrent"/>מקצוע צמוד</span></div>
        </section>
        <section className="mobile-tools-section tools-storage" aria-labelledby="tools-storage-title">
          <h3 id="tools-storage-title">שמירה ואיפוס</h3>
          <p className={props.storageAvailable ? 'local-save-status' : 'local-save-status storage-unavailable'} role="status">{props.storageAvailable ? 'ההתקדמות נשמרת בדפדפן הזה' : 'השמירה המקומית אינה זמינה כרגע'}</p>
          <p className="tools-storage-hint">הענפים, ההוספות, המסננים והסימונים נשמרים מקומית. האיפוס מחזיר את מצב ברירת המחדל.</p>
          <button className="tools-reset-progress" type="button" onClick={props.onResetProgress}>איפוס התקדמות שמורה</button>
        </section>
      </div>
    </aside>
  </div>, document.body);
}
