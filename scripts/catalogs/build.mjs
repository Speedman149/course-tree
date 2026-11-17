import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { programs as existingDefinitions } from '../../data/catalogs/programs.mjs';
import { overview, crossFacultyPaths, excludedGraduateSections } from '../../data/catalogs/overview.mjs';
import { makeCoverageReport, validateCatalog } from './coverage.mjs';
import { applyExplorationCorrections } from '../../data/catalogs/exploration-corrections.mjs';

export function extractIds(text) {
  const joined = text.replace(/\b0[ \t]+(\d{6,7})\b/g, '0$1');
  const expanded = joined.replace(/\b(\d{7,8})-(\d)\b/g, (match, first, last) => {
    const start = Number(first.at(-1)); const end = Number(last);
    return end >= start ? Array.from({ length: end - start + 1 }, (_, index) => first.slice(0, -1) + (start + index)).join(' ') : match;
  });
  return [...new Set((expanded.match(/(?<!\d)\d{7,8}(?!\d)/g) ?? []).map(id => id.padStart(8, '0')))];
}
export const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const unique = ids => [...new Set(ids)].sort();
function mergeRefs(refs, sourceMap) {
  const result = new Map();
  for (const ref of refs) {
    const source = sourceMap.get(ref.sourceId);
    if (!source) throw new Error(`Unknown reference source ${ref.sourceId}`);
    const pages = unique(ref.pages).map(Number).sort((a,b)=>a-b);
    if (pages.some(page=>!Number.isInteger(page)||page<1||page>source.pageCount)) throw new Error(`Invalid page ${ref.sourceId}`);
    const enriched = {...ref, pages, ...(source.printedPageOffset !== undefined ? {printedPages: pages.map(page=>page+source.printedPageOffset)} : {})};
    result.set(`${ref.sourceId}:${pages.join(',')}:${ref.section ?? ''}`, enriched);
  }
  return [...result.values()];
}
export async function buildCatalogs() {
  const sources = JSON.parse(await readFile(resolve(root, 'data/catalogs/sources.json'), 'utf8'));
  const extracted = JSON.parse(await readFile(resolve(root, '.cache/catalogs/extracted.json'), 'utf8'));
  const courses = JSON.parse(await readFile(resolve(root, 'public/data/courses.json'), 'utf8')).courses;
  const sourceMap = new Map(sources.map(source => [source.id, source]));
  const audit = [];
  function regions(sourceId, selectors) {
    const source = sourceMap.get(sourceId);
    if (!source || extracted[sourceId]?.sha256 !== source.sha256) throw new Error(`Unreviewed/missing source ${sourceId}`);
    const ids = new Set(); const pages = new Set();
    for (const selector of selectors) {
      const match = /^(\d+[RLC])(?::(\d+))?(?::(\d+))?$/.exec(selector);
      if (!match) throw new Error(`Invalid reviewed region ${selector}`);
      const [, column, from, to] = match; const lines = extracted[sourceId].columns[column];
      if (!lines || Number(from ?? 1) > lines.length || (to && Number(to) > lines.length)) throw new Error(`Region moved: ${sourceId}/${selector}`);
      const text = lines.slice(Number(from ?? 1) - 1, to ? Number(to) : undefined).join('\n');
      const courseIds = extractIds(text); for (const id of courseIds) ids.add(id);
      pages.add(Number.parseInt(column)); audit.push({ sourceId, selector, courseIds });
    }
    return {ids: unique(ids), refs: pages.size ? [{sourceId, pages:[...pages].sort((a,b)=>a-b)}] : []};
  }
  const baselineModules = await Promise.all(['baseline-engineering','baseline-cs-math-physics','baseline-sciences-professional'].map(name=>import(`../../data/catalogs/${name}.mjs`)));
  const maintained = [...existingDefinitions, ...crossFacultyPaths, ...baselineModules.flatMap(module=>module.programs)];
  // A reviewed definition replaces an older edition with the same canonical ID; never union curricula.
  const definitions = new Map();
  for (const definition of maintained) {
    const year = sourceMap.get(definition.sourceId)?.catalogYear;
    const key = `${definition.programId}-${year}`; const previous = definitions.get(key);
    const score = item => (item.status === 'inventory-only' ? -1 : 0) + (item.mandatory?.length ?? 0) + (item.mandatoryCourseIds?.length ?? 0) + (item.groups ?? []).reduce((sum,g)=>sum+(g.regions?.length ?? 0)+(g.courseIds?.length ?? 0),0);
    if (!previous || score(definition) >= score(previous)) definitions.set(key, definition);
  }
  for (const expected of overview) {
    const key = `${expected.programId}-2025-2026`;
    if (!definitions.has(key)) definitions.set(key,{...expected,status:'inventory-only',partial:true,notes:['המסלול מופיע בטבלת התארים הרשמית; טרם הושלם ייבוא ואימות תכנית הלימודים. אין כאן רשימת קורסים או זכאות משוערת.']});
  }
  const programs = [...definitions.values()].map(applyExplorationCorrections).map(definition => {
    const source = sourceMap.get(definition.sourceId); if (!source) throw new Error(`Unknown source ${definition.sourceId}`);
    const mandatory = regions(definition.sourceId, definition.mandatory ?? []);
    const excluded = new Set(definition.mandatoryExclude ?? []);
    const groups = (definition.groups ?? []).map((group,i)=>{
      const selection = regions(group.sourceId ?? definition.sourceId, group.regions ?? []);
      return {id:group.id ?? `${definition.programId}-group-${i+1}`,name:group.name,role:group.role ?? 'elective',courseIds:unique([...selection.ids,...(group.courseIds ?? [])]).filter(id=>!(group.exclude ?? []).includes(id)),
        ...(group.creditsMin !== undefined ? {creditsMin:group.creditsMin}:{}),...(group.minimumCourses !== undefined ? {minimumCourses:group.minimumCourses}:{}),...(group.maximumCredits !== undefined ? {maximumCredits:group.maximumCredits}:{}),...(group.requiredCourseIds ? {requiredCourseIds:group.requiredCourseIds}:{}),conditions:group.conditions ?? [],rules:group.rules ?? [],
        sourceRefs:mergeRefs([...selection.refs,...(group.sourceRefs ?? [])],sourceMap),...(group.offeringFacultyId?{offeringFacultyId:group.offeringFacultyId}:{})};
    });
    const sourceRefs = mergeRefs([...(definition.sourceRefs ?? []),...mandatory.refs,...groups.flatMap(group=>group.sourceRefs)],sourceMap);
    const status = definition.status ?? (definition.partial ? 'partial' : 'verified-listed');
    if (status === 'inventory-only' && (mandatory.ids.length || definition.mandatoryCourseIds?.length || groups.some(group=>group.courseIds.length))) throw new Error(`Inventory-only program has eligibility: ${definition.programId}`);
    return {id:`${definition.programId}-${source.catalogYear}`,programId:definition.programId,facultyIds:definition.facultyIds ?? [source.facultyId],officialName:definition.officialName,degreeType:definition.degreeType ?? 'B.Sc.',
      programCategory:definition.programCategory ?? (definition.track?'concentration':'standard'),...(definition.parentProgramId?{parentProgramId:definition.parentProgramId}:{}),qualificationAwarded:definition.qualificationAwarded ?? [],durationYears:definition.durationYears,...(definition.track?{track:definition.track}:{}),catalogYear:source.catalogYear,
      mandatoryCourseIds:unique([...mandatory.ids,...(definition.mandatoryCourseIds ?? []),...groups.filter(group=>group.role==='mandatory').flatMap(group=>group.courseIds)]).filter(id=>!excluded.has(id)),electiveGroups:groups,additionalEligibleCourseIds:definition.additionalEligibleCourseIds ?? [],requirementRules:definition.requirementRules ?? [],...(definition.requiredCredits!==undefined?{requiredCredits:definition.requiredCredits}:{}),sourceRefs,
      coverage:{status,mandatoryComplete:definition.mandatoryComplete ?? false,electivesComplete:definition.electivesComplete ?? false,visuallyVerified:definition.visuallyVerified ?? false,notes:[...(definition.notes ?? []),...(status==='inventory-only'?[]:['המסנן מציג אפשרויות מתוך המקורות שיובאו; בחירה חופשית, פטורים ואישורים אישיים אינם מוסיפים את כל המאגר אוטומטית.','תנאי הקבוצות, צבירת נקודות וכפל זיכוי נשמרים בנפרד מקדמי הקורסים. אין כאן אישור לרישום או לסיום תואר.'])]}};
  });
  const courseIndex = new Map(courses.map(course=>[course.id,course])); const refs = new Map();
  for (const program of programs) for (const [ids,sourceRefs] of [[program.mandatoryCourseIds,program.sourceRefs],[program.additionalEligibleCourseIds,program.sourceRefs],...program.electiveGroups.map(group=>[group.courseIds,group.sourceRefs.length?group.sourceRefs:program.sourceRefs])]) for (const id of ids) {
    if (!/^\d{8}$/.test(id)) throw new Error(`Invalid course number ${id}`);
    if (!courseIndex.has(id) && !refs.has(id)) {
      const ref = sourceRefs[0]; if (!ref) throw new Error(`Missing course evidence: ${program.id}/${id}`);
      const exact = audit.find(region=>region.sourceId===ref.sourceId&&region.courseIds.includes(id)&&ref.pages.includes(Number.parseInt(region.selector)));
      const source=sourceMap.get(ref.sourceId); const page=exact?Number.parseInt(exact.selector):ref.pages[0];
      refs.set(id,{id,name:`קורס מהקטלוג ${id} — פרטים אינם במאגר SAP`,faculty:'שיוך פקולטה לא זמין במקור הקורסים',availableSourceTerms:[],catalogOnly:true,requirements:null,requirementsStatus:'unknown',source:{url:`${source.url}#page=${page}`,label:'קטלוג רשמי · פרטי הקורס לא נמצאו במאגר SAP'}});
    }
  }
  for (const program of programs) for (const group of program.electiveGroups) if (group.offeringFacultyId==='cs') for (const id of group.courseIds) if (refs.has(id)) refs.get(id).faculty='הפקולטה למדעי המחשב';
  const database={meta:{generatedAt:new Date().toISOString(),programCount:new Set(programs.map(program=>program.programId)).size,editionCount:programs.length,years:unique(programs.map(program=>program.catalogYear)).reverse(),defaultYear:'2025-2026',catalogFacultyCount:new Set(programs.flatMap(program=>program.facultyIds)).size,collectedDocumentCount:sources.length,importedDocumentCount:new Set(programs.flatMap(program=>program.sourceRefs.map(ref=>ref.sourceId))).size,missingCourseRecordCount:refs.size,notes:['2025–2026 הוא שנת הבסיס של המסמך שסופק. שנת 2026–2027 זמינה בנפרד בייבוא הקיים; אף שנה אינה מוצגת ככיסוי מלא מאומת.','קיימות רשומות מלאי ללא תכנית קורסים ורשומות עם רשימות חלקיות. מצב האימות מופיע בכל מסלול ובדוח הכיסוי.','שנת הקטלוג קובעת השתייכות לתואר; קדמי הקורסים נשארים לפי מאגר SAP הקיים.']},sources,programs,referencedCourses:[...refs.values()].sort((a,b)=>a.id.localeCompare(b.id))};
  validateCatalog(database);
  const coverage=await makeCoverageReport(database,{root,overview,excludedGraduateSections,extracted,extractIds,courseRecords:courses}); database.meta.coverageStats=coverage.totals;
  await mkdir(resolve(root,'docs/catalogs'),{recursive:true});
  await writeFile(resolve(root,'.cache/catalogs/import-audit.json'),JSON.stringify(audit,null,2)+'\n');
  await writeFile(resolve(root,'public/data/catalog-coverage.json'),JSON.stringify(coverage,null,2)+'\n');
  await writeFile(resolve(root,'docs/catalogs/COVERAGE.md'),coverage.markdown);
  const output=resolve(root,'public/data/catalogs.json'); await writeFile(`${output}.tmp`,JSON.stringify(database)); await rename(`${output}.tmp`,output);
  console.log(JSON.stringify(database.meta,null,2)); return database;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await buildCatalogs();