import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Background, BackgroundVariant, MarkerType, ReactFlow, useReactFlow, useViewport, type Edge } from '@xyflow/react';
import { ArrowDownLeft, ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, CircleHelp, Database, ExternalLink, Focus, GitBranch, Layers, Menu, Minus, Move, Plus, RotateCcw, Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import MobileCourseSearch from './components/MobileCourseSearch';
const FeedbackPage = lazy(() => import('./components/FeedbackPage'));
const FilterPanel = lazy(() => import('./components/FilterPanel'));
import { createCourseVisibility, getCatalogRoles, getFacultyOptions } from './lib/filters';
import CourseNode, { CourseLink, ExplorerContext, type CourseFlowNode } from './components/CourseNode';
import { buildCourseIndex, buildDependents, buildGraph, collectRequirements, forwardConnectionId, graphRoots } from './lib/graph';
import { explorationReducer, initialExploration } from './lib/exploration';
import { layoutCourseGraph, COURSE_WIDTH as WIDTH, COURSE_HEIGHT as HEIGHT } from './lib/layout';
import type { Course, CourseDataset, CatalogDataset } from './types';
import { useProgress } from './lib/use-progress';
import { appRoute, navigateApp, upgradeLegacyRoute } from './lib/navigation';
import {updatePageMetadata} from './lib/seo';
import { feedbackPageURL, feedbackHistoryOrigin, validCourseNumber, type FeedbackOrigin } from './lib/feedback';
import type { Progress } from './lib/progress';
import { courseAppearance, MARKED_COURSE_COLOR } from './lib/faculty-colors';
import ForwardBranchEdge from './components/ForwardBranchEdge';
import SiteFooter, { AboutPage } from './components/SiteFooter';
import { readDatasetJSON, validateCourseDataset, validateCatalogDataset } from './lib/data-validation';
import { officialSourceURL } from './lib/urls';
import { evaluatePrerequisites } from './lib/prerequisite-satisfaction';
import HelpGuide from './components/HelpGuide';
import MobileToolsDrawer from './components/MobileToolsDrawer';
import PrerequisiteHighlightToggle from './components/PrerequisiteHighlightToggle';
import {useMobileLayout} from './lib/use-mobile-layout';
import {emptyMarkedCourses, setCourseMarked, setMarkedQuantity} from './lib/marked-courses';
import {markedQuantity} from './lib/repeatable-courses';
import AppHeader from './components/AppHeader';
import {ExplorerIntro, ExplorerInstructions, ExplorerLoadingContent, StaticPublicPage} from './components/PublicContent';

const nodeTypes = { course: CourseNode };
const edgeTypes = { branch: ForwardBranchEdge };

export default function App() {
  const [dataset, setDataset] = useState<CourseDataset | null>(null);
  const [catalogs, setCatalogs] = useState<CatalogDataset | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogId, setCatalogId] = useState('');
  const [catalogYear, setCatalogYear] = useState('');
  const [catalogFaculty, setCatalogFaculty] = useState('');
  const [filterTab, setFilterTab] = useState<'faculty' | 'catalog'>('faculty');
  const [searchAll, setSearchAll] = useState(false);
  const [markings, setMarkings] = useState(emptyMarkedCourses);
  const {ids: markedCourseIds, quantities: markedCourseQuantities} = markings;
  const [highlightSatisfiedPrerequisites, setHighlightSatisfiedPrerequisites] = useState(false);
  const [viewportState, setViewportState] = useState<Progress['viewport']>(null);
  const pendingViewport = useRef<Progress['viewport'] | undefined>(undefined);
  const [route, setRoute] = useState(() => appRoute(window.location));
  useEffect(() => {updatePageMetadata(route,__INDEXABLE_BUILD__ && window.location.hostname === 'branchquest.app');},[route]);
  const [feedbackOrigin, setFeedbackOrigin] = useState<FeedbackOrigin | null>(() => feedbackHistoryOrigin(window.history.state));
  const initialPage = useRef(feedbackPageURL(window.location.href));
  const requestedReportCourse = new URLSearchParams(window.location.search).get('courseId') ?? '';
  const [facultySelection, setFacultySelection] = useState<Set<string> | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  const [loadError, setLoadError] = useState(false);
  const [exploration, dispatch] = useReducer(explorationReducer, undefined, () => initialExploration());
  const { primaryCourseId, addedCourseIds, expandedForward, autoExpandedCourseIds, revealedForwardConnections, expandedBackward, hiddenForwardConnections, automaticConnections } = exploration;
  const rootId = primaryCourseId;
  const graphAnchors = useMemo(() => graphRoots(primaryCourseId, addedCourseIds), [primaryCourseId, addedCourseIds]);
  const addedIds = useMemo(() => new Set(addedCourseIds), [addedCourseIds]);
  const layoutAnchor = useRef<{ id: string; position: { x: number; y: number }; viewport: { x: number; y: number; zoom: number } } | null>(null);
  const [modal, setModal] = useState<'help' | 'data' | null>(null);
  const mobile = useMobileLayout();
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const mobileToolsTrigger = useRef<HTMLButtonElement>(null);
  const filtersTrigger = useRef<HTMLButtonElement>(null);
  const closeMobileTools = useCallback(() => setMobileToolsOpen(false), []);
  useEffect(() => {if (!mobile || route !== 'tree') setMobileToolsOpen(false);}, [mobile, route]);
  const [recent, setRecent] = useState<string[]>([]);
  const [fitRequested, setFitRequested] = useState(0);
  const [rootViewVersion, setRootViewVersion] = useState(0);
  const [branchFocus, setBranchFocus] = useState<{ id: string; direction: 'forward' | 'backward'; courseId?: string; version: number } | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ courseId: string; sequence: number } | null>(null);
  const consumedFocus = useRef(0);
  const nextFocusSequence = useRef(0);
  const [focusedCourseId, setFocusedCourseId] = useState<string | null>(null);
  const { fitView, zoomIn, zoomOut, setCenter, setViewport, getViewport } = useReactFlow<CourseFlowNode>();
  const { zoom } = useViewport();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/courses.json`, { signal: controller.signal })
      .then(readDatasetJSON).then(data => setDataset(validateCourseDataset(data)))
      .catch(error => { if (error.name !== 'AbortError') setLoadError(true); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/catalogs.json`, { signal: controller.signal })
      .then(readDatasetJSON).then(data => setCatalogs(validateCatalogDataset(data)))
      .catch(error => { if (error.name !== 'AbortError') setCatalogError(true); });
    return () => controller.abort();
  }, []);

  const courses = useMemo(() => {
    const original = dataset?.courses ?? [];
    const ids = new Set(original.map(course => course.id));
    return [...original, ...(catalogs?.referencedCourses ?? []).filter(course => !ids.has(course.id))];
  }, [dataset, catalogs]);
  const facultyOptions = useMemo(() => getFacultyOptions(courses), [courses]);
  const selectedFaculties = useMemo(() => facultySelection ?? new Set(facultyOptions.map(faculty => faculty.id)), [facultySelection, facultyOptions]);
  const activeCatalog = useMemo(() => catalogs?.programs.find(program => program.id === catalogId) ?? null, [catalogs, catalogId]);
  const isVisible = useMemo(() => createCourseVisibility(courses, selectedFaculties, activeCatalog), [courses, selectedFaculties, activeCatalog]);
  const filteredCourses = useMemo(() => courses.filter(course => isVisible(course.id)), [courses, isVisible]);
  const hasFilters = selectedFaculties.size !== facultyOptions.length || !!activeCatalog;
  const index = useMemo(() => buildCourseIndex(courses), [courses]);
  const dependents = useMemo(() => buildDependents(courses), [courses]);
  const prerequisiteSatisfaction = useMemo(() => new Map(courses.map(course => [course.id, evaluatePrerequisites(course, markedCourseIds)])), [courses, markedCourseIds]);
  const knownCourseIds = useMemo(() => new Set([...index.keys(), ...dependents.keys()]), [index, dependents]);
  const progress = useMemo<Progress>(() => ({
    primaryCourseId, addedCourseIds, expandedForward: [...expandedForward].sort(), autoExpandedCourseIds: [...autoExpandedCourseIds].sort(), revealedForwardConnections: [...revealedForwardConnections].sort(), hiddenForwardConnections: [...hiddenForwardConnections].sort(),
    expandedBackward: [...expandedBackward].map(([id, ids]) => [id, [...ids].sort()]), automaticConnections,
    facultyIds: facultySelection ? [...facultySelection].sort() : null, catalogId, catalogYear, catalogFaculty, filterTab, searchAll,
    markedCourseIds: [...markedCourseIds], markedCourseQuantities, highlightSatisfiedPrerequisites, recent, viewport: viewportState,
  }), [primaryCourseId, addedCourseIds, expandedForward, autoExpandedCourseIds, revealedForwardConnections, hiddenForwardConnections, expandedBackward, automaticConnections, facultySelection, catalogId, catalogYear, catalogFaculty, filterTab, searchAll, markedCourseIds, markedCourseQuantities, highlightSatisfiedPrerequisites, recent, viewportState]);
  const restoreProgress = useCallback((saved: Progress) => {
    layoutAnchor.current = null;
    dispatch({ type: 'restore', saved });
    setFacultySelection(saved.facultyIds === null ? null : new Set(saved.facultyIds));
    setCatalogId(saved.catalogId); setCatalogYear(saved.catalogYear); setCatalogFaculty(saved.catalogFaculty);
    setFilterTab(saved.filterTab); setSearchAll(saved.searchAll);
    setMarkings({ids: new Set(saved.markedCourseIds), quantities: saved.markedCourseQuantities}); setRecent(saved.recent);
    setHighlightSatisfiedPrerequisites(saved.highlightSatisfiedPrerequisites);
    setViewportState(saved.viewport); pendingViewport.current = saved.viewport;
    setBranchFocus(null);  setFocusRequest(null); setFocusedCourseId(null);
    setRootViewVersion(version => version + 1);
  }, []);
  const progressDatabase = useMemo(() => ({
    courses: index, facultyIds: new Set(facultyOptions.map(faculty => faculty.id)), programs: catalogs?.programs ?? null,
    years: catalogs?.meta.years ?? [], defaultYear: catalogs?.meta.defaultYear ?? '2025-2026',
    defaultRoot: dataset?.courses.find(course => course.id === '02340114')?.id ?? dataset?.courses[0]?.id ?? '02340114',
  }), [index, facultyOptions, catalogs, dataset]);
  const { ready: progressReady, storageAvailable, clearSaved } = useProgress(progress, progressDatabase, !!dataset, !!catalogs || catalogError, restoreProgress);
  const toggleMarked = useCallback((courseId: string) => {
    const removing = markedCourseIds.has(courseId);
    const quantity = markedQuantity(index.get(courseId), markedCourseQuantities);
    if (removing && quantity > 1 && !window.confirm(`להסיר את הסימון של ${courseId} ואת כל ${quantity} המופעים שנספרו?`)) return false;
    setMarkings(previous => setCourseMarked(previous, courseId, !removing));
    return true;
  }, [markedCourseIds, markedCourseQuantities, index]);
  const changeMarkedQuantity = useCallback((courseId: string, quantity: number) => {
    setMarkings(previous => setMarkedQuantity(previous, index.get(courseId), quantity));
  }, [index]);
  useEffect(() => {
    if (!progressReady || route === 'feedback') return;
    const url = new URL(window.location.href);
    if (rootId) url.searchParams.set('course', rootId); else url.searchParams.delete('course');
    window.history.replaceState(window.history.state, '', url);
  }, [rootId, progressReady, route]);
  useLayoutEffect(() => {
    const navigate = () => {
      upgradeLegacyRoute();
      const next = appRoute(window.location);
      if (next === 'tree') pendingViewport.current = viewportState;
      setFeedbackOrigin(next === 'feedback' ? feedbackHistoryOrigin(window.history.state) : null);
      setRoute(next);
    };
    window.addEventListener('hashchange', navigate); window.addEventListener('popstate', navigate);
    // Reconcile navigation that happened while the initial HTML was handing over to this app.
    navigate();
    return () => { window.removeEventListener('hashchange', navigate); window.removeEventListener('popstate', navigate); };
  }, [viewportState]);

  const root = index.get(rootId);
  const prerequisites = collectRequirements(root?.requirements);
  const successors = dependents.get(rootId) ?? [];
  const graph = useMemo(() => buildGraph(graphAnchors, index, dependents, expandedForward, expandedBackward, isVisible, hiddenForwardConnections, automaticConnections, revealedForwardConnections, addedIds, autoExpandedCourseIds),
    [graphAnchors, addedIds, index, dependents, expandedForward, autoExpandedCourseIds, expandedBackward, isVisible, hiddenForwardConnections, automaticConnections, revealedForwardConnections]);
  const visibleCourseIds = useMemo(() => new Set(graph.nodes.map(node => node.id)), [graph]);
  const forwardEdges = useMemo(() => graph.edges.filter(edge => edge.directions.includes('forward')), [graph]);
  const activeForwardConnections = useMemo(() => new Set(forwardEdges.map(edge => forwardConnectionId(edge.source, edge.target, edge.relation))), [forwardEdges]);
  const effectiveForward = useMemo(() => new Set(forwardEdges.map(edge => edge.source)), [forwardEdges]);
  const effectiveBackward = useMemo(() => {
    const selected = new Map([...expandedBackward].map(([id, ids]) => [id, new Set(ids)]));
    for (const edge of graph.edges) {
      if (!edge.directions.includes('backward')) continue;
      const ids = selected.get(edge.target) ?? new Set<string>();
      ids.add(edge.source); selected.set(edge.target, ids);
    }
    return selected;
  }, [expandedBackward, graph]);
  const addContext = useMemo(() => ({ courses: index, dependents, visibleCourseIds, isVisible }), [index, dependents, visibleCourseIds, isVisible]);
  // Added status and personal markings do not change geometry. Reuse layout for unchanged topology.
  const topology = useMemo(() => graph.nodes.map(node => node.id).sort().join(',') + '|' + graph.edges.map(edge => edge.id).sort().join(','), [graph]);
  // Adding/removing an already visible course changes styling, not geometry.
  const positions = useMemo(() => layoutCourseGraph(graph, graphAnchors), [topology, primaryCourseId]);
  const nodes: CourseFlowNode[] = useMemo(() => graph.nodes.map(node => ({
    id: node.id, type: 'course', position: positions.get(node.id)!, data: { graphNode: node },
    draggable: false, zIndex: node.added ? 2 : 1,
  })), [graph, positions]);
  const edges: Edge[] = useMemo(() => {
    const parallel = new Map<string, number>();
    for (const edge of graph.edges) {
      const key = edge.source + '>' + edge.target;
      parallel.set(key, (parallel.get(key) ?? 0) + 1);
    }
    return graph.edges.map(edge => ({
      ...edge, type: 'branch',
      data: {
        connectionId: forwardConnectionId(edge.source, edge.target, edge.relation), parentInstanceId: edge.source,
        childCourseId: edge.target, parentCourseId: edge.source, forward: edge.directions.includes('forward'),
        parallelOffset: parallel.get(edge.source + '>' + edge.target)! > 1 ? (edge.relation === 'strong' ? -14 : 14) : 0,
      },
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: edge.direction === 'backward' ? '#65a99a' : '#b5add7' },
      style: { stroke: edge.direction === 'backward' ? '#65a99a' : '#b5add7', strokeWidth: 1.6, strokeDasharray: edge.direction === 'backward' ? '5 5' : undefined },
    }));
  }, [graph]);

  useLayoutEffect(() => {
    const anchor = layoutAnchor.current;
    if (!anchor) return;
    layoutAnchor.current = null;
    const next = positions.get(anchor.id);
    if (next) void setViewport({ ...anchor.viewport, x: anchor.viewport.x + (anchor.position.x - next.x) * anchor.viewport.zoom, y: anchor.viewport.y + (anchor.position.y - next.y) * anchor.viewport.zoom }, { duration: 0 });
  }, [positions, graph, setViewport]);
  const rememberBranchAnchor = useCallback((id: string) => {
    const position = positions.get(id);
    if (position) layoutAnchor.current = { id, position, viewport: getViewport() };
    setBranchFocus(null);
  }, [positions, getViewport]);
  const hideForwardConnection = useCallback((connectionId: string, parentId: string) => {
    rememberBranchAnchor(parentId);
    dispatch({ type: 'hideConnection', connectionId });
  }, [rememberBranchAnchor]);
  const restoreForwardConnection = useCallback((connectionId: string, parentId: string) => {
    rememberBranchAnchor(parentId); dispatch({ type: 'restoreConnection', connectionId });
  }, [rememberBranchAnchor]);
  const revealAllForwardConnections = useCallback((parentId: string) => {
    const connectionIds = (dependents.get(parentId) ?? []).filter(child => isVisible(child.courseId))
      .map(child => forwardConnectionId(parentId, child.courseId, child.relation))
      .filter(id => !activeForwardConnections.has(id));
    rememberBranchAnchor(parentId);
    dispatch({ type: 'revealConnections', connectionIds });
  }, [dependents, isVisible, activeForwardConnections, rememberBranchAnchor]);
  const focusCourse = useCallback((courseId: string) => {
    nextFocusSequence.current += 1;
    setFocusRequest({ courseId, sequence: nextFocusSequence.current });
  }, []);
  useEffect(() => {
    if (exploration.focusRequest) focusCourse(exploration.focusRequest.courseId);
  }, [exploration.focusRequest, focusCourse]);
  useEffect(() => {
    if (!focusRequest || consumedFocus.current === focusRequest.sequence || route !== 'tree') return;
    const position = positions.get(focusRequest.courseId);
    if (!position) return;
    const frame = requestAnimationFrame(() => {
      consumedFocus.current = focusRequest.sequence;
      void setCenter(position.x + WIDTH / 2, position.y + HEIGHT / 2, { zoom: getViewport().zoom, duration: 350 });
      setFocusedCourseId(focusRequest.courseId);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest, positions, route, setCenter, getViewport]);
  useEffect(() => {
    if (!focusedCourseId) return;
    const timer = setTimeout(() => setFocusedCourseId(null), 1800);
    return () => clearTimeout(timer);
  }, [focusedCourseId, focusRequest?.sequence]);
  useEffect(() => {
    if (!dataset || !progressReady || route !== 'tree') return;
    if (pendingViewport.current) {
      const saved = pendingViewport.current; pendingViewport.current = undefined;
      requestAnimationFrame(() => setViewport(saved, { duration: 0 })); return;
    }
    pendingViewport.current = undefined;
    const frame = requestAnimationFrame(() => {
      const position = positions.get(rootId);
      const container = document.querySelector('.graph-canvas')?.getBoundingClientRect();
      if (position && container) void setCenter(position.x + WIDTH / 2 - container.width * 0.23, position.y + HEIGHT / 2,
        { zoom: container.width < 600 ? 0.75 : 0.9, duration: 450 });
    });
    return () => cancelAnimationFrame(frame);
  }, [dataset, rootViewVersion, isVisible, progressReady, route]);
  useEffect(() => {
    if (!branchFocus) return;
    const relevant = new Set([branchFocus.id]);
    for (const edge of graph.edges) {
      if (branchFocus.direction === 'forward' && edge.source === branchFocus.id) relevant.add(edge.target);
      if (branchFocus.direction === 'backward' && edge.target === branchFocus.id && (!branchFocus.courseId || edge.source === branchFocus.courseId)) relevant.add(edge.source);
    }
    const frame = requestAnimationFrame(() => fitView({ nodes: [...relevant].map(id => ({ id })), padding: 0.25, minZoom: 0.25, maxZoom: 0.95, duration: 400 }));
    return () => cancelAnimationFrame(frame);
  }, [branchFocus, fitView]);
  useEffect(() => {
    if (fitRequested) requestAnimationFrame(() => fitView({ padding: 0.18, maxZoom: 1, duration: 450 }));
  }, [fitRequested, fitView]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setModal(null); };
    const frame = requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.modal-close')?.focus());
    document.addEventListener('keydown', escape);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', escape); previous?.focus(); };
  }, [modal]);
  useEffect(() => {
    if (!exploration.treeMessage) return;
    const timer = setTimeout(() => dispatch({ type: 'clearMessage' }), 5000);
    return () => clearTimeout(timer);
  }, [exploration.treeMessage]);

  const selectRoot = useCallback((course: Course | string) => {
    const id = typeof course === 'string' ? course : course.id;
    if (!knownCourseIds.has(id)) return;
    pendingViewport.current = undefined; layoutAnchor.current = null;
    setViewportState(null); setBranchFocus(null);  setFocusRequest(null); setFocusedCourseId(null);
    setRecent(previous => [...new Set([rootId, ...addedCourseIds, ...previous].filter(Boolean))].filter(value => value !== id).slice(0, 4));
    dispatch({ type: 'selectRoot', courseId: id });
    setRootViewVersion(previous => previous + 1);
  }, [knownCourseIds, rootId, addedCourseIds]);
  const setCourseAdded = useCallback((id: string, added: boolean) => {
    if (!knownCourseIds.has(id)) return;
    rememberBranchAnchor(rootId || id);
    dispatch({ type: added ? 'addCourse' : 'removeCourse', courseId: id, context: addContext });
  }, [knownCourseIds, rootId, rememberBranchAnchor, addContext]);
  const locateAddedCourse = useCallback((id: string) => dispatch({ type: 'locateAdded', courseId: id, context: addContext }), [addContext]);
  const toggleForward = useCallback((id: string) => {
    rememberBranchAnchor(id);
    const children = (dependents.get(id) ?? []).filter(child => isVisible(child.courseId));
    const opening = !effectiveForward.has(id);
    dispatch({ type: 'toggleForward', courseId: id, children, active: !opening });
    if (opening && children.some(child => !visibleCourseIds.has(child.courseId))) setBranchFocus(previous => ({ id, direction: 'forward', version: (previous?.version ?? 0) + 1 }));
  }, [rememberBranchAnchor, dependents, isVisible, effectiveForward, visibleCourseIds]);
  const toggleBackward = useCallback((parentId: string, courseId: string) => {
    rememberBranchAnchor(parentId);
    const opening = !effectiveBackward.get(parentId)?.has(courseId);
    dispatch({ type: 'toggleBackward', parentId, courseId, active: !opening });
    if (opening && !visibleCourseIds.has(courseId)) setBranchFocus(previous => ({ id: parentId, courseId, direction: 'backward', version: (previous?.version ?? 0) + 1 }));
  }, [rememberBranchAnchor, effectiveBackward, visibleCourseIds]);
  const collapseBackward = useCallback((courseId: string) => {
    rememberBranchAnchor(rootId || courseId);
    dispatch({ type: 'collapseBackward', courseId });
  }, [rememberBranchAnchor, rootId]);
  const resetBranches = () => {
    layoutAnchor.current = null; pendingViewport.current = undefined; setViewportState(null); setBranchFocus(null);
    dispatch({ type: 'resetBranches' }); setRootViewVersion(previous => previous + 1);
  };
  const facultyCount = facultyOptions.filter(faculty => !faculty.id.includes('שיוך פקולטה לא זמין')).length;
  const hiddenConnections = graph.nodes.reduce((sum, node) => sum + (dependents.get(node.courseId) ?? []).filter(child => !isVisible(child.courseId)).length, 0);
  const catalogRoles = useCallback((courseId: string) => getCatalogRoles(courseId, activeCatalog, index), [activeCatalog, index]);
  const knownCount = courses.filter(course => course.requirementsStatus === 'known' || course.requirementsStatus === 'none').length;
  const termLabel = (term: string | undefined) => term ? term.replace('_', ' · ') : 'מקור הקורס';
  const openSearch = () => {
    if (window.matchMedia('(max-width: 640px)').matches) document.querySelector<HTMLButtonElement>('.mobile-search-toggle')?.click();
    else document.querySelector<HTMLInputElement>('.desktop-course-search .search-input')?.focus();
  };
  const openFeedback = (courseId?: string) => {
    const origin: FeedbackOrigin = { pageUrl: feedbackPageURL(window.location.href), route: appRoute(window.location), startingCourseId: progressReady && rootId ? rootId : undefined, ...(courseId ? { relevantCourseId: courseId } : {}) };
    setFiltersOpen(false);  setModal(null);
    navigateApp(courseId ? `/feedback?courseId=${encodeURIComponent(courseId)}` : '/feedback', { feedbackOrigin: origin });
  };
  const clearMarks = () => {if (window.confirm('לנקות את כל סימוני הקורסים? הענפים והמסננים יישמרו.')) setMarkings(emptyMarkedCourses());};
  const resetProgress = () => {if (window.confirm('לאפס את כל ההתקדמות השמורה, הענפים, המסננים וסימוני הקורסים בדפדפן הזה?')) {clearSaved(); setFiltersOpen(false); closeMobileTools();}};
  const openMobileTools = () => {setFiltersOpen(false); setModal(null); setMobileToolsOpen(true);};
  if (route === 'feedback') return <Suspense fallback={<StaticPublicPage route="feedback"/>}><FeedbackPage treeCourseId={progressReady ? rootId : undefined} origin={feedbackOrigin ?? { pageUrl: initialPage.current, route: 'feedback', startingCourseId: progressReady && rootId ? rootId : undefined, ...(validCourseNumber(requestedReportCourse) ? { relevantCourseId: requestedReportCourse } : {}) }} courseId={feedbackOrigin?.relevantCourseId ?? (validCourseNumber(requestedReportCourse) ? requestedReportCourse : undefined)}/></Suspense>;
  if (route === 'about') return <AboutPage treeCourseId={progressReady ? rootId : undefined}/>;
  if ((!dataset||!progressReady)&&!loadError&&!modal) return <StaticPublicPage route="tree" onHelp={()=>setModal('help')}/>;

  return <div className="app-shell" dir="rtl" inert={mobileToolsOpen || undefined} style={{'--marked-course':MARKED_COURSE_COLOR} as React.CSSProperties}>
    <AppHeader courses={filteredCourses} allCourses={courses} filtered={hasFilters} disabled={!dataset||!progressReady} searchAll={searchAll} onSearchAllChange={setSearchAll} onSelect={selectRoot} addedCourseIds={addedCourseIds} onAddedChange={(course,added)=>setCourseAdded(course.id,added)} onHelp={()=>setModal('help')} onFeedback={()=>openFeedback()}/>

    <main className="workspace">
      <aside className="sidebar">
        <ExplorerIntro/>
        <div className="sidebar-section-label">{'הקורס הנבחר'} <span className="status-dot"/></div>
        <div className="root-summary" style={{'--faculty-accent':courseAppearance(root).accent} as React.CSSProperties}><span className="root-summary-icon"><BookOpen size={21}/></span>{root ? <><CourseLink course={root} id={root.id}/><h2>{root.name}</h2><p>{root.faculty}{root.credits !== undefined ? ` · ${root.credits} נקודות זכות` : ''}</p></> : dataset && progressReady ? rootId ? <><CourseLink id={rootId}/><h2>פרטי המקצוע אינם במאגר</h2></> : <><h2>אין קורס נבחר</h2><p>בחרו מקצוע בחיפוש או ברשימת המסומנים.</p></> : <div className="skeleton skeleton-root"/>}<div className="root-summary-stats"><div><strong>{successors.filter(child => isVisible(child.courseId)).length}</strong><span>קורסי המשך{successors.some(child => !isVisible(child.courseId)) ? ` · ${successors.filter(child => !isVisible(child.courseId)).length} מוסתרים` : ''}</span></div><div><strong>{prerequisites.length}</strong><span>קדמים ישירים</span></div></div></div>
        <ExplorerInstructions/>
        {recent.length > 0 && <div className="recent-courses"><div className="sidebar-section-label">ביקרתם לאחרונה</div>{recent.map(id => { const course = index.get(id); return course && <button key={id} onClick={() => selectRoot(course)}><span>{course.name}</span><ChevronLeft size={14}/></button>; })}</div>}
        <div className="sidebar-bottom"><div className="data-status"><span/><span>{dataset ? `${courses.length.toLocaleString('he')} קורסים · ${facultyCount} פקולטות ויחידות` : 'טוענים את מאגר הקורסים…'}</span></div><button onClick={() => setModal('data')}><Database size={14}/>על המאגר ומקורות המידע<ChevronLeft size={13}/></button><small>כל הפקולטות. מעבר לסמסטר אחד.</small></div>
      </aside>

      <section className="map-workspace" aria-label="מפת קשרי הקורסים">
        <div className="map-toolbar"><div className="map-heading"><span className="map-heading-icon"><GitBranch size={18}/></span><div><h2>מפת הקשרים</h2><p>כל חיבור הוא צעד חדש לגלות</p></div><span className="visible-count">{graph.nodes.length} קורסים במפה</span></div><div className="map-actions"><button ref={filtersTrigger} className={`filters-trigger ${hasFilters ? 'active' : ''}`} aria-label="פתיחת מסנני המפה" aria-expanded={filtersOpen} disabled={!progressReady} onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={15}/><span>מסננים</span>{hasFilters && <i/>}</button>{mobile ? <button ref={mobileToolsTrigger} className="mobile-tools-trigger" type="button" aria-label="כלים" title="כלים" aria-haspopup="dialog" aria-expanded={mobileToolsOpen} aria-controls={mobileToolsOpen ? 'mobile-tools-drawer' : undefined} disabled={!progressReady} onClick={openMobileTools}><Menu size={19}/></button> : <PrerequisiteHighlightToggle enabled={highlightSatisfiedPrerequisites} onChange={setHighlightSatisfiedPrerequisites} disabled={!progressReady}/>}{!mobile && <><button onClick={resetBranches} disabled={!dataset} title="איפוס ענפי העץ"><RotateCcw size={15}/><span>איפוס ענפים</span></button><button className="layers-button" disabled={!dataset} onClick={() => dispatch({type:'expandVisible',courseIds:graph.nodes.filter(node => !node.missing).map(node => node.id)})}><Layers size={15}/><span>עוד שכבה</span></button></>}</div></div>
        {exploration.treeMessage && <div className="pin-notice" role="status">{exploration.treeMessage}</div>}
        {hasFilters && <div className="active-filter-summary" aria-live="polite"><div><strong>{activeCatalog ? `קטלוג נבחר: ${activeCatalog.officialName}${activeCatalog.track && !activeCatalog.officialName.includes(activeCatalog.track) ? ` — ${activeCatalog.track}` : ''} (${activeCatalog.catalogYear})` : 'סינון לפי פקולטה'}</strong>{activeCatalog && <span className="catalog-scope-notice">{activeCatalog.coverage.status === 'inventory-only' ? 'תכנית מתועדת בלבד · דרישות הלימודים טרם אומתו; אין רשימת קורסי המשך מאושרת' : 'ייבוא חלקי של רשימות וכללים · תנאי המקור והמידע החסר מפורטים במסננים; אין אישור זכאות אוטומטי'}</span>}<span>{selectedFaculties.size} מתוך {facultyOptions.length} אפשרויות שיוך · {filteredCourses.length} קורסים מתאימים · {hiddenConnections} קשרי המשך מוסתרים</span>{graphAnchors.some(id => !isVisible(id)) && <span className="root-filter-warning">קורסים שבחרתם מחוץ לסינון נשארים בעץ. קדמים פתוחים מוצגים ללא סינון.</span>}</div><button aria-label="איפוס כל המסננים" onClick={() => { setFacultySelection(null); setCatalogId(''); }}><X size={14}/><span>איפוס סינון</span></button></div>}
        <div className="graph-canvas">
          <MobileCourseSearch blocked={mobileToolsOpen || filtersOpen || !!modal} courses={filteredCourses} allCourses={courses} filtered={hasFilters} disabled={!dataset || !progressReady} searchAll={searchAll} onSearchAllChange={setSearchAll} onSelect={selectRoot} addedCourseIds={addedCourseIds} onAddedChange={(course, added) => setCourseAdded(course.id, added)}/>
          {dataset && progressReady ? <>
            <ExplorerContext.Provider value={{ courses: index, dependents, expandedForward:effectiveForward, activeForwardConnections, expandedBackward:effectiveBackward, primaryCourseId, addedCourseIds, setCourseAdded, collapseBackward, focusedCourseId, toggleForward, toggleBackward, setRoot: selectRoot, catalogTerm: String(dataset.meta.latestTerm), isVisible, activeCatalog, catalogRoles, hasFilters, markedCourseIds, suppressCoursePanels: mobileToolsOpen || filtersOpen || !!modal, highlightSatisfiedPrerequisites, prerequisiteSatisfaction, toggleMarked, hiddenForwardConnections, hideForwardConnection, restoreForwardConnection, revealAllForwardConnections, reportCourse:openFeedback }}>
              <ReactFlow<CourseFlowNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} minZoom={0.15} maxZoom={1.8} nodesConnectable={false} nodesDraggable={false} elementsSelectable={false} panOnDrag zoomOnDoubleClick={false} defaultViewport={viewportState??undefined} onMoveEnd={(_,viewport)=>setViewportState(viewport)} proOptions={{ hideAttribution: true }}>
                <Background variant={BackgroundVariant.Dots} gap={22} size={1.1} color="#dadbe5"/>
              </ReactFlow>
              {graphAnchors.length === 0 && <div className="loading-state empty-graph-state" role="status"><Search size={28}/><h2>בחרו מקצוע להתחלת המפה</h2><p>חפשו קורס או הוסיפו קורס מרשימת המסומנים.</p><button onClick={openSearch}>חיפוש מקצוע</button></div>}
            </ExplorerContext.Provider>
            <div className="canvas-direction"><span><span className="direction-line forward"/>קורסי המשך <ArrowLeft size={13}/></span><span><ArrowRight size={13}/> קדמים<span className="direction-line backward"/></span></div>
            <div className="canvas-controls" dir="ltr"><button aria-label="הגדלת המפה" title="הגדלה" onClick={() => zoomIn({ duration: 250 })}><Plus size={18}/></button><span>{Math.round(zoom * 100)}%</span><button aria-label="הקטנת המפה" title="הקטנה" onClick={() => zoomOut({ duration: 250 })}><Minus size={18}/></button><i/><button aria-label="התאמת המפה למסך" title="התאמה למסך" onClick={() => setFitRequested(value => value + 1)}><Focus size={18}/></button></div>
            {!mobile && <div className="map-legend"><span className="legend-title">מקרא</span><span><i className="legend-faculty"/>מסגרת: פקולטה</span><span><i className="legend-marked"/>סימון אישי</span><span><i className="legend-node strong"/>קדם חזק</span><span><i className="legend-node concurrent"/>מקצוע צמוד</span><button aria-label="הסבר על סוגי הקשרים" onClick={() => setModal('help')}><CircleHelp size={14}/></button></div>}
            <div className="canvas-pan-hint"><Move size={13}/>גררו להזזה · גללו לשינוי קנה מידה</div>
            {graphAnchors.length === 1 && graph.nodes.length === 1 && <div className="single-node-hint">{successors.length > 0 && successors.every(child => !isVisible(child.courseId)) ? 'קורסי ההמשך מוסתרים על ידי המסננים. אפשר לשנות סינון; חקירת קדמים נשארת פתוחה.' : successors.some(child=>isVisible(child.courseId)&&hiddenForwardConnections.has(forwardConnectionId(rootId,child.courseId,child.relation))) ? 'ענפים מוסתרים אישית. אפשר להחזירם דרך ״הצגת ענפים״ ליד הקורס.' : successors.length === 0 ? 'אין במאגר קורסי המשך לקורס הזה. אפשר לחקור את הקדמים או לבחור קורס אחר.' : 'לחצו על + בכרטיס כדי לפתוח את קורסי ההמשך.'}</div>}
          </> : loadError ? <div className="loading-state"><CircleHelp size={32}/><h2>לא הצלחנו לטעון את המאגר</h2><p>בדקו את החיבור ונסו שוב.</p><button onClick={() => window.location.reload()}>טעינה מחדש</button></div> : <ExplorerLoadingContent/>}
        </div>
        <div className="map-footnote"><ShieldCheck size={15}/><p>{graph.truncated && <strong role="status">המפה גדולה מאוד, ולכן מוצג חלק ממנה. צמצמו ענפים או מסננים כדי להמשיך. </strong>}קשר במפה מציין דרישה לקורס. ייתכנו דרישות נוספות או חלופיות — בדקו את כלל הקדמים המלא בחלונית הקורס.</p><button onClick={() => setModal('data')}>פרטי המאגר<ExternalLink size={12}/></button></div>
      </section>
    </main>
    <SiteFooter markedCourseQuantities={markedCourseQuantities} onQuantityChange={changeMarkedQuantity} treeCourseId={rootId} courses={index} markedCourseIds={markedCourseIds} addedCourseIds={addedCourseIds} visibleCourseIds={visibleCourseIds} onAddedChange={setCourseAdded} onLocateAddedCourse={locateAddedCourse} onFocusCourse={focusCourse} onSelectCourse={selectRoot} onToggleMarked={toggleMarked} markedCount={markedCourseIds.size} storageAvailable={storageAvailable} onClearMarks={clearMarks} onResetProgress={resetProgress}/>
    {mobile && mobileToolsOpen && <MobileToolsDrawer markedCourseQuantities={markedCourseQuantities} onQuantityChange={changeMarkedQuantity} courses={index} addedCourseIds={addedCourseIds} markedCourseIds={markedCourseIds} visibleCourseIds={visibleCourseIds} highlightSatisfiedPrerequisites={highlightSatisfiedPrerequisites} storageAvailable={storageAvailable} onAddedChange={setCourseAdded} onLocateAddedCourse={locateAddedCourse} onFocusCourse={focusCourse} onSelectCourse={selectRoot} onToggleMarked={toggleMarked} onHighlightChange={setHighlightSatisfiedPrerequisites} onExpandLayer={() => dispatch({type:'expandVisible',courseIds:graph.nodes.filter(node => !node.missing).map(node => node.id)})} onResetBranches={resetBranches} onClearMarks={clearMarks} onResetProgress={resetProgress} onClose={closeMobileTools} triggerRef={mobileToolsTrigger} fallbackFocusRef={filtersTrigger}/>}
    {filtersOpen && <Suspense fallback={<div className="filter-loading" role="status">טוענים מסננים…</div>}><FilterPanel faculties={facultyOptions} selected={selectedFaculties} onFacultiesChange={setFacultySelection} catalogs={catalogs} catalogError={catalogError} activeCatalog={activeCatalog} onCatalogChange={id=>{setCatalogId(id);const program=catalogs?.programs.find(p=>p.id===id);if(program)setCatalogYear(program.catalogYear);}} tab={filterTab} onTabChange={setFilterTab} year={catalogYear} onYearChange={setCatalogYear} catalogFaculty={catalogFaculty} onCatalogFacultyChange={setCatalogFaculty} courses={index} onCourseSelect={selectRoot} onClose={closeFilters}/></Suspense> }
    {modal && <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}><div className={`modal ${modal === 'help' ? 'help-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button,a[href],summary')).filter(el => !el.hasAttribute('disabled') && el.getClientRects().length > 0);
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}><button className="modal-close icon-button" aria-label="סגירה" onClick={() => setModal(null)}><X size={20}/></button><span className="modal-icon">{modal === 'help' ? <GitBranch size={25}/> : <Database size={25}/>}</span><h2 id="modal-title">{modal === 'help' ? 'איך זה עובד?' : 'הנתונים שמאחורי המפה'}</h2>
      {modal === 'help' ? <HelpGuide/> : <><p>מאגר מאוחד של קורסי הטכניון מכל הפקולטות, ממספר סמסטרים ושנים. המפה אינה תכנית לימודים לסמסטר מסוים.</p><div className="dataset-stats"><div><strong>{courses.length.toLocaleString('he')}</strong><span>קורסים במאגר</span></div><div><strong>{facultyCount}</strong><span>פקולטות ויחידות במקור</span></div><div><strong>{knownCount.toLocaleString('he')}</strong><span>רשומות ללא עמימות במקור</span></div></div><p className="coverage-note">{dataset?.courses.length.toLocaleString('he')} רשומות SAP ו־{catalogs?.referencedCourses?.length ?? 0} הפניות קטלוג ללא פרטי קדמים<br/>{String(dataset?.meta.termCount ?? 8)} סמסטרים במאגר · {String(dataset?.meta.earliestTerm ?? "")} עד {String(dataset?.meta.latestTerm ?? "")}<br/>{String((dataset?.meta.requirementStatuses as Record<string, number>)?.unparsed ?? 0)} כללים עמומים אינם מופיעים כקשרים · {String(dataset?.meta.missingReferencedCourseCount ?? 0)} הפניות לקורסים ללא רשומה מלאה</p><ul className="source-policy"><li>לכל קורס נשמרת הרשומה העדכנית ביותר במקורות שנאספו. כללים מסמסטרים שונים אינם מחוברים זה לזה.</li><li>מספרי קורס ישנים מזוהים באמצעות כינויים מפורשים. הרשומה נשמרת לפי המספר העדכני במקור.</li><li>מידע חסר או עמום מסומן כחסר; לא נוצרים עבורו קשרים משוערים.</li><li>מקצועות חופפים ומקצועות ללא זיכוי נוסף אינם קדמים ואינם הופכים לקשרים במפה.</li></ul>{root && <div className="current-source"><strong>מקור הקורס הנבחר</strong><span>{root.name} · {termLabel(root.source.term)}</span><a href={officialSourceURL(root.source.url)} target="_blank" rel="noopener noreferrer">עמוד הקורס בקטלוג הטכניון <ExternalLink size={13}/></a></div>}<div className="source-links"><a href="https://github.com/michael-maltsev/technion-sap-info-fetcher" target="_blank" rel="noopener noreferrer">מאגר נתוני SAP <ExternalLink size={13}/></a><a href="data/courses.json" download>הורדת המאגר המעובד <ArrowDownLeft size={13}/></a></div><p className="modal-note">דרישות עשויות להשתנות בין שנים. לפני רישום, בדקו את הקטלוג הרשמי ואת התקנון החל עליכם. מידע חלקי אינו מעיד שאין לקורס קדמים.</p></>}
      <button className="modal-primary" onClick={() => setModal(null)}><Check size={16}/>ממשיכים לגלות</button>
    </div></div>}
  </div>;
}
