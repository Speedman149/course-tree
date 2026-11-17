import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Background, BackgroundVariant, MarkerType, ReactFlow, useReactFlow, useViewport, type Edge } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import { ArrowDownLeft, ArrowLeft, ArrowRight, BookOpen, Bug, Check, ChevronLeft, CircleHelp, Database, ExternalLink, Focus, GitBranch, GraduationCap, Layers, LoaderCircle, Minus, MousePointer2, Move, Plus, RotateCcw, ShieldCheck, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import CourseSearch from './components/CourseSearch';
const FeedbackPage = lazy(() => import('./components/FeedbackPage'));
const FilterPanel = lazy(() => import('./components/FilterPanel'));
import { createCourseVisibility, getCatalogRoles, getFacultyOptions } from './lib/filters';
import CourseNode, { CourseLink, ExplorerContext, RequirementExpression, type CourseFlowNode } from './components/CourseNode';
import { buildCourseIndex, buildDependents, buildGraph, collectRequirements, forwardConnectionId, restoreDirectConnections } from './lib/graph';
import type { Course, CourseDataset, CatalogDataset } from './types';
import { useProgress } from './lib/use-progress';
import {appRoute,navigateApp} from './lib/navigation';
import {feedbackPageURL,feedbackHistoryOrigin,validCourseNumber,type FeedbackOrigin} from './lib/feedback';
import type { Progress } from './lib/progress';
import { courseAppearance, facultyPalette, MARKED_COURSE_COLOR } from './lib/faculty-colors';
import ForwardBranchEdge from './components/ForwardBranchEdge';
import SiteFooter, { AboutPage } from './components/SiteFooter';

const nodeTypes = { course: CourseNode };
const edgeTypes = { branch: ForwardBranchEdge };
const WIDTH = 286;
const HEIGHT = 168;

export default function App() {
  const [dataset, setDataset] = useState<CourseDataset | null>(null);
  const [catalogs, setCatalogs] = useState<CatalogDataset | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogId, setCatalogId] = useState('');
  const [catalogYear, setCatalogYear] = useState('');
  const [catalogFaculty, setCatalogFaculty] = useState('');
  const [filterTab, setFilterTab] = useState<'faculty'|'catalog'>('faculty');
  const [searchAll, setSearchAll] = useState(false);
  const [markedCourseIds, setMarkedCourseIds] = useState(new Set<string>());
  const [viewportState, setViewportState] = useState<Progress['viewport']>(null);
  const pendingViewport = useRef<Progress['viewport'] | undefined>(undefined);
  const [route,setRoute] = useState(()=>appRoute(window.location));
  const [feedbackOrigin,setFeedbackOrigin] = useState<FeedbackOrigin|null>(()=>feedbackHistoryOrigin(window.history.state));
  const initialPage=useRef(feedbackPageURL(window.location.href));
  const requestedReportCourse=new URLSearchParams(window.location.search).get('courseId')??'';
  const [facultySelection, setFacultySelection] = useState<Set<string> | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  const [loadError, setLoadError] = useState(false);
  const [rootId, setRootId] = useState('02340114');
  const [expandedForward, setExpandedForward] = useState(new Set(['root']));
  const [hiddenForwardConnections,setHiddenForwardConnections] = useState(new Set<string>());
  const layoutAnchor=useRef<{id:string;position:{x:number;y:number};viewport:{x:number;y:number;zoom:number}}|null>(null);
  const [expandedBackward, setExpandedBackward] = useState(new Map<string, Set<string>>());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [modal, setModal] = useState<'help' | 'data' | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [fitRequested, setFitRequested] = useState(0);
  const [rootViewVersion, setRootViewVersion] = useState(0);
  const [branchFocus, setBranchFocus] = useState<{id:string;direction:'forward'|'backward';courseId?:string;version:number}|null>(null);
  const { fitView, zoomIn, zoomOut, setCenter, setViewport, getViewport } = useReactFlow<CourseFlowNode>();
  const { zoom } = useViewport();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/courses.json`, { signal: controller.signal }).then(res => {
      if (!res.ok) throw new Error(`Data HTTP ${res.status}`);
      return res.json();
    }).then((data: CourseDataset) => {
      if (!Array.isArray(data.courses) || !data.courses.length) throw new Error('Empty course dataset');
      setDataset(data);
    }).catch(error => { if (error.name !== 'AbortError') setLoadError(true); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/catalogs.json`, { signal: controller.signal }).then(response => { if (!response.ok) throw new Error('Catalog download failed'); return response.json(); }).then((data: CatalogDataset) => { if (!Array.isArray(data.programs) || !Array.isArray(data.sources)) throw new Error('Invalid catalog data'); setCatalogs(data); }).catch(error => { if (error.name !== 'AbortError') setCatalogError(true); });
    return () => controller.abort();
  }, []);

  const courses = useMemo(() => { const original = dataset?.courses ?? []; const ids = new Set(original.map(course => course.id)); return [...original, ...(catalogs?.referencedCourses ?? []).filter(course => !ids.has(course.id))]; }, [dataset, catalogs]);
  const facultyOptions = useMemo(() => getFacultyOptions(courses), [courses]);
  const selectedFaculties = useMemo(() => facultySelection ?? new Set(facultyOptions.map(faculty => faculty.id)), [facultySelection, facultyOptions]);
  const activeCatalog = useMemo(() => catalogs?.programs.find(program => program.id === catalogId) ?? null, [catalogs, catalogId]);
  const isVisible = useMemo(() => createCourseVisibility(courses, selectedFaculties, activeCatalog), [courses, selectedFaculties, activeCatalog]);
  const filteredCourses = useMemo(() => courses.filter(course => isVisible(course.id)), [courses, isVisible]);
  const hasFilters = selectedFaculties.size !== facultyOptions.length || !!activeCatalog;
  const index = useMemo(() => buildCourseIndex(courses), [courses]);
  const dependents = useMemo(() => buildDependents(courses), [courses]);
  const progress = useMemo<Progress>(() => ({rootId, expandedForward:[...expandedForward].sort(), hiddenForwardConnections:[...hiddenForwardConnections].sort(), expandedBackward:[...expandedBackward].map(([id,ids])=>[id,[...ids].sort()]), facultyIds:facultySelection ? [...facultySelection].sort() : null, catalogId, catalogYear, catalogFaculty, filterTab, searchAll, markedCourseIds:[...markedCourseIds].sort(), recent, viewport:viewportState}), [rootId,expandedForward,hiddenForwardConnections,expandedBackward,facultySelection,catalogId,catalogYear,catalogFaculty,filterTab,searchAll,markedCourseIds,recent,viewportState]);
  const restoreProgress = useCallback((saved:Progress) => {
    layoutAnchor.current=null;setHiddenForwardConnections(new Set(saved.hiddenForwardConnections));
    setRootId(saved.rootId);setExpandedForward(new Set(saved.expandedForward));setExpandedBackward(new Map(saved.expandedBackward.map(([id,ids])=>[id,new Set(ids)])));
    setFacultySelection(saved.facultyIds===null?null:new Set(saved.facultyIds));setCatalogId(saved.catalogId);setCatalogYear(saved.catalogYear);setCatalogFaculty(saved.catalogFaculty);setFilterTab(saved.filterTab);setSearchAll(saved.searchAll);
    setMarkedCourseIds(new Set(saved.markedCourseIds));setRecent(saved.recent);setViewportState(saved.viewport);pendingViewport.current=saved.viewport;
    setBranchFocus(null);setHoveredId(null);setRootViewVersion(version=>version+1);
    if(appRoute(window.location)!=='feedback'){const url=new URL(window.location.href);url.searchParams.set('course',saved.rootId);window.history.replaceState({},'',url);}
  },[]);
  const progressDatabase=useMemo(()=>({courses:index,facultyIds:new Set(facultyOptions.map(f=>f.id)),programs:catalogs?.programs??null,years:catalogs?.meta.years??[],defaultYear:catalogs?.meta.defaultYear??'2025-2026',defaultRoot:dataset?.courses.find(c=>c.id==='02340114')?.id??dataset?.courses[0]?.id??'02340114'}),[index,facultyOptions,catalogs,dataset]);
  const {ready:progressReady,storageAvailable,clearSaved}=useProgress(progress,progressDatabase,!!dataset,!!catalogs||catalogError,restoreProgress);
  const toggleMarked=useCallback((courseId:string)=>setMarkedCourseIds(previous=>{const next=new Set(previous);if(next.has(courseId))next.delete(courseId);else next.add(courseId);return next;}),[]);
  useEffect(()=>{
    const navigate=()=>{const next=appRoute(window.location);if(next==='tree')pendingViewport.current=viewportState;setFeedbackOrigin(next==='feedback'?feedbackHistoryOrigin(window.history.state):null);setRoute(next);};
    window.addEventListener('hashchange',navigate);window.addEventListener('popstate',navigate);return()=>{window.removeEventListener('hashchange',navigate);window.removeEventListener('popstate',navigate);};
  },[viewportState]);

  const root = index.get(rootId);
  const prerequisites = collectRequirements(root?.requirements);
  const successors = dependents.get(rootId) ?? [];
  const graph = useMemo(() => buildGraph(rootId, index, dependents, expandedForward, expandedBackward, isVisible, hiddenForwardConnections), [rootId, index, dependents, expandedForward, expandedBackward, isVisible, hiddenForwardConnections]);
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
  const edges: Edge[] = useMemo(() => {
    const instances=new Map(graph.nodes.map(node=>[node.id,node.courseId]));
    return graph.edges.map(edge => ({
    ...edge, type: edge.direction==='forward'?'branch':'smoothstep',
    data: edge.direction==='forward'?{connectionId:forwardConnectionId(edge.source,instances.get(edge.target)!,edge.relation),parentInstanceId:edge.source,childCourseId:instances.get(edge.target)!,parentCourseId:instances.get(edge.source)!}:undefined,
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: edge.direction === 'backward' ? '#65a99a' : '#b5add7' },
    style: { stroke: edge.direction === 'backward' ? '#65a99a' : '#b5add7', strokeWidth: 1.6, strokeDasharray: edge.direction === 'backward' ? '5 5' : undefined },
    pathOptions: { borderRadius: 16 },
  })); }, [graph]);

  // Repack the graph, but keep the clicked parent anchored at the same screen
  // position. Zoom and unrelated expansions are preserved.
  useLayoutEffect(()=>{
    const anchor=layoutAnchor.current;if(!anchor)return;layoutAnchor.current=null;
    const next=positions.get(anchor.id);if(!next)return;
    void setViewport({...anchor.viewport,x:anchor.viewport.x+(anchor.position.x-next.x)*anchor.viewport.zoom,y:anchor.viewport.y+(anchor.position.y-next.y)*anchor.viewport.zoom},{duration:0});
  },[positions,setViewport]);
  const rememberBranchAnchor=useCallback((parentId:string)=>{
    const position=positions.get(parentId);if(position)layoutAnchor.current={id:parentId,position,viewport:getViewport()};
    setBranchFocus(null);
  },[positions,getViewport]);
  const hideForwardConnection=useCallback((connectionId:string,parentId:string)=>{
    rememberBranchAnchor(parentId);setHoveredId(null);setHiddenForwardConnections(previous=>new Set([...previous,connectionId]));
  },[rememberBranchAnchor]);
  const restoreForwardConnection=useCallback((connectionId:string,parentId:string)=>{
    rememberBranchAnchor(parentId);setHiddenForwardConnections(previous=>{const next=new Set(previous);next.delete(connectionId);return next;});
  },[rememberBranchAnchor]);

  useEffect(() => {
    if (!dataset || !progressReady || route!=='tree') return;
    // Restore a saved viewport before requesting any automatic centering.
    if (pendingViewport.current) { const saved=pendingViewport.current;pendingViewport.current=undefined;requestAnimationFrame(()=>setViewport(saved,{duration:0}));return; }
    pendingViewport.current=undefined;
    // Start centered on the root at a readable scale, even for broad courses.
    const frame = requestAnimationFrame(() => {
      const p = positions.get('root');
      const container = document.querySelector('.graph-canvas')?.getBoundingClientRect();
      if (p && container) setCenter(p.x + WIDTH / 2 - container.width * 0.23, p.y + HEIGHT / 2, { zoom: container.width < 600 ? 0.75 : 0.9, duration: 450 });
    });
    return () => cancelAnimationFrame(frame);
  }, [dataset, rootId, rootViewVersion, isVisible, progressReady, route]);
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
    pendingViewport.current=undefined;layoutAnchor.current=null;setHiddenForwardConnections(new Set());setViewportState(null);setBranchFocus(null);
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
    else { next.add(id);setHiddenForwardConnections(previous=>restoreDirectConnections(previous,id)); setBranchFocus(previous => ({ id, direction: 'forward', version: (previous?.version ?? 0) + 1 })); }
    setExpandedForward(next);
  }, [expandedForward]);
  const toggleBackward = useCallback((id: string, courseId: string) => {
    const next = new Map(expandedBackward); const selected = new Set(next.get(id));
    if (selected.has(courseId)) selected.delete(courseId);
    else { selected.add(courseId); setBranchFocus(previous => ({ id, courseId, direction: 'backward', version: (previous?.version ?? 0) + 1 })); }
    next.set(id, selected); setExpandedBackward(next);
  }, [expandedBackward]);
  const resetBranches = () => { layoutAnchor.current=null;setHiddenForwardConnections(new Set());setExpandedForward(new Set(['root'])); setExpandedBackward(new Map()); setRootViewVersion(previous => previous + 1); };
  const facultyCount = facultyOptions.filter(faculty => !faculty.id.includes('שיוך פקולטה לא זמין')).length;
  const hiddenConnections = graph.nodes.reduce((sum, node) => sum + (node.cycle ? 0 : (dependents.get(node.courseId) ?? []).filter(child => !isVisible(child.courseId)).length), 0);
  const catalogRoles = useCallback((courseId: string) => getCatalogRoles(courseId, activeCatalog, index), [activeCatalog, index]);
  const knownCount = courses.filter(c => c.requirementsStatus === 'known' || c.requirementsStatus === 'none').length;
  const termLabel = (term: string | undefined) => term ? term.replace('_', ' · ') : 'מקור הקורס';

  const openFeedback=(courseId?:string)=>{
    const origin:FeedbackOrigin={pageUrl:feedbackPageURL(window.location.href),route:appRoute(window.location),startingCourseId:progressReady?rootId:undefined,...(courseId?{relevantCourseId:courseId}:{})};
    setFiltersOpen(false);setHoveredId(null);setModal(null);
    navigateApp(courseId?`/feedback?courseId=${encodeURIComponent(courseId)}`:'/feedback',{feedbackOrigin:origin});
  };
  if(route==='feedback')return <Suspense fallback={<div className="feedback-loading" role="status">טוענים את עמוד המשוב…</div>}><FeedbackPage treeCourseId={progressReady?rootId:undefined} origin={feedbackOrigin??{pageUrl:initialPage.current,route:'feedback',startingCourseId:progressReady?rootId:undefined,...(validCourseNumber(requestedReportCourse)?{relevantCourseId:requestedReportCourse}:{})}} courseId={feedbackOrigin?.relevantCourseId??(validCourseNumber(requestedReportCourse)?requestedReportCourse:undefined)}/></Suspense>;
  if(route==='about')return <AboutPage/>;

  return <div className="app-shell" dir="rtl" style={{'--marked-course':MARKED_COURSE_COLOR} as React.CSSProperties}>
    <header className="app-header">
      <a className="brand" href={window.location.pathname} aria-label="מפת הקורסים — לדף הבית"><span className="brand-mark"><GitBranch size={24}/></span><span><strong>מפת הקורסים<span className="brand-dot">.</span></strong><small>לגלות לאן אפשר להמשיך</small></span></a>
      <CourseSearch courses={filteredCourses} allCourses={courses} filtered={hasFilters} disabled={!dataset || !progressReady} searchAll={searchAll} onSearchAllChange={setSearchAll} onSelect={selectRoot}/>
      <div className="header-actions"><a className="feedback-trigger" href="/feedback" title="דיווח על תקלה או שליחת משוב" aria-label="דיווח על תקלה או שליחת משוב" onClick={event=>{event.preventDefault();openFeedback();}}><Bug size={19}/></a><span className="technion-tag"><GraduationCap size={19}/>הטכניון</span><span className="header-divider"/><button className="help-button" onClick={() => setModal('help')}><CircleHelp size={18}/><span>איך זה עובד?</span></button></div>
    </header>

    <main className="workspace">
      <aside className="sidebar">
        <div className="sidebar-intro"><span className="eyebrow"><span/>מגלים את התמונה הגדולה</span><h1>קורס אחד.<br/>הרבה אפשרויות.</h1><p>חקרו את הקשרים בין הקורסים ובנו לעצמכם תמונה של הדרך קדימה.</p></div>
        <div className="sidebar-section-label">נקודת המוצא שלכם <span className="status-dot"/></div>
        <div className="root-summary" style={{'--faculty-accent':courseAppearance(root).accent} as React.CSSProperties}><span className="root-summary-icon"><BookOpen size={21}/></span>{root ? <><CourseLink course={root} id={root.id}/><h2>{root.name}</h2><p>{root.faculty}{root.credits !== undefined ? ` · ${root.credits} נקודות זכות` : ''}</p></> : <div className="skeleton skeleton-root"/>}<div className="root-summary-stats"><div><strong>{successors.filter(child => isVisible(child.courseId)).length}</strong><span>קורסי המשך{successors.some(child => !isVisible(child.courseId)) ? ` · ${successors.filter(child => !isVisible(child.courseId)).length} מוסתרים` : ''}</span></div><div><strong>{prerequisites.length}</strong><span>קדמים ישירים</span></div></div></div>
        <div className="explore-instructions"><div className="sidebar-section-label">מכאן ממשיכים לחקור</div><div className="instruction"><span className="instruction-icon purple"><ArrowLeft size={17}/></span><div><strong>מסתכלים קדימה</strong><p>לחצו + בקורס כדי לגלות את קורסי ההמשך שלו.</p></div></div><div className="instruction"><span className="instruction-icon green"><ArrowRight size={17}/></span><div><strong>חוזרים צעד אחורה</strong><p>עברו עם העכבר על קורס כדי לחקור את הקדמים שלו.</p></div></div></div>
        {recent.length > 0 && <div className="recent-courses"><div className="sidebar-section-label">ביקרתם לאחרונה</div>{recent.map(id => { const course = index.get(id); return course && <button key={id} onClick={() => selectRoot(course)}><span>{course.name}</span><ChevronLeft size={14}/></button>; })}</div>}
        <div className="sidebar-bottom"><div className="data-status"><span/><span>{dataset ? `${courses.length.toLocaleString('he')} קורסים · ${facultyCount} פקולטות ויחידות` : 'טוענים את מאגר הקורסים…'}</span></div><button onClick={() => setModal('data')}><Database size={14}/>על המאגר ומקורות המידע<ChevronLeft size={13}/></button><small>כל הפקולטות. מעבר לסמסטר אחד.</small></div>
      </aside>

      <section className="map-workspace" aria-label="מפת קשרי הקורסים">
        <div className="map-toolbar"><div className="map-heading"><span className="map-heading-icon"><GitBranch size={18}/></span><div><h2>מפת הקשרים</h2><p>כל חיבור הוא צעד חדש לגלות</p></div><span className="visible-count">{graph.nodes.length} קורסים במפה</span></div><div className="map-actions"><button className={`filters-trigger ${hasFilters ? 'active' : ''}`} aria-label="פתיחת מסנני המפה" aria-expanded={filtersOpen} disabled={!progressReady} onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={15}/><span>מסננים</span>{hasFilters && <i/>}</button><button onClick={resetBranches} disabled={!dataset} title="איפוס הענפים לנקודת המוצא"><RotateCcw size={15}/><span>איפוס ענפים</span></button><button className="layers-button" disabled={!dataset} onClick={() => setExpandedForward(previous => new Set([...previous, ...graph.nodes.filter(n => !n.cycle && !n.missing).map(n => n.id)]))}><Layers size={15}/><span>עוד שכבה</span></button></div></div>
        {hasFilters && <div className="active-filter-summary" aria-live="polite"><div><strong>{activeCatalog ? `קטלוג נבחר: ${activeCatalog.officialName}${activeCatalog.track && !activeCatalog.officialName.includes(activeCatalog.track) ? ` — ${activeCatalog.track}` : ''} (${activeCatalog.catalogYear})` : 'סינון לפי פקולטה'}</strong>{activeCatalog && <span className="catalog-scope-notice">{activeCatalog.coverage.status === 'inventory-only' ? 'תכנית מתועדת בלבד · דרישות הלימודים טרם אומתו; אין רשימת קורסי המשך מאושרת' : 'ייבוא חלקי של רשימות וכללים · תנאי המקור והמידע החסר מפורטים במסננים; אין אישור זכאות אוטומטי'}</span>}<span>{selectedFaculties.size} מתוך {facultyOptions.length} אפשרויות שיוך · {filteredCourses.length} קורסים מתאימים · {hiddenConnections} קשרי המשך מוסתרים</span>{!isVisible(rootId) && <span className="root-filter-warning">נקודת המוצא מחוץ לסינון ומוצגת כעוגן בלבד. קדמים פתוחים מוצגים ללא סינון.</span>}</div><button aria-label="איפוס כל המסננים" onClick={() => { setFacultySelection(null); setCatalogId(''); }}><X size={14}/><span>איפוס סינון</span></button></div>}
        <div className="graph-canvas">
          {dataset && progressReady ? <>
            <ExplorerContext.Provider value={{ courses: index, dependents, expandedForward, expandedBackward, toggleForward, toggleBackward, setRoot: selectRoot, onHover: setHoveredId, catalogTerm: String(dataset.meta.latestTerm), isVisible, activeCatalog, catalogRoles, hasFilters, markedCourseIds, toggleMarked, hiddenForwardConnections, hideForwardConnection, restoreForwardConnection, reportCourse:openFeedback }}>
              <ReactFlow<CourseFlowNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} minZoom={0.15} maxZoom={1.8} nodesConnectable={false} nodesDraggable={false} elementsSelectable={false} panOnDrag zoomOnDoubleClick={false} defaultViewport={viewportState??undefined} onMoveEnd={(_,viewport)=>setViewportState(viewport)} proOptions={{ hideAttribution: true }} onNodeMouseEnter={(_, node) => setHoveredId(node.id)} onPaneClick={() => setHoveredId(null)}>
                <Background variant={BackgroundVariant.Dots} gap={22} size={1.1} color="#dadbe5"/>
              </ReactFlow>
            </ExplorerContext.Provider>
            <div className="canvas-direction"><span><span className="direction-line forward"/>קורסי המשך <ArrowLeft size={13}/></span><span><ArrowRight size={13}/> קדמים<span className="direction-line backward"/></span></div>
            <div className="canvas-controls" dir="ltr"><button aria-label="הגדלת המפה" title="הגדלה" onClick={() => zoomIn({ duration: 250 })}><Plus size={18}/></button><span>{Math.round(zoom * 100)}%</span><button aria-label="הקטנת המפה" title="הקטנה" onClick={() => zoomOut({ duration: 250 })}><Minus size={18}/></button><i/><button aria-label="התאמת המפה למסך" title="התאמה למסך" onClick={() => setFitRequested(value => value + 1)}><Focus size={18}/></button></div>
            <div className="map-legend"><span className="legend-title">מקרא</span><span><i className="legend-faculty"/>מסגרת: פקולטה</span><span><i className="legend-marked"/>סימון אישי</span><span><i className="legend-node strong"/>קדם חזק</span><span><i className="legend-node concurrent"/>מקצוע צמוד</span><button aria-label="הסבר על סוגי הקשרים" onClick={() => setModal('help')}><CircleHelp size={14}/></button></div>
            <div className="canvas-pan-hint"><Move size={13}/>גררו להזזה · גללו לשינוי קנה מידה</div>
            {graph.nodes.length === 1 && <div className="single-node-hint">{successors.length > 0 && successors.every(child => !isVisible(child.courseId)) ? 'קורסי ההמשך מוסתרים על ידי המסננים. אפשר לשנות סינון; חקירת קדמים נשארת פתוחה.' : expandedForward.has('root') && successors.some(child=>isVisible(child.courseId)&&hiddenForwardConnections.has(forwardConnectionId('root',child.courseId,child.relation))) ? 'ענפים מוסתרים אישית. אפשר להחזירם דרך ״הצגת ענפים״ ליד הקורס.' : expandedForward.has('root') && successors.length === 0 ? 'אין במאגר קורסי המשך לקורס הזה. אפשר לחקור את הקדמים או לבחור קורס אחר.' : 'לחצו על + בכרטיס כדי לפתוח את קורסי ההמשך.'}</div>}
          </> : <div className="loading-state">{loadError ? <><CircleHelp size={32}/><h2>לא הצלחנו לטעון את המאגר</h2><p>בדקו את החיבור ונסו שוב.</p><button onClick={() => window.location.reload()}>טעינה מחדש</button></> : <><LoaderCircle size={30} className="spin"/><h2>מחברים את הנקודות…</h2><p>טוענים את מפת קורסי הטכניון</p></>}</div>}
        </div>
        <div className="map-footnote"><ShieldCheck size={15}/><p>קשר במפה מציין דרישה לקורס. ייתכנו דרישות נוספות או חלופיות — בדקו את כלל הקדמים המלא בחלונית הקורס.</p><button onClick={() => setModal('data')}>פרטי המאגר<ExternalLink size={12}/></button></div>
      </section>
    </main>
    <SiteFooter treeCourseId={rootId} markedCount={markedCourseIds.size} storageAvailable={storageAvailable} onClearMarks={()=>{if(window.confirm('לנקות את כל סימוני הקורסים? הענפים והמסננים יישמרו.'))setMarkedCourseIds(new Set());}} onResetProgress={()=>{if(window.confirm('לאפס את כל ההתקדמות השמורה, הענפים, המסננים וסימוני הקורסים בדפדפן הזה?')){clearSaved();setFiltersOpen(false);}}}/>
    {filtersOpen && <Suspense fallback={<div className="filter-loading" role="status">טוענים מסננים…</div>}><FilterPanel faculties={facultyOptions} selected={selectedFaculties} onFacultiesChange={setFacultySelection} catalogs={catalogs} catalogError={catalogError} activeCatalog={activeCatalog} onCatalogChange={id=>{setCatalogId(id);const program=catalogs?.programs.find(p=>p.id===id);if(program)setCatalogYear(program.catalogYear);}} tab={filterTab} onTabChange={setFilterTab} year={catalogYear} onYearChange={setCatalogYear} catalogFaculty={catalogFaculty} onCatalogFacultyChange={setCatalogFaculty} courses={index} onCourseSelect={selectRoot} onClose={closeFilters}/></Suspense> }
    {modal && <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button,a[href]')).filter(el => !el.hasAttribute('disabled'));
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}><button className="modal-close icon-button" aria-label="סגירה" onClick={() => setModal(null)}><X size={20}/></button><span className="modal-icon">{modal === 'help' ? <GitBranch size={25}/> : <Database size={25}/>}</span><h2 id="modal-title">{modal === 'help' ? 'לכל קורס יש סיפור המשך' : 'הנתונים שמאחורי המפה'}</h2>
      {modal === 'help' ? <><p>בחרו קורס לפי מספר או שם. הוא יהפוך לנקודת המוצא של המפה וכל הענפים יתאפסו.</p><div className="help-steps"><div><span><Plus size={18}/></span><p><strong>פותחים את הדרך קדימה</strong>הסימן + פותח קורסים שהקורס הנוכחי הוא אחד מתנאי הקבלה שלהם. הסימן − בכרטיס סוגר את כל קורסי ההמשך שלו. − שעל חיבור מסתיר רק את הענף הזה; אפשר להחזירו דרך ״הצגת ענפים״ ליד ההורה.</p></div><div><span><MousePointer2 size={18}/></span><p><strong>בודקים מה צריך לפני</strong>עברו עם העכבר על כרטיס, או לחצו על ״קדמים ישירים״. בחלונית אפשר לפתוח כל קדם ככרטיס נפרד ולהמשיך אחורה.</p></div><div><span><Focus size={18}/></span><p><strong>רואים את התמונה הגדולה</strong>גררו את הרקע להזזה, השתמשו ב־+ וב־− לשינוי קנה המידה, או התאימו את כל המפה למסך.</p></div></div><div className="help-relations"><p><i className="legend-node strong"/><strong>קדם חזק:</strong> יש להשלים לפני הקורס הבא.</p><p><i className="legend-node concurrent"/><strong>תג אפור — מקצוע צמוד:</strong> ניתן ללמוד במקביל, בכפוף לכלל הקבלה.</p><small>צבע המסגרת מציין פקולטה; אדום הוא סימון אישי בלבד. תג אפור מציין מקצוע צמוד; קדם חזק מופיע בכרטיס ללא תג. קווים ירוקים מקווקווים מסמנים חקירה אחורה.</small></div><div className="faculty-color-key">{facultyPalette.map(f=><span key={f.id}><i style={{background:f.accent}}/>{f.label}</span>)}</div><p className="modal-note">סימון אישי נשמר לכל מספר קורס, ואינו אישור השלמה או זכאות.</p><p className="modal-note">״וגם״ מחייב את כל התנאים בקבוצה. ״או״ מציין חלופות. עצם הופעת קורס במפה אינה אישור זכאות לרישום.</p></> : <><p>מאגר מאוחד של קורסי הטכניון מכל הפקולטות, ממספר סמסטרים ושנים. המפה אינה תכנית לימודים לסמסטר מסוים.</p><div className="dataset-stats"><div><strong>{courses.length.toLocaleString('he')}</strong><span>קורסים במאגר</span></div><div><strong>{facultyCount}</strong><span>פקולטות ויחידות במקור</span></div><div><strong>{knownCount.toLocaleString('he')}</strong><span>רשומות ללא עמימות במקור</span></div></div><p className="coverage-note">{dataset?.courses.length.toLocaleString('he')} רשומות SAP ו־{catalogs?.referencedCourses?.length ?? 0} הפניות קטלוג ללא פרטי קדמים<br/>{String(dataset?.meta.termCount ?? 8)} סמסטרים במאגר · {String(dataset?.meta.earliestTerm ?? "")} עד {String(dataset?.meta.latestTerm ?? "")}<br/>{String((dataset?.meta.requirementStatuses as Record<string, number>)?.unparsed ?? 0)} כללים עמומים אינם מופיעים כקשרים · {String(dataset?.meta.missingReferencedCourseCount ?? 0)} הפניות לקורסים ללא רשומה מלאה</p><ul className="source-policy"><li>לכל קורס נשמרת הרשומה העדכנית ביותר במקורות שנאספו. כללים מסמסטרים שונים אינם מחוברים זה לזה.</li><li>מספרי קורס ישנים מזוהים באמצעות כינויים מפורשים. הרשומה נשמרת לפי המספר העדכני במקור.</li><li>מידע חסר או עמום מסומן כחסר; לא נוצרים עבורו קשרים משוערים.</li><li>מקצועות חופפים ומקצועות ללא זיכוי נוסף אינם קדמים ואינם הופכים לקשרים במפה.</li></ul>{root && <div className="current-source"><strong>מקור נקודת המוצא</strong><span>{root.name} · {termLabel(root.source.term)}</span><a href={root.source.url} target="_blank" rel="noopener noreferrer">עמוד הקורס בקטלוג הטכניון <ExternalLink size={13}/></a></div>}<div className="source-links"><a href="https://github.com/michael-maltsev/technion-sap-info-fetcher" target="_blank" rel="noopener noreferrer">מאגר נתוני SAP <ExternalLink size={13}/></a><a href="data/courses.json" download>הורדת המאגר המעובד <ArrowDownLeft size={13}/></a></div><p className="modal-note">דרישות עשויות להשתנות בין שנים. לפני רישום, בדקו את הקטלוג הרשמי ואת התקנון החל עליכם. מידע חלקי אינו מעיד שאין לקורס קדמים.</p></>}
      <button className="modal-primary" onClick={() => setModal(null)}><Check size={16}/>ממשיכים לגלות</button>
    </div></div>}
  </div>;
}
