/** Source rechecked in the original 2025–2026 PDF, not inferred from another degree.
 * See audits/curriculum-repairs/REPORT.md and evidence/catalog-verification.json.
 * These patches add source-listed exploration options; they do not enforce completion rules.
 */
const sourceId = '2025-2026-full';
const refs = (pages, section) => [{sourceId, pages, section}];
const listed = (id, name, courseIds, pages, extra = {}) => ({
  id, name, courseIds, sourceRefs: refs(pages, name), ...extra,
});
const focusOptions = {
  'pharmaceutical-biochemistry': ['01340113','01270100','01340020','01270741','01270742','01340134'],
  'chemical-technologies': ['00940481','00540135'],
  'molecular-quantum-technologies': ['01270446','01270447','01260604','01260605','01270450','01270451','01280429','01160037','01160040','01180137'],
};
const englishPages = {
  'architecture-sciences': 218, 'landscape-architecture': 220,
  'biomedical-engineering': 304, 'biomedical-physics': 305,
  'medicine-biomedical-engineering': 306,
};
export function applyExplorationCorrections(definition) {
  // Never carry a 2025 membership correction into the separate 2026 import.
  if (definition.sourceId !== sourceId) return definition;
  const result = structuredClone(definition);
  const addMandatory = (ids, pages, section) => {
    result.mandatoryCourseIds = [...new Set([...(result.mandatoryCourseIds ?? []), ...ids])];
    result.sourceRefs = [...(result.sourceRefs ?? []), ...refs(pages, section)];
  };
  const addGroup = group => { result.groups = [...(result.groups ?? []), group]; };
  if (result.programId === 'computer-engineering') {
    addMandatory(['00440102'], [124], 'סמסטר 1 — בטיחות במעבדות חשמל');
  }
  if (result.programId === 'medicine-biomedical-engineering') {
    addMandatory(['02740369','02740376'], [306], 'סמסטר 10 — פרמקולוגיה ופתולוגיה');
    addGroup(listed('medicine-biomedical-extra-electives', 'תוספות בחירה בתואר הכפול', ['03350002','03360022'], [307], {
      role: 'elective', conditions: ['מוכרים כבחירה פקולטית במסלול התואר הכפול לפי ההערה בראש עמוד 307.'],
    }));
  }
  if (result.programId === 'biomedical-physics') {
    addGroup(listed('biomedical-physics-flow-alternative', 'זרימה — חלופה מותרת', ['03340009','01160027'], [305], {
      role: 'mandatory-choice', conditions: ['במקום מכניקת זורמים ביולוגיים 03340009 ניתן לקחת תורת הרצף 01160027. שתי האפשרויות מוצגות; אין דרישה להשלמת שתיהן.'],
    }));
  }
  if (englishPages[result.programId]) {
    addGroup(listed('source-listed-english', 'אנגלית מתקדמים ב׳', ['03240033'], [195, englishPages[result.programId]], {
      role: 'mandatory-choice', conditions: ['לפי חובת האנגלית, סיווג ופטור. הקורס מוצג כאפשרות בתכנית, ולא כחובה בלתי מותנית לכל סטודנט.'],
    }));
  }
  if (result.programId === 'chemistry-haznek' || result.programId.startsWith('chemistry-haznek-')) {
    // Only the independently checked rows are added. Other semesters, placeholders,
    // and the allocation of shared BSc/MSc credits remain unresolved.
    result.status = 'partial'; result.partial = true;
    result.mandatoryComplete = false; result.electivesComplete = false;
    addMandatory(['01040018','01040019','01340058','01240117'], [196], 'הזנק — מקצועות חובה משותפים מסמסטר 1');
    const focus = focusOptions[result.programId.slice('chemistry-haznek-'.length)];
    if (focus) addGroup(listed(`${result.programId}-verified-focus`, 'אפשרויות מיקוד מאומתות בתכנית הזנק המשולבת', focus, [197], {
      role: 'specialization', conditions: ['אפשרויות מפורשות במסלול המשולב לתואר ראשון ושני, לרבות חלופות מעבדה ובחירה. שיוך נקודות לכל תואר נקבע עם החונך; אין סימון כל האפשרויות כחובה ואין אישור זכאות לתואר.'],
    }));
    result.notes = [...(result.notes ?? []), 'תיקון ממוקד: נכללו ארבעה מקצועות חובה משותפים מעמוד 196, ובמיקודים רק אפשרויות שנבדקו בעמוד 197. יתר התכנית, מקצועות מציין־מקום וחלוקת הנקודות בין התארים אינם מאומתים.'];
  }
  return result;
}