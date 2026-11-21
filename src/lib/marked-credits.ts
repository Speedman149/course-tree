import type {Course} from '../types';

/** Sum the full marking collection, independently of graph visibility or additions. */
export function summarizeMarkedCredits(courses: ReadonlyMap<string, Course>, markedIds: Iterable<string>) {
  const countedIds = new Set<string>();
  let knownCredits = 0;
  let missingCreditCount = 0;
  for (const id of markedIds) {
    const course = courses.get(id);
    const canonicalId = course?.id ?? id;
    if (countedIds.has(canonicalId)) continue;
    countedIds.add(canonicalId);
    const credits = course?.credits;
    if (typeof credits === 'number' && Number.isFinite(credits) && credits >= 0) knownCredits += credits;
    else missingCreditCount++;
  }
  return {knownCredits, missingCreditCount};
}

// Format only the final sum; keep individual source values unchanged.
export const creditTotalFormat = new Intl.NumberFormat('he-IL', {maximumFractionDigits: 12});
