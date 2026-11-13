import { useCallback, useEffect, useMemo, useState } from 'react';
import { Background, BackgroundVariant, MarkerType, ReactFlow, useReactFlow, useViewport, type Edge } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import { ArrowDownLeft, ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, CircleHelp, Database, ExternalLink, Focus, GitBranch, GraduationCap, Layers, LoaderCircle, Minus, MousePointer2, Move, Plus, RotateCcw, ShieldCheck, Sparkles, X } from 'lucide-react';
import CourseSearch from './components/CourseSearch';
import CourseNode, { CourseLink, ExplorerContext, RequirementExpression, type CourseFlowNode } from './components/CourseNode';
import { buildCourseIndex, buildDependents, buildGraph, collectRequirements } from './lib/graph';
import type { Course, CourseDataset } from './types';

const nodeTypes = { course: CourseNode };
const WIDTH = 286;
const HEIGHT = 168;

export default function App() {
  const [dataset, setDataset] = useState<CourseDataset | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [rootId, setRootId] = useState('02340114');
  const [expandedForward, setExpandedForward] = useState(new Set(['root']));
  const [expandedBackward, setExpandedBackward] = useState(new Map<string, Set<string>>());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [modal, setModal] = useState<'help' | 'data' | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [fitRequested, setFitRequested] = useState(0);
  const [rootViewVersion, setRootViewVersion] = useState(0);
  const [branchFocus, setBranchFocus] = useState<{id:string;direction:'forward'|'backward';courseId?:string;version:number}|null>(null);
  const { fitView, zoomIn, zoomOut, setCenter } = useReactFlow<CourseFlowNode>();
  const { zoom } = useViewport();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/courses.json`, { signal: controller.signal }).then(res => {
      if (!res.ok) throw new Error(`Data HTTP ${res.status}`);
      return res.json();
    }).then((data: CourseDataset) => {
      if (!Array.isArray(data.courses) || !data.courses.length) throw new Error('Empty course dataset');
      setDataset(data);
      const initial = data.courses.find(c => c.id === '02340114' || c.aliases?.includes('234114')) ?? data.courses[0];
      const urlRoot = new URLSearchParams(window.location.search).get('course');
      setRootId(data.courses.find(c => c.id === urlRoot || c.aliases?.includes(urlRoot ?? ''))?.id ?? initial.id);
    }).catch(error => { if (error.name !== 'AbortError') setLoadError(true); });
    return () => controller.abort();
  }, []);

  const courses = dataset?.courses ?? [];
  const index = useMemo(() => buildCourseIndex(courses), [courses]);
  const dependents = useMemo(() => buildDependents(courses), [courses]);
  const root = index.get(rootId);
  const prerequisites = collectRequirements(root?.requirements);
  const successors = dependents.get(rootId) ?? [];
  const graph = useMemo(() => buildGraph(rootId, index, dependents, expandedForward, expandedBackward), [rootId, index, dependents, expandedForward, expandedBackward]);
  const positions = useMemo(() => {
    const layout = new dagre.graphlib.Graph();
    layout.setGraph({ rankdir: 'RL', ranksep: 110, nodesep: 36, marginx: 50, marginy: 50 });
    layout.setDefaultEdgeLabel(() => ({}));
    graph.nodes.forEach(node => layout.setNode(node.id, { width: WIDTH, height: HEIGHT }));
    graph.edges.forEach(edge => layout.setEdge(edge.source, edge.target));
    dagre.layout(layout);
    return new Map(graph.nodes.map(node => { const p = layout.node(node.id); return [node.id, { x: p.x - WIDTH / 2, y: p.y - HEIGHT / 2 }]; }));
  }, [graph]);
  const nodes: CourseFlowNode[] = useMemo(() => graph.nodes.map(node => ({ id: node.id, type: 'course', position: positions.get(node.id)!, data: { graphNode: node }, draggable: false, zIndex: node.id === hoveredId ? 1000 : node.direction === 'root' ? 2 : 1 })), [graph, positions, hoveredId]);
  const edges: Edge[] = useMemo(() => graph.edges.map(edge => ({
    ...edge, type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: edge.direction === 'backward' ? '#65a99a' : '#b5add7' },
    style: { stroke: edge.direction === 'backward' ? '#65a99a' : '#b5add7', strokeWidth: 1.6, strokeDasharray: edge.direction === 'backward' ? '5 5' : undefined },
    pathOptions: { borderRadius: 16 },
  })), [graph]);

  useEffect(() => {
    if (!dataset) return;
    // Start centered on the root at a readable scale, even for broad courses.
    const frame = requestAnimationFrame(() => {
      const p = positions.get('root');
      const container = document.querySelector('.graph-canvas')?.getBoundingClientRect();
      if (p && container) setCenter(p.x + WIDTH / 2 - container.width * 0.23, p.y + HEIGHT / 2, { zoom: container.width < 600 ? 0.75 : 0.9, duration: 450 });
    });
    return () => cancelAnimationFrame(frame);
  }, [dataset, rootId, rootViewVersion]);
  useEffect(() => {
    if (!branchFocus) return;
    const focused = graph.nodes.filter(node => node.id === branchFocus.id || (node.parentId === branchFocus.id && node.direction === branchFocus.direction && (!branchFocus.courseId || node.courseId === branchFocus.courseId)));
    const frame = requestAnimationFrame(() => fitView({ nodes: focused.map(node => ({ id: node.id })), padding: 0.25, minZoom: 0.25, maxZoom: 0.95, duration: 400 }));
    return () => cancelAnimationFrame(frame);
  }, [branchFocus, fitView]);
  useEffect(() => { if (fitRequested) requestAnimationFrame(() => fitView({ padding: 0.18, maxZoom: 1, duration: 450 })); }, [fitRequested, fitView]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setModal(null); };
    const frame = requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.modal-close')?.focus());
    document.addEventListener('keydown', escape);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', escape); previous?.focus(); };
  }, [modal]);

  const selectRoot = useCallback((course: Course) => {
    setRecent(previous => [rootId, ...previous.filter(id => id !== rootId && id !== course.id)].slice(0, 4));
    setRootId(course.id);
    setRootViewVersion(previous => previous + 1);
    setExpandedForward(new Set(['root']));
    setExpandedBackward(new Map());
    setHoveredId(null);
    const url = new URL(window.location.href);
    url.searchParams.set('course', course.id);
    window.history.replaceState({}, '', url);
  }, [rootId]);
  const toggleForward = useCallback((id: string) => {
    const next = new Set(expandedForward);
    if (next.has(id)) next.delete(id);
    else { next.add(id); setBranchFocus(previous => ({ id, direction: 'forward', version: (previous?.version ?? 0) + 1 })); }
    setExpandedForward(next);
  }, [expandedForward]);
  const toggleBackward = useCallback((id: string, courseId: string) => {
    const next = new Map(expandedBackward); const selected = new Set(next.get(id));
    if (selected.has(courseId)) selected.delete(courseId);
    else { selected.add(courseId); setBranchFocus(previous => ({ id, courseId, direction: 'backward', version: (previous?.version ?? 0) + 1 })); }
    next.set(id, selected); setExpandedBackward(next);
  }, [expandedBackward]);
  const resetBranches = () => { setExpandedForward(new Set(['root'])); setExpandedBackward(new Map()); setRootViewVersion(previous => previous + 1); };
  const facultyCount = new Set(courses.map(c => c.faculty)).size;
  const knownCount = courses.filter(c => c.requirementsStatus === 'known' || c.requirementsStatus === 'none').length;
  const termLabel = (term: string | undefined) => term ? term.replace('_', ' · ') : 'מקור הקורס';

  return <div className="app-shell" dir="rtl">
    <header className="app-header">
      <a className="brand" href={window.location.pathname} aria-label="מפת הקורסים — לדף הבית"><span className="brand-mark"><GitBranch size={24}/></span><span><strong>מפת הקורסים<span className="brand-dot">.</span></strong><small>לגלות לאן אפשר להמשיך</small></span></a>
      <CourseSearch courses={courses} disabled={!dataset} onSelect={selectRoot}/>
      <div className="header-actions"><span className="technion-tag"><GraduationCap size={19}/>הטכניון</span><span className="header-divider"/><button className="help-button" onClick={() => setModal('help')}><CircleHelp size={18}/><span>איך זה עובד?</span></button></div>
    </header>

    <main className="workspace">
      <aside className="sidebar">
        <div className="sidebar-intro"><span className="eyebrow"><span/>מגלים את התמונה הגדולה</span><h1>קורס אחד.<br/>הרבה אפשרויות.</h1><p>חקרו את הקשרים בין הקורסים ובנו לעצמכם תמונה של הדרך קדימה.</p></div>
        <div className="sidebar-section-label">נקודת המוצא שלכם <span className="status-dot"/></div>
        <div className="root-summary"><span className="root-summary-icon"><BookOpen size={21}/></span>{root ? <><CourseLink course={root} id={root.id}/><h2>{root.name}</h2><p>{root.faculty}{root.credits !== undefined ? ` · ${root.credits} נקודות זכות` : ''}</p></> : <div className="skeleton skeleton-root"/>}<div className="root-summary-stats"><div><strong>{successors.length}</strong><span>קורסי המשך</span></div><div><strong>{prerequisites.length}</strong><span>קדמים ישירים</span></div></div></div>
        <div className="explore-instructions"><div className="sidebar-section-label">מכאן ממשיכים לחקור</div><div className="instruction"><span className="instruction-icon purple"><ArrowLeft size={17}/></span><div><strong>מסתכלים קדימה</strong><p>לחצו + בקורס כדי לגלות את קורסי ההמשך שלו.</p></div></div><div className="instruction"><span className="instruction-icon green"><ArrowRight size={17}/></span><div><strong>חוזרים צעד אחורה</strong><p>עברו עם העכבר על קורס כדי לחקור את הקדמים שלו.</p></div></div></div>
        {recent.length > 0 && <div className="recent-courses"><div className="sidebar-section-label">ביקרתם לאחרונה</div>{recent.map(id => { const course = index.get(id); return course && <button key={id} onClick={() => selectRoot(course)}><span>{course.name}</span><ChevronLeft size={14}/></button>; })}</div>}
        <div className="sidebar-bottom"><div className="data-status"><span/><span>{dataset ? `${courses.length.toLocaleString('he')} קורסים · ${facultyCount} פקולטות ויחידות` : 'טוענים את מאגר הקורסים…'}</span></div><button onClick={() => setModal('data')}><Database size={14}/>על המאגר ומקורות המידע<ChevronLeft size={13}/></button><small>כל הפקולטות. מעבר לסמסטר אחד.</small></div>
      </aside>

      <section className="map-workspace" aria-label="מפת קשרי הקורסים">
        <div className="map-toolbar"><div className="map-heading"><span className="map-heading-icon"><GitBranch size={18}/></span><div><h2>מפת הקשרים</h2><p>כל חיבור הוא צעד חדש לגלות</p></div><span className="visible-count">{graph.nodes.length} קורסים במפה</span></div><div className="map-actions"><button onClick={resetBranches} disabled={!dataset} title="איפוס הענפים לנקודת המוצא"><RotateCcw size={15}/><span>איפוס ענפים</span></button><button className="layers-button" disabled={!dataset} onClick={() => setExpandedForward(previous => new Set([...previous, ...graph.nodes.filter(n => !n.cycle && !n.missing).map(n => n.id)]))}><Layers size={15}/><span>עוד שכבה</span></button></div></div>
        <div className="graph-canvas">
          {dataset ? <>
            <ExplorerContext.Provider value={{ courses: index, dependents, expandedForward, expandedBackward, toggleForward, toggleBackward, setRoot: selectRoot, onHover: setHoveredId, catalogTerm: String(dataset.meta.latestTerm) }}>
              <ReactFlow<CourseFlowNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} minZoom={0.15} maxZoom={1.8} nodesConnectable={false} nodesDraggable={false} elementsSelectable={false} panOnDrag zoomOnDoubleClick={false} proOptions={{ hideAttribution: true }} onNodeMouseEnter={(_, node) => setHoveredId(node.id)} onPaneClick={() => setHoveredId(null)}>
                <Background variant={BackgroundVariant.Dots} gap={22} size={1.1} color="#dadbe5"/>
              </ReactFlow>
            </ExplorerContext.Provider>
            <div className="canvas-direction"><span><span className="direction-line forward"/>קורסי המשך <ArrowLeft size={13}/></span><span><ArrowRight size={13}/> קדמים<span className="direction-line backward"/></span></div>
            <div className="canvas-controls" dir="ltr"><button aria-label="הגדלת המפה" title="הגדלה" onClick={() => zoomIn({ duration: 250 })}><Plus size={18}/></button><span>{Math.round(zoom * 100)}%</span><button aria-label="הקטנת המפה" title="הקטנה" onClick={() => zoomOut({ duration: 250 })}><Minus size={18}/></button><i/><button aria-label="התאמת המפה למסך" title="התאמה למסך" onClick={() => setFitRequested(value => value + 1)}><Focus size={18}/></button></div>
            <div className="map-legend"><span className="legend-title">סוג הקשר</span><span><i className="legend-node strong"/>קדם חזק</span><span><i className="legend-node concurrent"/>מקצוע צמוד</span><button aria-label="הסבר על סוגי הקשרים" onClick={() => setModal('help')}><CircleHelp size={14}/></button></div>
            <div className="canvas-pan-hint"><Move size={13}/>גררו להזזה · גללו לשינוי קנה מידה</div>
            {graph.nodes.length === 1 && <div className="single-node-hint">{expandedForward.has('root') && successors.length === 0 ? 'אין במאגר קורסי המשך לקורס הזה. אפשר לחקור את הקדמים או לבחור קורס אחר.' : 'לחצו על + בכרטיס כדי לפתוח את קורסי ההמשך.'}</div>}
          </> : <div className="loading-state">{loadError ? <><CircleHelp size={32}/><h2>לא הצלחנו לטעון את המאגר</h2><p>בדקו את החיבור ונסו שוב.</p><button onClick={() => window.location.reload()}>טעינה מחדש</button></> : <><LoaderCircle size={30} className="spin"/><h2>מחברים את הנקודות…</h2><p>טוענים את מפת קורסי הטכניון</p></>}</div>}
        </div>
        <div className="map-footnote"><ShieldCheck size={15}/><p>קשר במפה מציין דרישה לקורס. ייתכנו דרישות נוספות או חלופיות — בדקו את כלל הקדמים המלא בחלונית הקורס.</p><button onClick={() => setModal('data')}>פרטי המאגר<ExternalLink size={12}/></button></div>
      </section>
    </main>
    {modal && <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button,a[href]')).filter(el => !el.hasAttribute('disabled'));
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}><button className="modal-close icon-button" aria-label="סגירה" onClick={() => setModal(null)}><X size={20}/></button><span className="modal-icon">{modal === 'help' ? <GitBranch size={25}/> : <Database size={25}/>}</span><h2 id="modal-title">{modal === 'help' ? 'לכל קורס יש סיפור המשך' : 'הנתונים שמאחורי המפה'}</h2>
      {modal === 'help' ? <><p>בחרו קורס לפי מספר או שם. הוא יהפוך לנקודת המוצא של המפה וכל הענפים יתאפסו.</p><div className="help-steps"><div><span><Plus size={18}/></span><p><strong>פותחים את הדרך קדימה</strong>הסימן + פותח קורסים שהקורס הנוכחי הוא אחד מתנאי הקבלה שלהם. הסימן − סוגר רק את אותו ענף.</p></div><div><span><MousePointer2 size={18}/></span><p><strong>בודקים מה צריך לפני</strong>עברו עם העכבר על כרטיס, או לחצו על ״קדמים ישירים״. בחלונית אפשר לפתוח כל קדם ככרטיס נפרד ולהמשיך אחורה.</p></div><div><span><Focus size={18}/></span><p><strong>רואים את התמונה הגדולה</strong>גררו את הרקע להזזה, השתמשו ב־+ וב־− לשינוי קנה המידה, או התאימו את כל המפה למסך.</p></div></div><div className="help-relations"><p><i className="legend-node strong"/><strong>לבן — קדם חזק:</strong> יש להשלים לפני הקורס הבא.</p><p><i className="legend-node concurrent"/><strong>אפור — מקצוע צמוד:</strong> ניתן ללמוד במקביל, בכפוף לכלל הקבלה.</p><small>הצבע מתאר את הקשר להורה במפה. קווים ירוקים מקווקווים מסמנים חקירה אחורה.</small></div><p className="modal-note">״וגם״ מחייב את כל התנאים בקבוצה. ״או״ מציין חלופות. עצם הופעת קורס במפה אינה אישור זכאות לרישום.</p></> : <><p>מאגר מאוחד של קורסי הטכניון מכל הפקולטות, ממספר סמסטרים ושנים. המפה אינה תכנית לימודים לסמסטר מסוים.</p><div className="dataset-stats"><div><strong>{courses.length.toLocaleString('he')}</strong><span>קורסים במאגר</span></div><div><strong>{facultyCount}</strong><span>פקולטות ויחידות במקור</span></div><div><strong>{knownCount.toLocaleString('he')}</strong><span>רשומות ללא עמימות במקור</span></div></div><p className="coverage-note">{String(dataset?.meta.termCount ?? 8)} סמסטרים במאגר · {String(dataset?.meta.earliestTerm ?? "")} עד {String(dataset?.meta.latestTerm ?? "")}<br/>{String((dataset?.meta.requirementStatuses as Record<string, number>)?.unparsed ?? 0)} כללים עמומים אינם מופיעים כקשרים · {String(dataset?.meta.missingReferencedCourseCount ?? 0)} הפניות לקורסים ללא רשומה מלאה</p><ul className="source-policy"><li>לכל קורס נשמרת הרשומה העדכנית ביותר במקורות שנאספו. כללים מסמסטרים שונים אינם מחוברים זה לזה.</li><li>מספרי קורס ישנים מזוהים באמצעות כינויים מפורשים. הרשומה נשמרת לפי המספר העדכני במקור.</li><li>מידע חסר או עמום מסומן כחסר; לא נוצרים עבורו קשרים משוערים.</li><li>מקצועות חופפים ומקצועות ללא זיכוי נוסף אינם קדמים ואינם הופכים לקשרים במפה.</li></ul>{root && <div className="current-source"><strong>מקור נקודת המוצא</strong><span>{root.name} · {termLabel(root.source.term)}</span><a href={root.source.url} target="_blank" rel="noopener noreferrer">עמוד הקורס בקטלוג הטכניון <ExternalLink size={13}/></a></div>}<div className="source-links"><a href="https://github.com/michael-maltsev/technion-sap-info-fetcher" target="_blank" rel="noopener noreferrer">מאגר נתוני SAP <ExternalLink size={13}/></a><a href="data/courses.json" download>הורדת המאגר המעובד <ArrowDownLeft size={13}/></a></div><p className="modal-note">דרישות עשויות להשתנות בין שנים. לפני רישום, בדקו את הקטלוג הרשמי ואת התקנון החל עליכם. מידע חלקי אינו מעיד שאין לקורס קדמים.</p></>}
      <button className="modal-primary" onClick={() => setModal(null)}><Check size={16}/>ממשיכים לגלות</button>
    </div></div>}
  </div>;
}
