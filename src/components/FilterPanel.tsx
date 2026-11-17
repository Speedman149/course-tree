import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ExternalLink, Filter, RotateCcw, Search, X } from 'lucide-react';
import type { CatalogDataset, CatalogReference, Course, CurriculumRequirement, DegreeCatalog, ProgramCategory } from '../types';
import { facultyColor } from '../lib/faculty-colors';
import { facultyLabels, getCatalogRoles, type FacultyOption } from '../lib/filters';

interface Props {
  faculties: FacultyOption[];
  selected: ReadonlySet<string>;
  onFacultiesChange: (selected: Set<string> | null) => void;
  catalogs: CatalogDataset | null;
  catalogError: boolean;
  activeCatalog: DegreeCatalog | null;
  onCatalogChange: (id: string) => void;
  tab:'faculty'|'catalog';onTabChange:(tab:'faculty'|'catalog')=>void;
  year:string;onYearChange:(year:string)=>void;
  catalogFaculty:string;onCatalogFacultyChange:(id:string)=>void;
  courses: ReadonlyMap<string, Course>;
  onCourseSelect: (course: Course) => void;
  onClose: () => void;
}
const categoryNames: Record<ProgramCategory, string> = {
  standard: 'תואר רגיל', combined: 'תואר משולב', 'dual-major': 'תכנית דו־חוגית',
  'double-degree': 'תואר כפול', concentration: 'מסלול / מגמה / התמחות',
  'additional-degree': 'תואר נוסף', 'teaching-qualification': 'הכשרה להוראה',
};
const programTitle = (catalog: DegreeCatalog) => catalog.track && !catalog.officialName.includes(catalog.track) ? `${catalog.officialName} — ${catalog.track}` : catalog.officialName;
const coverageLabel = (catalog: DegreeCatalog) => catalog.coverage.status === 'inventory-only' ? 'תכנית מתועדת — תכנית הלימודים טרם אומתה' : catalog.coverage.status === 'partial' ? 'מידע חלקי — ראו פרטים' : 'רשימות מפורשות מאומתות';

export default function FilterPanel({ faculties, selected, onFacultiesChange, catalogs, catalogError, activeCatalog, onCatalogChange, tab, onTabChange:setTab, year, onYearChange:setYear, catalogFaculty, onCatalogFacultyChange:setCatalogFaculty, courses, onCourseSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [facultyQuery, setFacultyQuery] = useState('');
  const yearInitialized = useRef(!!activeCatalog || !!catalogs);
  useEffect(() => {
    if (!yearInitialized.current && catalogs) {
      setYear(activeCatalog?.catalogYear ?? catalogs.meta.defaultYear ?? catalogs.meta.years[0] ?? '');
      yearInitialized.current = true;
    }
  }, [catalogs, activeCatalog]);
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('keydown', escape); previous?.focus(); };
  }, [onClose]);
  const coverageStats = catalogs?.meta.coverageStats;
  const facultyName = (id: string) => faculties.find(f => f.id === id)?.label ?? facultyLabels.get(id) ?? (id === 'occupational-therapy' ? 'ריפוי בעיסוק — תכנית משותפת' : id);
  const catalogFaculties = [...new Set(catalogs?.programs.flatMap(program => program.facultyIds) ?? [])].sort((a, b) => facultyName(a).localeCompare(facultyName(b), 'he'));
  const catalogOptions = useMemo(() => (catalogs?.programs ?? []).filter(program => (!year || program.catalogYear === year) && (!catalogFaculty || program.facultyIds.includes(catalogFaculty)) && `${program.officialName} ${program.track ?? ''} ${program.catalogYear} ${categoryNames[program.programCategory ?? 'standard']} ${program.facultyIds.map(id => faculties.find(f => f.id === id)?.label ?? facultyLabels.get(id) ?? '').join(' ')}`.includes(query.trim())), [catalogs, year, catalogFaculty, query, faculties]);
  const baseProgram = (program: DegreeCatalog): DegreeCatalog => {
    const visited = new Set([program.programId]);
    let current = program;
    while (current.parentProgramId && !visited.has(current.parentProgramId)) {
      visited.add(current.parentProgramId);
      const parent = catalogs?.programs.find(candidate => candidate.programId === current.parentProgramId && candidate.catalogYear === program.catalogYear);
      if (!parent) break;
      current = parent;
    }
    return current;
  };
  // Search shows one canonical result; faculty browsing still exposes a shared
  // program under every documented participating faculty.
  const inFacultyGroup = (program: DegreeCatalog, id: string) => program.facultyIds.includes(id) && (!!catalogFaculty || !query.trim() || program.facultyIds[0] === id);
  const renderOption = (program: DegreeCatalog) => <button key={program.id} className={`catalog-option ${activeCatalog?.id === program.id ? 'selected' : ''}`} onClick={() => onCatalogChange(program.id)} aria-pressed={activeCatalog?.id === program.id}>
    <span><strong>{programTitle(program)}</strong><small>{categoryNames[program.programCategory ?? 'standard']} · {program.catalogYear}{program.durationYears ? ` · ${program.durationYears} שנים` : ''}</small><small className={program.coverage.status === 'inventory-only' ? 'catalog-incomplete-label' : ''}>{coverageLabel(program)}</small>{program.facultyIds.length > 1 && <small>משותף: {program.facultyIds.map(facultyName).join(' · ')}</small>}</span>{activeCatalog?.id === program.id ? <Check size={17}/> : <ChevronDown size={14}/>}
  </button>;
  return <div className="filter-overlay" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <aside ref={panelRef} className="filter-panel" role="dialog" aria-modal="true" aria-label="מסנני המפה" dir="rtl" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button,input,select,a[href],summary')).filter(el => !el.hasAttribute('disabled') && el.getClientRects().length > 0);
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <header className="filter-panel-heading"><span className="panel-icon"><Filter size={18}/></span><div><h2>בוחרים מה לגלות</h2><p>סינון קורסי המשך וחיפוש · הקדמים תמיד מלאים</p></div><button className="icon-button" aria-label="סגירת המסננים" onClick={onClose}><X size={18}/></button></header>
      <div className="filter-tabs" role="tablist" aria-label="סוג מסנן"><button role="tab" aria-selected={tab === 'faculty'} aria-controls="faculty-filter-tab" id="faculty-filter-tab-button" onClick={() => setTab('faculty')}>סינון לפי פקולטה <span>{selected.size}/{faculties.length}</span></button><button role="tab" aria-selected={tab === 'catalog'} aria-controls="catalog-filter-tab" id="catalog-filter-tab-button" onClick={() => setTab('catalog')}>קטלוג תואר {activeCatalog && <i/>}</button></div>
      <div className="filter-panel-content">
        {tab === 'faculty' ? <div id="faculty-filter-tab" role="tabpanel" aria-labelledby="faculty-filter-tab-button">
          <p className="filter-explanation">הפקולטה שמציעה את הקורס, לפי נתוני המקור. אפשר לבחור כמה פקולטות ויחידות. שיוכים משותפים, אם תועדו, נבדקים כולם.</p>
          <label className="filter-search"><Search size={15}/><input aria-label="חיפוש פקולטה" placeholder="חיפוש פקולטה או יחידה…" value={facultyQuery} onChange={event => setFacultyQuery(event.target.value)}/></label>
          <div className="faculty-bulk-actions"><button onClick={() => onFacultiesChange(null)}>בחירת הכול</button><button onClick={() => onFacultiesChange(new Set())}>ניקוי הכול</button><button onClick={() => { onFacultiesChange(null); setFacultyQuery(''); }}><RotateCcw size={12}/>איפוס פקולטות</button></div>
          <div className="faculty-checkboxes">{faculties.filter(f => `${f.label} ${f.sourceLabels.join(' ')}`.includes(facultyQuery)).map(faculty => <label key={faculty.id} className="faculty-checkbox"><input type="checkbox" aria-label={faculty.label} checked={selected.has(faculty.id)} onChange={() => { const next = new Set(selected); if (next.has(faculty.id)) next.delete(faculty.id); else next.add(faculty.id); onFacultiesChange(next); }}/><span className="faculty-color-label"><i style={{background:facultyColor(faculty.id)}}/>{faculty.label}</span><small>{faculty.courseCount}</small></label>)}</div>
          {selected.size === 0 && <p className="filter-warning">לא נבחרו פקולטות. קורסי המשך ותוצאות חיפוש מוסתרים; הקדמים ונקודת המוצא נשארים זמינים.</p>}
        </div> : <div id="catalog-filter-tab" role="tabpanel" aria-labelledby="catalog-filter-tab-button">
          <p className="filter-explanation">מסלולים רשמיים מסודרים לפי פקולטה ותכנית בסיס. רשומות שטרם אומתו מסומנות בנפרד; הן אינן מספקות רשימת קורסים מאושרת.</p>
          <button className={`no-catalog-option ${!activeCatalog ? 'selected' : ''}`} onClick={() => onCatalogChange('')}><span>כל המקצועות — ללא סינון לפי קטלוג</span>{!activeCatalog && <Check size={16}/>}</button>
          {catalogs ? <>
            {coverageStats && <div className="filter-warning catalog-data-coverage" aria-label="כיסוי מאגר הקטלוג"><p>שנת הבסיס {catalogs.meta.defaultYear}: {coverageStats.identifiedPaths} מסלולים מתועדים · {coverageStats.partiallyImportedCurricula} ייבואים חלקיים · {coverageStats.inventoryOnlyPaths} רשומות ללא תכנית קורסים.</p><p>{coverageStats.fullyVerifiedCurricula === 0 ? 'טרם הושלם אימות מלא של תכניות הלימודים בשנת הבסיס.' : `${coverageStats.fullyVerifiedCurricula} תכניות אומתו במלואן בשנת הבסיס.`}</p><a className="catalog-source" href={`${import.meta.env.BASE_URL}data/catalog-coverage.json`} download>הורדת דוח הכיסוי (JSON)<ExternalLink size={11}/></a></div>}
            <div className="catalog-selectors"><label>פקולטת התואר<select aria-label="פקולטת התואר" value={catalogFaculty} onChange={event => setCatalogFaculty(event.target.value)}><option value="">כל הפקולטות</option>{catalogFaculties.map(id => <option key={id} value={id}>{facultyName(id)}</option>)}</select></label><label>שנת קטלוג<select aria-label="שנת קטלוג" value={year} onChange={event => setYear(event.target.value)}><option value="">כל השנים</option>{catalogs.meta.years.map(y => <option key={y} value={y}>{y}{catalogs.meta.defaultYear === y ? ' · שנת בסיס' : ''}</option>)}</select></label></div>
            <label className="filter-search"><Search size={15}/><input aria-label="חיפוש תואר" placeholder="חיפוש תואר, מסלול או מגמה…" value={query} onChange={event => setQuery(event.target.value)}/></label>
            <div className="catalog-result-count">{catalogOptions.length} גרסאות תואר נמצאו · תארים משותפים נגישים מכל פקולטה משתתפת</div>
            <div className="catalog-options catalog-hierarchy">{catalogFaculties.filter(id => (!catalogFaculty || catalogFaculty === id) && catalogOptions.some(program => inFacultyGroup(program, id))).map(id => {
              const options = catalogOptions.filter(program => inFacultyGroup(program, id));
              const bases = [...new Map(options.map(program => { const base = baseProgram(program); return [base.programId, base]; })).values()];
              return <details className="catalog-faculty-group" key={id} open={!!query || !!catalogFaculty || !!activeCatalog?.facultyIds.includes(id)}><summary>{facultyName(id)}<span>{options.length}</span></summary>{bases.map(base => {
                const variants = options.filter(program => baseProgram(program).programId === base.programId);
                return <details className="catalog-program-group" key={base.programId} open={!!query || variants.some(program => program.id === activeCatalog?.id)}><summary>{base.officialName}<span>{variants.length}</span></summary>{variants.map(renderOption)}</details>;
              })}</details>;
            })}</div>
            {catalogOptions.length === 0 && <p className="filter-empty">לא נמצאו תארים בסינון הזה. נסו שנה או פקולטה אחרת.</p>}
            {activeCatalog && <CatalogDetails catalog={activeCatalog} dataset={catalogs} courses={courses} onCourseSelect={course => { onCourseSelect(course); onClose(); }}/>}
          </> : <p className="filter-warning">{catalogError ? 'מאגר התארים לא נטען. סינון הפקולטות והמפה הכללית זמינים.' : 'טוענים את מאגר התארים…'}</p>}
        </div>}
      </div>
      <footer className="filter-panel-footer"><p><strong>שילוב המסננים:</strong> קורס צריך להשתייך גם לקטלוג הנבחר וגם לאחת הפקולטות המסומנות. חקירת קדמים אחורה אינה מסוננת.</p><button className="modal-primary" onClick={onClose}><Check size={15}/>הצגת המפה</button></footer>
    </aside>
  </div>;
}

function CatalogDetails({ catalog, dataset, courses, onCourseSelect }: { catalog: DegreeCatalog; dataset: CatalogDataset; courses: ReadonlyMap<string, Course>; onCourseSelect: (course: Course) => void }) {
  const [courseQuery, setCourseQuery] = useState('');
  useEffect(() => setCourseQuery(''), [catalog.id]);
  const eligibleCourses = useMemo(() => catalog.coverage.status === 'inventory-only' ? [] : [...courses.values()].filter(course => getCatalogRoles(course.id, catalog, courses).length > 0).sort((a, b) => a.id.localeCompare(b.id)), [catalog, courses]);
  const explicitIds = useMemo(() => new Set([...catalog.mandatoryCourseIds, ...catalog.additionalEligibleCourseIds, ...catalog.electiveGroups.flatMap(group => group.courseIds)]), [catalog]);
  const query = courseQuery.trim().toLocaleLowerCase('he');
  const matchingCourses = eligibleCourses.filter(course => `${course.id} ${course.name} ${course.aliases?.join(' ') ?? ''}`.toLocaleLowerCase('he').includes(query));
  const sourceLink = (ref: CatalogReference) => { const source = dataset.sources.find(s => s.id === ref.sourceId); return source ? `${source.url}#page=${ref.pages[0] ?? 1}` : undefined; };
  const pageLabel = (ref: CatalogReference) => `עמוד PDF ${ref.pages.join(', ')}${ref.printedPages?.length ? ` · עמוד מודפס ${ref.printedPages.join(', ')}` : ''}`;
  const list = (ids: string[], refs: CatalogReference[]) => <div className="catalog-course-list">{ids.map(id => <a key={id} href={courses.get(id)?.source.url ?? (refs[0] ? sourceLink(refs[0]) : undefined)} target="_blank" rel="noopener noreferrer"><span dir="ltr">{id}</span><span>{courses.get(id)?.name ?? 'קורס המופיע בקטלוג; פרטי קדמים אינם במאגר'}</span></a>)}</div>;
  return <section className="catalog-details" aria-label="פרטי הקטלוג הנבחר"><h3>{programTitle(catalog)}</h3><p className="catalog-program-metadata">{categoryNames[catalog.programCategory ?? 'standard']} · {catalog.catalogYear}{catalog.durationYears ? ` · ${catalog.durationYears} שנים` : ''}</p>{catalog.qualificationAwarded?.length ? <p className="catalog-note">הסמכה: {catalog.qualificationAwarded.join(' · ')}</p> : null}
    <p className="catalog-coverage">{coverageLabel(catalog)}</p>
    {catalog.coverage.status === 'inventory-only' && <p className="filter-warning" role="status">התכנית מופיעה במקור הרשמי, אך דרישות החובה והבחירה שלה טרם יובאו ואומתו. בחירתה משאירה את נקודת המוצא והקדמים זמינים, ואינה מציגה קורסי המשך כאילו הוכרה זכאותם.</p>}
    {catalog.coverage.notes.map((note, i) => <p className="catalog-note" key={i}>{note}</p>)}
    {(catalog.coverage.mandatoryComplete !== undefined || catalog.coverage.electivesComplete !== undefined) && <p className="catalog-note">חובה: {catalog.coverage.mandatoryComplete ? 'יובאה במלואה' : 'טרם הושלמה'} · בחירה: {catalog.coverage.electivesComplete ? 'יובאה במלואה' : 'טרם הושלמה'}{catalog.coverage.visuallyVerified ? ' · טבלאות נבדקו חזותית' : ''}</p>}
    {catalog.coverage.status !== 'inventory-only' && <>
      <details className="program-course-browser" open><summary>קורסים בתכנית הזו <span>{eligibleCourses.length}</span></summary><p className="catalog-note">כל הקורסים הידועים ברשימות ובכללים שניתן לבדוק, ללא תלות בפקולטות המסומנות או בהגעה אליהם מנקודת המוצא. בחירת קורס הופכת אותו לנקודת המוצא.</p><label className="filter-search"><Search size={15}/><input aria-label="חיפוש קורסים בתכנית" placeholder="מספר או שם קורס…" value={courseQuery} onChange={event => setCourseQuery(event.target.value)}/></label><p className="catalog-result-count">{matchingCourses.length} קורסים נמצאו</p><div className="program-courses" role="list" aria-label="קורסים בתכנית">{matchingCourses.map(course => <div className="program-course-row" key={course.id} role="listitem"><button aria-label={`בחירת ${course.id} כנקודת מוצא`} onClick={() => onCourseSelect(course)}><span dir="ltr">{course.id}</span><strong>{course.name}</strong><small>{course.credits !== undefined ? `${course.credits} נק׳ · ` : ''}{explicitIds.has(course.id) ? 'רשימה מפורשת' : 'לפי כלל זכאות מתועד'}</small></button><a href={course.source.url} target="_blank" rel="noopener noreferrer" aria-label={`מידע רשמי על ${course.id}`} title="מידע רשמי על הקורס"><ExternalLink size={13}/></a></div>)}</div>{matchingCourses.length === 0 && <p className="filter-empty">אין קורסים התואמים לחיפוש ברשימות המיובאות.</p>}</details>
      <details><summary>חובה מפורשת <span>{catalog.mandatoryCourseIds.length}</span></summary>{list(catalog.mandatoryCourseIds, catalog.sourceRefs)}</details>
      {catalog.electiveGroups.map(group => <details key={group.id}><summary>{group.name}<span>{group.courseIds.length}{group.rules.some(r => r.automatic) ? ' + כלל' : ''}</span></summary>{group.creditsMin !== undefined && <p>מינימום {group.creditsMin} נקודות, בכפוף לתנאי הקבוצה.</p>}{group.minimumCourses !== undefined && <p>לפחות {group.minimumCourses} קורסים.</p>}{group.maximumCredits !== undefined && <p>לכל היותר {group.maximumCredits} נקודות.</p>}{group.requiredCourseIds?.length ? <p>קורסים מחייבים בתוך הקבוצה: {group.requiredCourseIds.join(', ')}</p> : null}{group.conditions.map((condition, i) => <p key={i}>{condition}</p>)}{group.rules.map(rule => <p className="catalog-rule" key={rule.id}>{rule.description}{!rule.automatic && ' · כלל פתוח: אינו מוסיף קורסים אוטומטית למסנן.'}{rule.sourceUrls?.map(url => <a className="catalog-source" key={url} href={url} target="_blank" rel="noopener noreferrer">פרסום רשמי נוסף<ExternalLink size={11}/></a>)}</p>)}{list(group.courseIds, group.sourceRefs)}{group.sourceRefs.map((ref, i) => <a className="catalog-source" href={sourceLink(ref)} key={i} target="_blank" rel="noopener noreferrer">מקור רשמי · {pageLabel(ref)}<ExternalLink size={11}/></a>)}</details>)}
    </>}
    {!!catalog.requirementRules?.length && <details><summary>דרישות השלמת התכנית<span>{catalog.requirementRules.length}</span></summary><p className="catalog-note">כללי התואר נפרדים מדרישות הקדם של קורס בודד. התצוגה אינה מחשבת השלמת תואר.</p><ul className="curriculum-requirements">{catalog.requirementRules.map((requirement, i) => <li key={requirement.id ?? i}><RequirementDetails requirement={requirement} catalog={catalog}/></li>)}</ul></details>}
    {catalog.sourceRefs.map((ref, i) => <a className="catalog-source" key={i} href={sourceLink(ref)} target="_blank" rel="noopener noreferrer">הקטלוג הרשמי · {catalog.catalogYear} · {pageLabel(ref)}{ref.section ? ` · ${ref.section}` : ''}<ExternalLink size={12}/></a>)}
    <p className="catalog-note">שנת הקטלוג קובעת את רשימות התואר. קדמי הקורסים נשארים לפי רשומת הקורס העדכנית במאגר; אין כאן בדיקת זכאות לרישום או לסיום תואר.</p>
  </section>;
}

function RequirementDetails({ requirement, catalog }: { requirement: CurriculumRequirement; catalog: DegreeCatalog }) {
  let content;
  switch (requirement.type) {
    case 'course': content = <span dir="ltr">{requirement.courseId}</span>; break;
    case 'group': content = <span>{catalog.electiveGroups.find(group => group.id === requirement.groupId)?.name ?? requirement.groupId}</span>; break;
    case 'condition': content = <>{requirement.text}{requirement.requirement && <div><RequirementDetails requirement={requirement.requirement} catalog={catalog}/></div>}</>; break;
    case 'substitution': content = <>{requirement.originalCourseIds.join(' + ')} ← {requirement.replacementCourseIds.join(' + ')}{requirement.description ? ` · ${requirement.description}` : ''}</>; break;
    default: content = <>{requirement.type === 'all' ? 'יש להשלים את כל הדרישות:' : requirement.type === 'any' ? 'יש לבחור חלופה אחת:' : `בחירה לפי התנאים${requirement.minimumCourses !== undefined ? ` · לפחות ${requirement.minimumCourses} קורסים` : ''}${requirement.minimumCredits !== undefined ? ` · לפחות ${requirement.minimumCredits} נקודות` : ''}${requirement.maximumCredits !== undefined ? ` · עד ${requirement.maximumCredits} נקודות` : ''}`}<ul>{requirement.items.map((item, i) => <li key={item.id ?? i}><RequirementDetails requirement={item} catalog={catalog}/></li>)}</ul></>;
  }
  return <>{requirement.label && <strong>{requirement.label}: </strong>}{content}</>;
}