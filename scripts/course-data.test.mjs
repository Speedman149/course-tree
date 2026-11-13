import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRequirement, extractRequirements, normalizeCourseId, courseAliases, courseInfoUrl, mergeSnapshots } from './course-data.mjs';

test('preserves alternatives containing combined requirements', () => {
  assert.deepEqual(parseRequirement('(02340218 ו-02340141) או (01040016 ו-01040195)'), {
    type: 'or', items: [
      { type: 'and', items: [{ type: 'course', courseId: '02340218', relation: 'strong' }, { type: 'course', courseId: '02340141', relation: 'strong' }] },
      { type: 'and', items: [{ type: 'course', courseId: '01040016', relation: 'strong' }, { type: 'course', courseId: '01040195', relation: 'strong' }] },
    ],
  });
});

test('retains concurrent type and combines separate strong/concurrent fields', () => {
  const data = extractRequirements({ 'מקצועות קדם': '01040018 או 01040012', 'מקצועות צמודים': '01040067' });
  assert.equal(data.requirementsStatus, 'known');
  assert.equal(data.requirements.type, 'and');
  assert.equal(data.requirements.items[0].type, 'or');
  assert.equal(data.requirements.items[1].relation, 'concurrent');
});

test('recovers concurrent OR from original source note instead of flattening to AND', () => {
  const data = extractRequirements({ 'מקצועות צמודים': '00860733 00440202', 'הערות': 'מקצוע צמוד: 0860733 תהליכים אקראיים או 0440202 אותות אקראיים\nהערה נוספת' });
  assert.equal(data.requirementsStatus, 'known');
  assert.equal(data.requirements.type, 'or');
  assert.deepEqual(data.requirements.items.map(item => item.courseId), ['00860733', '00440202']);
});

test('does not invent operators or repair ambiguous source rules', () => {
  for (const text of ['02340218 02340141', '02340218 או 02340141 ו-01040016', '(02340218', '02340218)', '02340218,02340141', '02340218 או']) {
    assert.throws(() => parseRequirement(text));
    const parsed = extractRequirements({ 'מקצועות קדם': text });
    assert.equal(parsed.requirementsStatus, 'unparsed');
    assert.equal(parsed.requirements, null);
    assert.ok(parsed.rawRequirements.includes(text));
  }
  assert.equal(extractRequirements({ 'מקצועות צמודים': '01040016 01040019', 'הערות': 'מקצועות צמודים: 1040016, 1040019' }).requirementsStatus, 'unparsed');
  assert.equal(extractRequirements({ 'מקצועות צמודים': 'הסכמת מרצה' }).requirementsStatus, 'unparsed');
});

test('source number mapping preserves zeros and supports confirmed legacy aliases', () => {
  assert.equal(normalizeCourseId('234114'), '02340114');
  assert.equal(normalizeCourseId('044252'), '00440252');
  assert.equal(normalizeCourseId('2340114'), '02340114');
  assert.ok(courseAliases('02340114').includes('234114'));
  assert.ok(courseAliases('00440252').includes('044252'));
  assert.equal(normalizeCourseId('973012'), '97030012');
});

test('latest course record wins atomically rather than combining obsolete rules', () => {
  const snapshot = (term, requirement) => ({ term, url: `https://example.test/${term}`, sha256: 'test', records: [{ general: { 'מספר מקצוע': '02340247', 'שם מקצוע': 'אלגוריתמים 1', 'פקולטה': 'מדעי המחשב', 'נקודות': '3', 'מקצועות קדם': requirement } }] });
  const courses = mergeSnapshots([snapshot('2026_200', '02340218 ו-02340141'), snapshot('2024_201', '01040016')]);
  assert.equal(courses.length, 1);
  assert.equal(courses[0].source.term, '2026_200');
  assert.deepEqual(courses[0].requirements.items.map(item => item.courseId), ['02340218', '02340141']);
  assert.equal(courses[0].requirementsChanged, true);
  assert.deepEqual(courses[0].previousRequirements[0].raw[0], '01040016');
});

test('empty source requirement fields mean no recorded requirements', () => {
  assert.deepEqual(extractRequirements({}), { requirements: null, requirementsStatus: 'none' });
});

test('course links use the exact SAP course and selected source session', () => {
  const prefix = 'https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/';
  assert.equal(courseInfoUrl('02340114', '2026_200'), `${prefix}2026/200/SM/02340114`);
  assert.equal(courseInfoUrl('00440252', '2025_201'), `${prefix}2025/201/SM/00440252`);
  assert.equal(courseInfoUrl('00940139', '2025_202'), `${prefix}2025/202/SM/00940139`);
  assert.throws(() => courseInfoUrl('234114', '2026_200'));
  const courses = mergeSnapshots([{ term: '2026_200', url: 'https://example.test/snapshot', sha256: 'test', records: [{ general: { 'מספר מקצוע': '02340114', 'שם מקצוע': 'מבוא למדעי המחשב' } }] }]);
  assert.equal(courses[0].source.url, `${prefix}2026/200/SM/02340114`);
});
