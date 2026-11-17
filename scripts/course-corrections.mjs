import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

/** Exact-course, exact-term corrections backed by pinned primary-source responses.
 * A changed upstream rule requires review instead of silently overwriting it.
 */
export function applyCourseCorrections(courses, corrections) {
  const applied = [];
  const repaired = courses.map(course => {
    const correction = corrections.find(item => item.courseId === course.id && item.term === course.source?.term);
    if (!correction) return course;
    const same = JSON.stringify(course.requirements) === JSON.stringify(correction.requirements);
    if (!same && JSON.stringify(course.requirements) !== JSON.stringify(correction.expectedInputRequirements)) {
      throw new Error(`Reverify official correction: upstream prerequisites changed for ${course.id}/${correction.term}`);
    }
    applied.push({courseId: course.id, term: correction.term, evidenceFile: correction.evidenceFile, sha256: correction.source.sha256});
    // No concurrent relationship is removed or inferred: the reviewed input is
    // exactly the all-strong AST in expectedInputRequirements.
    return {...course, requirements: structuredClone(correction.requirements), requirementsStatus: 'known', rawRequirements: correction.rawRequirements,
      source: {...course.source, label: 'Technion SAP · official same-term correction', dataUrl: correction.source.url, snapshotSha256: correction.source.sha256,
        correction: {reason: correction.reason, evidenceFile: correction.evidenceFile, retrievedAt: correction.source.retrievedAt}},
    };
  });
  return {courses: repaired, applied};
}
export async function loadCourseCorrections(root) {
  const corrections = JSON.parse(await readFile(resolve(root, 'data/course-corrections.json'), 'utf8'));
  for (const correction of corrections) {
    const bytes = await readFile(resolve(root, correction.evidenceFile));
    if (createHash('sha256').update(bytes).digest('hex') !== correction.source.sha256) throw new Error(`Changed correction evidence: ${correction.courseId}`);
    const records = JSON.parse(bytes).d.results;
    const record = records.length === 1 && records[0];
    if (!record || record.Otjid !== `SM${correction.courseId}` || !record.__metadata.uri.includes(`Peryr='${correction.term.slice(0,4)}',Perid='${correction.term.slice(5)}'`)) {
      throw new Error(`Wrong official course/term evidence: ${correction.courseId}`);
    }
  }
  return corrections;
}