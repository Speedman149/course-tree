import type {Course} from '../types';
import {normalizedQuantity} from './repeatable-courses';

export interface MarkedCoursesState {ids: Set<string>; quantities: Record<string, number>}
export const emptyMarkedCourses = (): MarkedCoursesState => ({ids: new Set(), quantities: {}});

export function setCourseMarked(state: MarkedCoursesState, id: string, marked: boolean): MarkedCoursesState {
  if (state.ids.has(id) === marked) return state;
  const ids = new Set(state.ids), quantities = {...state.quantities};
  if (marked) ids.add(id); else ids.delete(id);
  delete quantities[id];
  return {ids, quantities};
}

export function setMarkedQuantity(state: MarkedCoursesState, course: Course | undefined, value: unknown): MarkedCoursesState {
  if (!course || !state.ids.has(course.id)) return state;
  const quantity = normalizedQuantity(course, value);
  const quantities = {...state.quantities};
  if (quantity > 1) quantities[course.id] = quantity; else delete quantities[course.id];
  // Retain the marking Set: quantities do not change graph/prerequisite state.
  return {ids: state.ids, quantities};
}
