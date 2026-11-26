import palette from '../data/faculty-palette.json' with {type:'json'};
import type {Course} from '../types';
import {courseFaculties,facultyId,facultyLabels} from './filters';
export const facultyPalette = palette;
export const NEUTRAL_FACULTY_COLOR = '#637083';
export const MARKED_COURSE_COLOR = '#C62B3D';
export function facultyColor(id: string): string {
  return palette.find(faculty=>faculty.id===id)?.accent ?? NEUTRAL_FACULTY_COLOR;
}
export function courseAppearance(course?: Course) {
  const owners=course?courseFaculties(course):[];
  const primary=course?facultyId(course.faculty):'';
  // Ownership and color never depend on visible nodes or active filters.
  const id=owners.includes(primary)?primary:[...owners].sort()[0]??'';
  return {id,accent:facultyColor(id),label:facultyLabels.get(id)??course?.faculty??'שיוך לא ידוע',owners};
}
/** Rendering-only indirection lets portals and SVGs inherit the dark palette without changing ownership. */
export function facultyDisplayColor(id:string):string {
 const key=palette.some(f=>f.id===id)?id:'neutral';
 return `var(--faculty-${key},${facultyColor(id)})`;
}
