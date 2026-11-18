import { officialSourceURL } from '../lib/urls';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowLeft, BookOpen, Search, X } from 'lucide-react';
import {courseAppearance} from '../lib/faculty-colors';
import type { Course } from '../types';

interface CourseSearchProps {
  courses: Course[];
  allCourses?: Course[];
  onSelect: (course: Course) => void;
  disabled?: boolean;
  filtered?: boolean;
  searchAll:boolean;
  onSearchAllChange:(all:boolean)=>void;
}

interface IndexedCourse {
  course: Course;
  numbers: string[];
  normalizedNumbers: string[];
  name: string;
  text: string;
}

function normalizeText(value: string) {
  return value.normalize('NFKD').replace(/[\u0591-\u05C7]/g, '').toLocaleLowerCase('he').replace(/[״"׳']/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeNumber(value: string) {
  return value.replace(/^0+(?=\d)/, '');
}

export default function CourseSearch({ courses, allCourses, onSelect, disabled = false, filtered = false, searchAll, onSearchAllChange }: CourseSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const allScope = filtered && searchAll && !!allCourses;
  const searchCourses = filtered && searchAll && allCourses ? allCourses : courses;
  const visibleIds = useMemo(() => new Set(courses.map(course => course.id)), [courses]);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const componentId = useId();
  const listId = `${componentId}-courses`;

  const index = useMemo<IndexedCourse[]>(() => searchCourses.map((course) => {
    const numbers = [...new Set([course.id, ...(course.aliases ?? [])])];
    return {
      course,
      numbers,
      normalizedNumbers: numbers.map(normalizeNumber),
      name: normalizeText(course.name),
      text: normalizeText(`${course.name} ${course.faculty}`),
    };
  }), [searchCourses]);

  const results = useMemo(() => {
    const value = normalizeText(query);
    if (!value) {
      const intro = index.find((entry) => entry.numbers.includes('02340114') || entry.numbers.includes('234114'));
      return [...(intro ? [intro.course] : []), ...index.filter((entry) => entry !== intro).slice(0, 5).map((entry) => entry.course)];
    }
    const numberQuery = /^[\d\s-]+$/.test(value);
    const digits = value.replace(/\D/g, '');
    const normalized = normalizeNumber(digits);
    const tokens = value.split(' ');
    const ranked: { course: Course; rank: number }[] = [];
    for (const entry of index) {
      let rank = -1;
      if (numberQuery) {
        if (entry.numbers.includes(digits)) rank = 0;
        else if (entry.normalizedNumbers.includes(normalized)) rank = 1;
        else if (entry.numbers.some((number) => number.startsWith(digits))) rank = 2;
        else if (entry.normalizedNumbers.some((number) => number.startsWith(normalized))) rank = 3;
        else if (entry.numbers.some((number) => number.includes(digits))) rank = 4;
      } else if (entry.name === value) rank = 0;
      else if (entry.name.startsWith(value)) rank = 1;
      else if (entry.name.includes(value)) rank = 2;
      else if (tokens.every((token) => entry.text.includes(token))) rank = 3;
      if (rank !== -1) ranked.push({ course: entry.course, rank });
    }
    return ranked.sort((a, b) => a.rank - b.rank || a.course.name.localeCompare(b.course.name, 'he')).slice(0, 30).map(({ course }) => course);
  }, [index, query]);

  useEffect(() => { setActiveIndex(0); }, [query, index]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onFocusIn(event: FocusEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, []);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-result-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function select(course: Course) {
    onSelect(course);
    setQuery('');
    setOpen(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { setOpen(true); setActiveIndex(0); return; }
      setActiveIndex((previous) => results.length ? (previous + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length : 0);
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (results[activeIndex]) select(results[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'Tab' && (!filtered || !allCourses)) setOpen(false);
  }

  return (
        <div className={`search-container${open ? ' search-is-open' : ''}`} ref={rootRef} dir="rtl" onKeyDown={event => {
      if (event.key === 'Escape' && event.target !== inputRef.current) {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(false);
      }
    }}>
      <div className="search-field">
        <Search className="search-icon" size={19} aria-hidden="true" />
        <input
          ref={inputRef}
          className="search-input" maxLength={1000}
          type="text"
          role="combobox"
          aria-label="חיפוש קורס לפי מספר או שם"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && results[activeIndex] ? `${componentId}-option-${activeIndex}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="חפשו קורס לפי מספר או שם…"
          value={query}
          disabled={disabled}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {query ? (
          <button className="search-clear" type="button" aria-label="ניקוי החיפוש" onClick={() => { setQuery(''); setOpen(true); inputRef.current?.focus(); }}>
            <X size={15} aria-hidden="true" />
          </button>
        ) : <span className="search-hint" aria-hidden="true">מספר / שם</span>}
      </div>
      {open && !disabled && (
        <div className="search-dropdown">
          <div className="search-heading">{query.trim() ? 'תוצאות חיפוש' : 'בחרו נקודת התחלה'}<span>{allScope ? 'כל הקורסים · המסננים נשמרים' : filtered ? 'לפי המסננים הפעילים' : 'כל הפקולטות'}</span></div>
          {filtered && allCourses && <div className="search-scope-control"><button type="button" className="search-scope-toggle" aria-pressed={searchAll} onClick={() => { onSearchAllChange(!searchAll); inputRef.current?.focus(); }}>חיפוש בכל הקורסים</button><p>{allScope ? 'בחירת נקודת מוצא אינה משנה את המסננים.' : 'אפשר לבחור גם נקודת מוצא מחוץ למסננים.'}</p></div>}
          <div id={listId} ref={listRef} className="search-results" role="listbox" aria-label="קורסים">
            {results.map((course, position) => (
              <div
                key={course.id}
                id={`${componentId}-option-${position}`}
                role="option"
                aria-selected={position === activeIndex}
                data-result-index={position}
                className={`search-result${position === activeIndex ? ' search-result-active' : ''}`}
                onMouseEnter={() => setActiveIndex(position)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(course)}
              >
                <span className="search-result-icon" style={{color:courseAppearance(course).accent}}><BookOpen size={17} aria-hidden="true" /></span>
                <span className="search-result-content"><span className="search-result-name">{course.name}</span><span className="search-result-faculty">{course.faculty}</span>{allScope && !visibleIds.has(course.id) && <span className="search-result-outside-filter">מחוץ לסינון · יוצג כנקודת מוצא</span>}</span>
                <a className="search-result-number" dir="ltr" href={officialSourceURL(course.source.url)} target="_blank" rel="noopener noreferrer" aria-label={`פרטי קורס ${course.id} בקטלוג`} onClick={event => event.stopPropagation()}>{course.id}</a>
                <ArrowLeft className="search-result-arrow" size={15} aria-hidden="true" />
              </div>
            ))}
          </div>
          {!results.length && <div className="search-empty"><Search size={24} aria-hidden="true" /><strong>לא נמצאו קורסים</strong><span>{filtered && !allScope ? 'אין קורסים מתאימים למסננים. אפשר לחפש בכל הקורסים או לנסות חיפוש אחר.' : 'נסו מספר קורס אחר או חלק מהשם בעברית.'}</span></div>}
          <div className="search-footer"><span>בחירת קורס תפתח מפה חדשה</span><span className="search-keyboard-hint">↑ ↓ לניווט · Enter לבחירה</span></div>
        </div>
      )}
      <span className="search-sr-only" role="status" aria-live="polite">{open && query.trim() ? `${results.length}${results.length === 30 ? ' או יותר' : ''} קורסים נמצאו` : ''}</span>
    </div>
  );
}
