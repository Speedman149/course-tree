import {useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Check, Focus, GitBranch, ListPlus, Plus, Search, X} from 'lucide-react';
import {courseAppearance} from '../lib/faculty-colors';
import {creditTotalFormat, summarizeMarkedCredits} from '../lib/marked-credits';
import type {Course} from '../types';

interface PopoverProps {
  label: string;
  title: string;
  trigger: ReactNode;
  triggerClassName?: string;
  preferUp?: boolean;
  onOpen?: () => void;
  children: (close: () => void) => ReactNode;
}

/** A nonmodal, viewport-clamped menu that leaves outside graph interactions usable. */
function CollectionPopover({label, title, trigger, triggerClassName = '', preferUp = false, onOpen, children}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus({preventScroll: true}));
  };

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const viewLeft = viewport?.offsetLeft ?? 0;
      const viewTop = viewport?.offsetTop ?? 0;
      const viewWidth = viewport?.width ?? window.innerWidth;
      const viewHeight = viewport?.height ?? window.innerHeight;
      const margin = 10;
      const gap = 7;
      const right = viewLeft + viewWidth - margin;
      const bottom = viewTop + viewHeight - margin;
      const width = Math.max(0, Math.min(430, viewWidth - margin * 2));
      const left = Math.max(viewLeft + margin, Math.min(rect.right - width, right - width));
      const above = Math.max(0, Math.min(rect.top - gap, bottom) - viewTop - margin);
      const below = Math.max(0, bottom - Math.max(rect.bottom + gap, viewTop + margin));
      const upward = preferUp ? above >= Math.min(180, below) : below < 180 && above > below;
      const maxHeight = Math.max(0, Math.min(440, upward ? above : below));
      setPosition({
        left,
        width,
        maxHeight,
        ...(upward
          ? {bottom: window.innerHeight - Math.min(rect.top - gap, bottom)}
          : {top: Math.max(viewTop + margin, rect.bottom + gap)}),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [open, preferUp]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('input,button')?.focus({preventScroll: true}));
    const outside = (event: Event) => {
      if (!panelRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return <span className="collection-control">
    <button
      ref={triggerRef}
      className={triggerClassName}
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      onClick={() => {
        if (open) close();
        else { onOpen?.(); setOpen(true); }
      }}
    >{trigger}</button>
    {open && createPortal(<div
      ref={panelRef}
      id={panelId}
      className="course-collection-popover nodrag nopan nowheel"
      role="dialog"
      aria-label={label}
      dir="rtl"
      style={position}
      onPointerDown={event => event.stopPropagation()}
      onWheel={event => event.stopPropagation()}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <div className="collection-heading"><strong>{title}</strong><button type="button" aria-label={`סגירת ${label}`} onClick={close}><X size={16}/></button></div>
      {children(close)}
    </div>, document.body)}
  </span>;
}

function focusAfterRowRemoval(button: HTMLButtonElement) {
  const row = button.closest('.collection-row');
  const panel = button.closest('.course-collection-popover');
  const nextRow = row?.nextElementSibling ?? row?.previousElementSibling;
  requestAnimationFrame(() => {
    const nextButton = nextRow?.isConnected ? nextRow.querySelector<HTMLElement>('button:not(:disabled)') : null;
    const closeButton = panel?.isConnected ? panel.querySelector<HTMLElement>('.collection-heading button') : null;
    (nextButton ?? closeButton)?.focus({preventScroll: true});
  });
}

export interface AddedCoursesMenuProps {
  courses: ReadonlyMap<string, Course>;
  addedCourseIds: readonly string[];
  onAddedChange: (courseId: string, added: boolean) => void;
  onLocateCourse: (courseId: string) => void;
}

export function AddedCoursesMenu({courses, addedCourseIds, onAddedChange, onLocateCourse}: AddedCoursesMenuProps) {
  const [query, setQuery] = useState('');
  const filteredIds = useMemo(() => {
    const search = normalizeListQuery(query);
    return !search ? addedCourseIds : addedCourseIds.filter(id => {
      const course = courses.get(id);
      return normalizeListQuery(`${id} ${course?.name ?? ''} ${course?.aliases?.join(' ') ?? ''}`).includes(search);
    });
  }, [addedCourseIds, query, courses]);
  return <CollectionPopover label="קורסים שהוספתי" title={`קורסים שהוספתי (${addedCourseIds.length})`}
    preferUp trigger={<><ListPlus size={13}/><span>קורסים שהוספתי ({addedCourseIds.length})</span></>}
    triggerClassName="added-courses-trigger" onOpen={() => setQuery('')}>
    {close => <>
      {addedCourseIds.length > 6 && <label className="collection-search"><Search size={14}/><input aria-label="חיפוש בקורסים שהוספתי" placeholder="מספר או שם קורס…" value={query} maxLength={1000} onChange={event => setQuery(event.target.value)}/></label>}
      <div className="collection-rows" role="list" aria-label="הקורסים שהוספתי לעץ">
        {filteredIds.map(id => <div className="collection-row added-course-row" key={id} data-added-course={id} role="listitem">
          <button className="collection-course-main" type="button" aria-label={`מיקוד בקורס שהוספתי ${id}`} title="הצגת החיבור ומיקוד בקורס" onClick={() => {close(); onLocateCourse(id);}}>
            <Focus size={14}/><span><strong>{courses.get(id)?.name ?? 'קורס ללא פרטים במאגר'}</strong><small dir="ltr">{id}</small></span>
          </button>
          <div className="collection-row-actions"><button type="button" aria-label={`הסר מהעץ ${id}`} title="הסר מהעץ" onClick={event => {focusAfterRowRemoval(event.currentTarget); onAddedChange(id, false);}}><X size={15}/></button></div>
        </div>)}
        {!addedCourseIds.length && <p className="collection-empty">עדיין לא הוספתם קורסים לעץ</p>}
        {addedCourseIds.length > 0 && !filteredIds.length && <p className="collection-empty">לא נמצאו קורסים המתאימים לחיפוש</p>}
      </div>
      {addedCourseIds.length > 0 && <p className="collection-hint">הסרה מהרשימה משאירה קורסים הנחוצים לעץ ולחקירה הנוכחית.</p>}
    </>}
  </CollectionPopover>;
}

export interface MarkedCoursesMenuProps {
  courses: ReadonlyMap<string, Course>;
  markedCourseIds: ReadonlySet<string>;
  addedCourseIds: readonly string[];
  visibleCourseIds: ReadonlySet<string>;
  onAddedChange: (courseId: string, added: boolean) => void;
  onFocusCourse: (courseId: string) => void;
  onSelectCourse: (courseId: string) => void;
  onToggleMarked: (courseId: string) => void;
}

function normalizeListQuery(value: string) {
  return value.normalize('NFKD').replace(/[\u0591-\u05C7]/g, '').toLocaleLowerCase('he').replace(/[״"׳']/g, '').trim();
}

export function MarkedCoursesMenu({courses, markedCourseIds, addedCourseIds, visibleCourseIds, onAddedChange, onFocusCourse, onSelectCourse, onToggleMarked}: MarkedCoursesMenuProps) {
  const [query, setQuery] = useState('');
  const addedIds = useMemo(() => new Set(addedCourseIds), [addedCourseIds]);
  const orderedIds = useMemo(() => [...markedCourseIds].reverse(), [markedCourseIds]);
  const {knownCredits, missingCreditCount} = useMemo(() => summarizeMarkedCredits(courses, markedCourseIds), [courses, markedCourseIds]);
  const filteredIds = useMemo(() => {
    const search = normalizeListQuery(query);
    if (!search) return orderedIds;
    return orderedIds.filter(id => {
      const course = courses.get(id);
      return normalizeListQuery(`${id} ${course?.name ?? ''} ${course?.aliases?.join(' ') ?? ''} ${course?.faculty ?? ''}`).includes(search);
    });
  }, [orderedIds, query, courses]);

  return <CollectionPopover
    label="רשימת מסומנים"
    title={`רשימת מסומנים (${markedCourseIds.size})`}
    preferUp
    trigger={<><Check size={12}/><span>רשימת מסומנים</span></>}
    triggerClassName="marked-courses-trigger"
    onOpen={() => {setQuery('');}}
  >{close => <>
    <div className="marked-credit-summary" role="status" aria-atomic="true">
      <strong>{missingCreditCount ? 'נק״ז ידוע:' : 'סה״כ נק״ז:'} <bdi dir="ltr">{creditTotalFormat.format(knownCredits)}</bdi></strong>
      {missingCreditCount > 0 && <small>(ל־{missingCreditCount} מקצועות חסר נתון נק״ז)</small>}
    </div>
    {orderedIds.length > 6 && <label className="collection-search"><Search size={14}/><input aria-label="חיפוש ברשימת מסומנים" placeholder="מספר או שם מקצוע…" value={query} maxLength={1000} onChange={event => setQuery(event.target.value)}/></label>}
    <div className="collection-rows" role="list" aria-label="המקצועות המסומנים">
      {filteredIds.map(id => {
        const course = courses.get(id);
        const visible = visibleCourseIds.has(id);
        const added = addedIds.has(id);
        return <div className="collection-row marked-course-row" key={id} data-marked-course={id} role="listitem">
          <button className="collection-course-main" type="button" disabled={!visible} aria-label={`מיקוד במקצוע מסומן ${id}`} title={visible ? 'מיקוד במקצוע במפה' : 'המקצוע אינו מוצג כרגע. אפשר להוסיף לעץ או לפתוח עץ חדש.'} onClick={() => {if (visible) {close(); onFocusCourse(id);}}}>
            <span className="collection-mark"><Check size={12}/></span>
            <span><strong>{course?.name ?? 'קורס ללא פרטים במאגר'}</strong><small><b dir="ltr">{id}</b>{course && <span> · {courseAppearance(course).label}</span>}</small></span>
            {visible && <Focus className="collection-locate-icon" size={13}/>}
          </button>
          <div className="collection-row-actions">
            <button className={added ? 'collection-add active' : 'collection-add'} type="button" aria-label={`${added ? 'הסר מהעץ' : 'הוסף לעץ'} ${id}`} aria-pressed={added} title={added ? 'הסר מהעץ' : 'הוסף לעץ'} onClick={() => {
              onAddedChange(id, !added);
            }}>{added ? <Check size={15}/> : <Plus size={15}/>}</button>
            <button type="button" aria-label={`פתיחת עץ חדש עם ${id}`} title="פתח עץ חדש" onClick={() => {close(); onSelectCourse(id);}}><GitBranch size={15}/></button>
            <button className="collection-unmark" type="button" aria-label={`הסרת סימון של ${id}`} title="הסרת סימון" onClick={event => {focusAfterRowRemoval(event.currentTarget); onToggleMarked(id);}}><X size={15}/></button>
          </div>
        </div>;
      })}
      {!orderedIds.length && <p className="collection-empty">אין מקצועות מסומנים עדיין</p>}
      {orderedIds.length > 0 && !filteredIds.length && <p className="collection-empty">לא נמצאו מקצועות מסומנים המתאימים לחיפוש</p>}
    </div>
  </>}</CollectionPopover>;
}
