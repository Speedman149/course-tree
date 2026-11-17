import type { Course, DegreeCatalog } from '../types';

// Match the offering-unit labels in the source; never infer ownership from a number or a degree.
const labels: Record<string, string[]> = {
  cs: ['הפקולטה למדעי המחשב'], math: ['הפקולטה למתמטיקה'], physics: ['הפקולטה לפיזיקה'],
  ee: ['הפקולטה להנדסת חשמל ומחשבים'], mechanical: ['הפקולטה להנדסת מכונות'],
  civil: ['הפקולטה להנדסה אזרחית וסביבתית'], chemical: ['הפקולטה להנדסה כימית'],
  biotechnology: ['הפקולטה להנדסת ביוטכנולוגיה ומזון'], chemistry: ['הפקולטה לכימיה'],
  biology: ['הפקולטה לביולוגיה'], aerospace: ['הפקולטה להנדסת אווירונוטיקה וחלל', 'הפקולטה להנדסת אוירונוטיקה וחלל', 'הפקולטה להנדסת אוירונאוטיקה וחלל'],
  data: ['הפקולטה למדעי הנתונים וההחלטות', 'מדעי הנתונים וההחלטות'],
  biomedical: ['הפקולטה להנדסה ביו-רפואית'], medicine: ['הפקולטה לרפואה'],
  architecture: ['הפקולטה לארכיטקטורה ובינוי ערים'], materials: ['הפקולטה למדע והנדסה של חומרים'],
  education: ['חינוך למדע וטכנולוגיה'], humanities: ['המחלקה ללימודים הומניסטיים ואמנות'],
};
export const facultyLabels = new Map(Object.entries(labels).map(([id, names]) => [id, names[0].replace(/^הפקולטה ל/, '')]));
export function facultyId(label: string): string {
  return Object.entries(labels).find(([, names]) => names.includes(label))?.[0] ?? `unit:${label}`;
}
export function courseFaculties(course: Course): string[] {
  return [...new Set((course.faculties?.length ? course.faculties : [course.faculty]).map(facultyId))];
}
export interface FacultyOption { id: string; label: string; sourceLabels: string[]; courseCount: number }
export function getFacultyOptions(courses: readonly Course[]): FacultyOption[] {
  const options = new Map<string, FacultyOption>();
  for (const course of courses) {
    for (const label of course.faculties?.length ? course.faculties : [course.faculty]) {
      const id = facultyId(label);
      if (!options.has(id)) options.set(id, { id, label: facultyLabels.get(id) ?? label, sourceLabels: [], courseCount: 0 });
      const option = options.get(id)!;
      if (!option.sourceLabels.includes(label)) option.sourceLabels.push(label);
    }
    for (const id of courseFaculties(course)) options.get(id)!.courseCount++;
  }
  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, 'he'));
}
export interface CatalogRole { id: string; label: string; conditional: boolean; description?: string }
export function getCatalogRoles(courseId: string, catalog: DegreeCatalog | null, courses: ReadonlyMap<string, Course>): CatalogRole[] {
  if (!catalog || catalog.coverage.status === 'inventory-only') return [];
  const roles: CatalogRole[] = [];
  if (catalog.mandatoryCourseIds.includes(courseId)) roles.push({ id: 'mandatory', label: 'חובה', conditional: false });
  if (catalog.additionalEligibleCourseIds.includes(courseId)) roles.push({ id: 'additional', label: 'קורס מוכר נוסף', conditional: false });
  for (const group of catalog.electiveGroups) {
    const course = courses.get(courseId);
    const inSourceYear = !course?.availableSourceTerms || course.availableSourceTerms.some(term => term.startsWith(catalog.catalogYear.slice(0, 4) + '_'));
    const rule = group.rules.find(rule => rule.automatic && inSourceYear && !rule.excludeCourseIds?.includes(courseId) && (rule.kind === 'all-courses' || (rule.kind === 'course-prefix' && rule.coursePrefixes?.some(prefix => courseId.startsWith(prefix))) || (rule.kind === 'faculty' && course && courseFaculties(course).some(id => rule.facultyIds?.includes(id)))));
    if (group.courseIds.includes(courseId) || rule) roles.push({
      id: group.id,
      label: `${group.role === 'mandatory' ? 'חובה' : group.role === 'mandatory-choice' ? 'חלופת חובה' : group.role === 'specialization' ? 'התמחות' : group.role === 'additional' ? 'קורס בתכנית' : 'בחירה'} — ${group.name}`,
      conditional: group.conditions.length > 0,
      description: [...group.conditions, ...(rule ? [rule.description] : [])].join(' · '),
    });
  }
  return roles;
}
export function createCourseVisibility(courses: readonly Course[], selectedFaculties: ReadonlySet<string>, catalog: DegreeCatalog | null): (courseId: string) => boolean {
  const index = new Map(courses.map(course => [course.id, course]));
  const allowed = new Set(courses.filter(course => courseFaculties(course).some(id => selectedFaculties.has(id)) && (!catalog || getCatalogRoles(course.id, catalog, index).length > 0)).map(course => course.id));
  return id => allowed.has(id);
}
