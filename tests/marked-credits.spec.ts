import {openCollection, toolsTrigger} from './helpers/mobile-tools';
import {expect, test as base, type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {CourseDataset} from '../src/types';
import {PROGRESS_KEY, PROGRESS_VERSION} from '../src/lib/progress';

const A = '00140855', B = '00140856', C = '00140889'; // 3 + 3 + 3.5 credits
const test = base.extend<{runtimeErrors: void}>({runtimeErrors: [async ({page}, use) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await use(); expect(errors).toEqual([]);
}, {auto: true}]});
const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').progress, PROGRESS_KEY);
async function menu(page: Page) {return openCollection(page, 'marked');}
async function mark(page: Page, id: string) {
  const button = node(page, id).locator('.mark-button'); await button.focus(); await button.press('Enter');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

for (const width of [1440, 320]) test(`marked credits update, include hidden courses and persist at ${width}px`, async ({page}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({width, height: width === 320 ? 568 : 1000});
  await page.goto('/?course=' + A); await expect(node(page, A).locator('.course-link')).toHaveText(A);
  let panel = await menu(page);
  await expect(panel.getByRole('status')).toHaveText('סה״כ נק״ז: 0'); // added primary is unmarked
  await page.keyboard.press('Escape');
  for (const [id, total] of [[A, '3'], [B, '6'], [C, '9.5']]) {
    await mark(page, id); panel = await menu(page);
    await expect(panel.getByRole('status')).toHaveText('סה״כ נק״ז: ' + total);
    await page.keyboard.press('Escape');
  }
  const collapse = node(page, A).locator('.expand-button'); await collapse.focus(); await collapse.press('Enter');
  await expect(node(page, B)).toHaveCount(0); await expect(node(page, C)).toHaveCount(0);
  await page.getByRole('button', {name: 'פתיחת מסנני המפה'}).click();
  await page.getByRole('tab', {name: /סינון לפי פקולטה/}).click();
  await page.getByRole('button', {name: 'ניקוי הכול', exact: true}).click();
  await page.getByRole('checkbox', {name: 'מדעי המחשב', exact: true}).check();
  await page.getByRole('button', {name: 'הצגת המפה', exact: true}).click();
  panel = await menu(page);
  await expect(panel.getByRole('status')).toHaveText('סה״כ נק״ז: 9.5');
  await expect(panel).toHaveCSS('direction', 'rtl'); await expect(panel).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect.poll(async () => (await saved(page))?.markedCourseIds).toEqual([A, B, C]);
  await page.reload(); await expect(node(page, A)).toHaveCount(1); panel = await menu(page);
  await expect(panel.getByRole('status')).toHaveText('סה״כ נק״ז: 9.5');
  await panel.getByRole('button', {name: 'הסרת סימון של ' + B, exact: true}).click();
  await expect(panel.getByRole('status')).toHaveText('סה״כ נק״ז: 6.5');
  await page.keyboard.press('Escape'); if (await toolsTrigger(page).isVisible()) await openCollection(page, 'marked'); page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', {name: 'ניקוי סימונים', exact: true}).click();
  panel = await menu(page); await expect(panel.getByRole('status')).toHaveText('סה״כ נק״ז: 0');
  await expect.poll(async () => (await saved(page))?.markedCourseIds).toEqual([]);
  await page.reload(); panel = await menu(page); await expect(panel.getByRole('status')).toHaveText('סה״כ נק״ז: 0');
});

test('missing credits are explicitly incomplete and update as unknown courses are unmarked', async ({page}) => {
  await page.setViewportSize({width: 320, height: 568});
  const dataset = JSON.parse(readFileSync(new URL('../public/data/courses.json', import.meta.url), 'utf8')) as CourseDataset;
  for (const course of dataset.courses) if ([B, C].includes(course.id)) delete course.credits;
  await page.route('**/data/courses.json', route => route.fulfill({json: dataset}));
  await page.addInitScript(({key, version, A, B, C}) => {
    if (sessionStorage.getItem('missing-credit-seed')) return;
    localStorage.setItem(key, JSON.stringify({version, progress: {addedCourseIds: [A], markedCourseIds: [A, B, C], facultyIds: ['cs'], expandedForward: []}}));
    sessionStorage.setItem('missing-credit-seed', 'yes');
  }, {key: PROGRESS_KEY, version: PROGRESS_VERSION, A, B, C});
  await page.goto('/?course=' + A); await expect(node(page, A)).toHaveCount(1);
  let panel = await menu(page);
  await expect(panel.getByRole('status')).toContainText('נק״ז ידוע: 3');
  await expect(panel.getByRole('status')).toContainText('ל־2 מקצועות חסר נתון נק״ז');
  await expect(panel).toBeInViewport();
  await page.reload(); panel = await menu(page);
  await expect(panel.getByRole('status')).toContainText('ל־2 מקצועות חסר נתון נק״ז');
  for (const [id, missing] of [[B, '1'], [C, '0']]) {
    await panel.getByRole('button', {name: 'הסרת סימון של ' + id, exact: true}).click();
    if (missing === '0') await expect(panel.getByRole('status')).toHaveText('סה״כ נק״ז: 3');
    else await expect(panel.getByRole('status')).toContainText('ל־1 מקצועות חסר נתון נק״ז');
  }
});
