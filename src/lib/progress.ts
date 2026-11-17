import type { Course, DegreeCatalog } from '../types';
import { buildDependents, collectRequirements, resolveCourseId } from './graph';
export const PROGRESS_KEY = 'course-tree.progress';
export const PROGRESS_VERSION = 2;
export interface Progress {
  rootId: string;
  expandedForward: string[];
  hiddenForwardConnections: string[];
  expandedBackward: [string, string[]][];
  facultyIds: string[] | null;
  catalogId: string;
  catalogYear: string;
  catalogFaculty: string;
  filterTab: 'faculty' | 'catalog';
  searchAll: boolean;
  markedCourseIds: string[];
  recent: string[];
  viewport: {x: number; y: number; zoom: number} | null;
}
export interface ProgressDatabase {
  courses: ReadonlyMap<string, Course>;
  facultyIds: ReadonlySet<string>;
  programs: readonly DegreeCatalog[] | null;
  years: readonly string[];
  defaultYear: string;
  defaultRoot: string;
}
export const defaultProgress = (db: ProgressDatabase): Progress => ({rootId: db.defaultRoot, expandedForward: ['root'], hiddenForwardConnections: [], expandedBackward: [], facultyIds: null, catalogId: '', catalogYear: db.defaultYear, catalogFaculty: '', filterTab: 'faculty', searchAll: false, markedCourseIds: [], recent: [], viewport: null});
const strings = (value: unknown, limit = 6000): string[] => Array.isArray(value) ? [...new Set(value.slice(0,limit).filter((id): id is string => typeof id === 'string'))] : [];
export function validateProgress(value: unknown, db: ProgressDatabase, urlCourse?: string | null): Progress {
  const defaults=defaultProgress(db);
  const raw = value && typeof value === 'object' ? value as Partial<Progress> : {};
  const requested = urlCourse ? resolveCourseId(urlCourse, new Map(db.courses)) : null;
  const validRoot = typeof raw.rootId === 'string' && db.courses.has(raw.rootId);
  const rootId=requested ?? (validRoot ? raw.rootId! : defaults.rootId);
  const keepBranches=validRoot && rootId===raw.rootId;
  const dependents=buildDependents([...db.courses.values()]);
  const knownIds=new Set([...db.courses.keys(), ...[...db.courses.values()].flatMap(course=>collectRequirements(course.requirements).map(r=>r.courseId))]);
  // Validate each stable path against actual source relationships, independently of
  // active visibility. Hidden/collapsed descendants must survive filter changes.
  const validInstance=(id: string): string | null => {
    if(id.length>5000 || !/^root(?:\/[fb]:\d{8}:(?:strong|concurrent))*$/.test(id))return null;
    const parts=id.split('/');if(parts.length>60)return null;
    let current=rootId;
    for(const part of parts.slice(1)){
      const [direction,next,relation]=part.split(':');
      const leaves=direction==='f' ? dependents.get(current)??[] : collectRequirements(db.courses.get(current)?.requirements);
      if(!leaves.some(leaf=>leaf.courseId===next&&leaf.relation===relation))return null;
      current=next;
    }
    return current;
  };
  const program=typeof raw.catalogId==='string' ? db.programs?.find(p=>p.id===raw.catalogId) : null;
  const catalogId=db.programs ? program?.id??'' : typeof raw.catalogId==='string' ? raw.catalogId.slice(0,200) : '';
  const viewport=raw.viewport;
  const validViewport=viewport && [viewport.x,viewport.y,viewport.zoom].every(n=>typeof n==='number'&&Number.isFinite(n)) && Math.abs(viewport.x)<1e7 && Math.abs(viewport.y)<1e7 && viewport.zoom>=.15 && viewport.zoom<=1.8;
  const backward: [string,string[]][]=[];
  if(keepBranches && Array.isArray(raw.expandedBackward)) for(const pair of raw.expandedBackward.slice(0,1500)){
    if(!Array.isArray(pair)||typeof pair[0]!=='string')continue;
    const courseId=validInstance(pair[0]);if(!courseId)continue;
    const allowed=new Set(collectRequirements(db.courses.get(courseId)?.requirements).map(r=>r.courseId));
    const ids=strings(pair[1]).filter(id=>allowed.has(id));if(ids.length)backward.push([pair[0],ids]);
  }
  return {...defaults,rootId,
    expandedForward:keepBranches?strings(raw.expandedForward,1500).filter(id=>validInstance(id)!==null):defaults.expandedForward,
    expandedBackward:backward,
    hiddenForwardConnections:keepBranches?strings(raw.hiddenForwardConnections,1500).filter(id=>/\/f:[^/]+$/.test(id)&&validInstance(id)!==null):[],
    facultyIds:raw.facultyIds===null||!Array.isArray(raw.facultyIds)?null:strings(raw.facultyIds).filter(id=>db.facultyIds.has(id)),
    catalogId,catalogYear:raw.catalogYear===''?'':typeof raw.catalogYear==='string'&&db.years.includes(raw.catalogYear)?raw.catalogYear:program?.catalogYear??defaults.catalogYear,
    catalogFaculty:typeof raw.catalogFaculty==='string'&&(db.facultyIds.has(raw.catalogFaculty)||db.programs?.some(p=>p.facultyIds.includes(raw.catalogFaculty!)))?raw.catalogFaculty:'',
    filterTab:raw.filterTab==='catalog'?'catalog':'faculty',searchAll:raw.searchAll===true,
    markedCourseIds:strings(raw.markedCourseIds).filter(id=>knownIds.has(id)),recent:strings(raw.recent,4).filter(id=>db.courses.has(id)),
    viewport:keepBranches&&validViewport?{x:viewport!.x,y:viewport!.y,zoom:viewport!.zoom}:null,
  };
}
export function decodeProgress(raw: string | null): unknown {
  if(!raw || raw.length>2_000_000)return null;
  try {
    const saved=JSON.parse(raw);
    if(!saved?.progress || typeof saved.progress!=='object')return null;
    if(saved.version===1)return {...saved.progress,hiddenForwardConnections:[]};
    return saved.version===PROGRESS_VERSION?saved.progress:null;
  }catch{return null;}
}
export function encodeProgress(progress: Progress): string {
  return JSON.stringify({version:PROGRESS_VERSION,savedAt:new Date().toISOString(),progress});
}