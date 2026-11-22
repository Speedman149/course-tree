import type {Course, Requirement} from '../types';

export const PREREQUISITE_HIGHLIGHT_LABEL = 'הדגש קורסים שכל הקדמים הרגילים שלהם מסומנים';
export const PREREQUISITE_HIGHLIGHT_SHORT_LABEL = 'הדגשת קורסים לפי קדמים מסומנים';
export type SatisfactionStatus = 'satisfied' | 'unsatisfied' | 'unknown';
export interface PrerequisiteSatisfaction {
  status: SatisfactionStatus;
  hasOrdinary: boolean;
  hasConcurrent: boolean;
}

const unknown = (): PrerequisiteSatisfaction => ({status: 'unknown', hasOrdinary: false, hasConcurrent: false});

/** Direct ordinary requirements only. Never consult graph edges or recurse into another course. */
export function evaluatePrerequisites(course: Course | undefined, markedIds: ReadonlySet<string>): PrerequisiteSatisfaction {
  if (!course) return unknown();
  if (course.requirementsStatus === 'none' && course.requirements === null) {
    return {status: 'satisfied', hasOrdinary: false, hasConcurrent: false};
  }
  if (course.requirementsStatus !== 'known' || !course.requirements) return unknown();

  function evaluate(requirement: Requirement): PrerequisiteSatisfaction {
    if (requirement.type === 'course') {
      if (requirement.relation === 'concurrent') return {status: 'satisfied', hasOrdinary: false, hasConcurrent: true};
      if (requirement.relation !== 'strong' || !requirement.courseId) return unknown();
      return {status: markedIds.has(requirement.courseId) ? 'satisfied' : 'unsatisfied', hasOrdinary: true, hasConcurrent: false};
    }
    // Empty/malformed groups are incomplete evidence, never vacuous success.
    if (!['and', 'or'].includes(requirement.type) || !requirement.items.length) return unknown();
    const children = requirement.items.map(evaluate);
    const hasOrdinary = children.some(child => child.hasOrdinary);
    const hasConcurrent = children.some(child => child.hasConcurrent);
    let status: SatisfactionStatus;
    if (requirement.type === 'and') {
      status = children.some(child => child.status === 'unsatisfied') ? 'unsatisfied'
        : children.every(child => child.status === 'satisfied') ? 'satisfied' : 'unknown';
    } else if (hasOrdinary && children.some(child => !child.hasOrdinary && child.hasConcurrent && child.status === 'satisfied')) {
      // A concurrent-only OR alternative cannot prove ordinary satisfaction.
      // Prefer a confirmed ordinary alternative; otherwise the separation is ambiguous.
      status = children.some(child => child.hasOrdinary && child.status === 'satisfied') ? 'satisfied' : 'unknown';
    } else {
      status = children.some(child => child.status === 'satisfied') ? 'satisfied'
        : children.every(child => child.status === 'unsatisfied') ? 'unsatisfied' : 'unknown';
    }
    return {status, hasOrdinary, hasConcurrent};
  }
  return evaluate(course.requirements);
}
