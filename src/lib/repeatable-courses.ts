import type {Course} from '../types';

/** Explicit personal-counting whitelist. These entries do not create course records
 * or certify degree recognition. Retain the existing bounded 1–8 counting UI.
 * Credits always come from the actual Course record, never this configuration.
 */
const personalCountingRule = {
  maxCountedOccurrences: 8,
  rangeBasis: 'personal-counting-limit',
  sources: [],
} as const;
export const REPEATABLE_COURSES = {
  '03940800': personalCountingRule,
  '03940801': personalCountingRule,
  '03940802': personalCountingRule,
  '03940803': personalCountingRule,
  '03940804': personalCountingRule,
  '03940805': personalCountingRule,
  '03940806': personalCountingRule,
  '03940807': personalCountingRule,
  '03940808': personalCountingRule,
  '03940809': personalCountingRule,
  '03940810': personalCountingRule,
  '03940820': personalCountingRule,
  '03940900': personalCountingRule,
  '03940901': personalCountingRule,
  '03940902': {
    maxCountedOccurrences: 8,
    verifiedOn: '2026-11-24',
    rangeBasis: 'documented-table-range',
    sources: [
      {label: 'טבלת הכרה רשמית — עמוד 1', url: 'https://humanities.technion.ac.il/wp-content/uploads/2022/06/טבלה-החרגה-מחובת-לימודי-העשרה.pdf'},
      {label: 'פרשיות חורף תשפ״ז — עמוד 10', url: 'https://ugportal.technion.ac.il/wp-content/uploads/2026/11/פרשיות-לימוד-הומניסטים-תשפז-חורף.pdf'},
    ],
  },
} as const;
export type MarkedCourseQuantities = Readonly<Record<string, number>>;

// The supplied modern PE IDs have explicit old six-digit forms: e.g.
// 03940803 → 394803, NOT 940803 (an unrelated course). Seven-digit forms
// are also present as aliases in the source database. Never match by name.
const rulesById = new Map(Object.entries(REPEATABLE_COURSES).flatMap(([id, rule]) =>
  [id, id.slice(1), `394${id.slice(5)}`].map(form => [form, rule] as const),
));

export function repeatRule(course: Course | undefined) {
  if (!course) return null;
  const direct = rulesById.get(course.id);
  if (direct) return direct;
  const matches = new Set((course.aliases ?? []).flatMap(alias => {
    const rule = rulesById.get(alias);
    return rule ? [rule] : [];
  }));
  return matches.size === 1 ? [...matches][0] : null;
}

export function normalizedQuantity(course: Course | undefined, value: unknown): number {
  const rule = repeatRule(course);
  if (!rule || typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) return 1;
  return Math.min(value, rule.maxCountedOccurrences);
}

export function markedQuantity(course: Course | undefined, quantities: MarkedCourseQuantities = {}): number {
  return normalizedQuantity(course, course && Object.hasOwn(quantities, course.id) ? quantities[course.id] : undefined);
}

/** Sparse map: absent entries mean one. Ignore orphan IDs and inherited fields. */
export function normalizeMarkedQuantities(courses: ReadonlyMap<string, Course>, markedIds: Iterable<string>, value: unknown): Record<string, number> {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const result: Record<string, number> = {};
  for (const id of markedIds) {
    const quantity = normalizedQuantity(courses.get(id), Object.hasOwn(raw, id) ? raw[id] : undefined);
    if (quantity > 1) result[id] = quantity;
  }
  return result;
}
