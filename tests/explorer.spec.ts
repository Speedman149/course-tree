import { readFileSync } from 'node:fs';
import { expect, test as base, type Locator, type Page } from '@playwright/test';
import type { CourseDataset } from '../src/types';

const dataset = JSON.parse(readFileSync(new URL('../public/data/courses.json', import.meta.url), 'utf8')) as CourseDataset;
const courses = new Map(dataset.courses.map(course => [course.id, course]));

// Runtime failures should fail every flow, including the responsive flow.
const test = base.extend<{ runtimeErrors: void }>({
  runtimeErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await use();
    expect(errors, 'browser runtime errors').toEqual([]);
  }, { auto: true }],
});

function instance(page: Page, id: string): Locator {
  return page.locator(`.react-flow__node[data-id="${id}"]`);
}
async function ready(page: Page, course = '02340114') {
  await page.goto(course === '02340114' ? '/' : `/?course=${course}`);
  await expect(instance(page, 'root').locator('.node-name')).toHaveText(courses.get(course)!.name);
  await expect(page.getByRole('combobox')).toBeEnabled();
}
async function fit(page: Page) {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'התאמת המפה למסך', exact: true }).click();
}
async function selectCourse(page: Page, query: string, id: string) {
  const search = page.getByRole('combobox', { name: 'חיפוש קורס לפי מספר או שם' });
  await search.fill(query);
  const result = page.getByRole('option').filter({ hasText: id });
  await expect(result).toHaveCount(1);
  await result.click();
  await expect(instance(page, 'root').locator('.node-name')).toHaveText(courses.get(id)!.name);
  await expect(page).toHaveURL(new RegExp(`[?&]course=${id}`));
}

// Assert links locally: external Technion availability does not gate graph QA.
test('default introduction root and course-specific information links', async ({ page }) => {
  await ready(page);
  const link = instance(page, 'root').locator('.course-link');
  await expect(link).toHaveText('02340114');
  await expect(link).toHaveAttribute('href', courses.get('02340114')!.source.url);
  await expect(link).toHaveAttribute('href', /portalex\.technion\.ac\.il\/ovv\/.*#\/details\/\d+\/\d+\/SM\/02340114$/);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(page.locator('.map-legend')).toContainText('קדם חזק');
  await expect(page.locator('.map-legend')).toContainText('מקצוע צמוד');
  await expect(instance(page, 'root').locator('.expand-button')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.react-flow__node')).not.toHaveCount(1);
});

test('legacy and partial Hebrew searches select roots across faculties and clear exploration', async ({ page }) => {
  await ready(page);
  const search = page.getByRole('combobox');
  await search.fill('234114');
  await expect(page.getByRole('option').first()).toContainText('02340114');
  await search.press('Enter');
  await expect(instance(page, 'root').locator('.course-link')).toHaveText('02340114');

  // Select a mathematics course via a partial Hebrew name, then return by old ID.
  await selectCourse(page, 'אלגברה 1מ3', '01040067');
  await expect(instance(page, 'root').locator('.node-meta')).toContainText('מתמטיקה');
  await instance(page, 'root').locator('.expand-button').click();
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await selectCourse(page, '234114', '02340114');
  await expect(instance(page, 'root').locator('.expand-button')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.react-flow__node[data-id^="root/b:"]')).toHaveCount(0);

  await search.fill('קורסשאינובמאגר');
  await expect(page.getByText('לא נמצאו קורסים', { exact: true })).toBeVisible();
  await search.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
});

test('forward diamond branches expand and collapse independently', async ({ page }) => {
  // This source course has two paths to the same later courses.
  await ready(page, '00140855');
  await fit(page);
  const firstId = 'root/f:00140856:strong';
  const secondId = 'root/f:00140889:strong';
  const first = instance(page, firstId);
  const second = instance(page, secondId);
  await first.locator('.expand-button').click();
  await expect(instance(page, `${firstId}/f:00140866:strong`)).toHaveCount(1);
  await fit(page);
  await second.locator('.expand-button').click();
  await expect(instance(page, `${secondId}/f:00140866:strong`)).toHaveCount(1);
  await fit(page);
  await first.locator('.expand-button').click();
  await expect(instance(page, `${firstId}/f:00140866:strong`)).toHaveCount(0);
  await expect(instance(page, `${secondId}/f:00140866:strong`)).toHaveCount(1);
  await expect(second.locator('.expand-button')).toHaveAttribute('aria-expanded', 'true');
});

test('hover panel stays interactive and recursively explores backward requirements', async ({ page }) => {
  await ready(page, '02340247');
  const root = instance(page, 'root');
  await root.locator('.node-name').hover();
  let panel = page.getByRole('dialog', { name: `קדמים של ${courses.get('02340247')!.name}`, exact: true });
  await expect(panel).toBeVisible();
  await panel.hover();
  await expect(panel.locator('.requirement-logic')).toContainText('וגם');
  await expect(panel.locator('.requirement-logic a')).toHaveCount(2);
  const dataCourse = courses.get('02340218')!;
  await panel.getByRole('button', { name: `הרחבת קדם ${dataCourse.name}`, exact: true }).click();
  const backwardId = 'root/b:02340218:strong';
  await expect(instance(page, backwardId)).toHaveCount(1);
  await expect(instance(page, backwardId).locator('.course-node')).toHaveClass(/backward-node/);
  await fit(page);
  await instance(page, backwardId).locator('.node-info').click();
  panel = page.getByRole('dialog', { name: `קדמים של ${dataCourse.name}`, exact: true });
  await expect(panel.locator('.requirement-logic')).toContainText('או');
  await expect(panel.locator('.requirement-logic')).toContainText('וגם');
  const systemCourse = courses.get('02340124')!;
  await panel.getByRole('button', { name: `הרחבת קדם ${systemCourse.name}`, exact: true }).click();
  const secondBackwardId = `${backwardId}/b:02340124:strong`;
  await expect(instance(page, secondBackwardId)).toHaveCount(1);
  await fit(page);
  await instance(page, secondBackwardId).locator('.node-info').click();
  panel = page.getByRole('dialog', { name: `קדמים של ${systemCourse.name}`, exact: true });
  await expect(panel).toContainText('02340114');
  await panel.getByRole('button', { name: `הרחבת קדם ${courses.get('02340114')!.name}`, exact: true }).click();
  const thirdBackwardId = `${secondBackwardId}/b:02340114:strong`;
  await expect(instance(page, thirdBackwardId)).toHaveCount(1);
  await fit(page);
  await instance(page, thirdBackwardId).getByRole('button', { name: `כיווץ ענף קדם ${courses.get('02340114')!.name}`, exact: true }).click();
  await expect(instance(page, thirdBackwardId)).toHaveCount(0);
  await expect(instance(page, secondBackwardId)).toHaveCount(1);
  await fit(page);
  await root.locator('.node-info').click();
  panel = page.getByRole('dialog', { name: `קדמים של ${courses.get('02340247')!.name}`, exact: true });
  await panel.getByRole('button', { name: `כיווץ קדם ${dataCourse.name}`, exact: true }).click();
  await expect(instance(page, backwardId)).toHaveCount(0);
  await expect(instance(page, secondBackwardId)).toHaveCount(0);
});

test('concurrent relationships have gray cards and retain combined requirement logic', async ({ page }) => {
  await ready(page, '01040067');
  const child = instance(page, 'root/f:01040022:concurrent');
  await expect(child.locator('.course-node')).toHaveClass(/concurrent/);
  await fit(page);
  await child.locator('.node-info').click();
  const panel = page.getByRole('dialog', { name: `קדמים של ${courses.get('01040022')!.name}`, exact: true });
  await expect(panel.locator('.requirement-logic')).toContainText('או');
  await expect(panel.locator('.requirement-logic')).toContainText('וגם');
  await expect(panel.locator('.relation-label.concurrent')).toContainText('מקצוע צמוד');
  await expect(panel.locator('.relation-label.strong').first()).toContainText('קדם חזק');
});

test('zoom, pan and fit controls change the graph viewport', async ({ page }) => {
  await ready(page, '00140855');
  const percent = page.locator('.canvas-controls > span');
  const before = parseInt((await percent.textContent())!, 10);
  await page.getByRole('button', { name: 'הגדלת המפה', exact: true }).click();
  await expect.poll(async () => parseInt((await percent.textContent())!, 10)).toBeGreaterThan(before);
  const enlarged = parseInt((await percent.textContent())!, 10);
  await page.getByRole('button', { name: 'הקטנת המפה', exact: true }).click();
  await expect.poll(async () => parseInt((await percent.textContent())!, 10)).toBeLessThan(enlarged);
  const viewport = page.locator('.react-flow__viewport');
  const initialTransform = await viewport.getAttribute('style');
  const canvas = await page.locator('.graph-canvas').boundingBox();
  if (!canvas) throw new Error('Graph canvas is missing');
  await page.mouse.move(canvas.x + 50, canvas.y + 65);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 150, canvas.y + 125, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => viewport.getAttribute('style')).not.toBe(initialTransform);
  await fit(page);
  for (const card of await page.locator('.react-flow__node').all()) await expect(card).toBeInViewport();
});

test('mobile layout fits the screen and supports root search and prerequisite controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole('combobox')).toBeInViewport();
  await selectCourse(page, 'אלגוריתמים 1', '02340247');
  await fit(page);
  const root = instance(page, 'root');
  await expect(root).toBeInViewport();
  // The information button is available on touch devices without relying on hover.
  await root.locator('.node-info').click();
  const panel = page.getByRole('dialog', { name: `קדמים של ${courses.get('02340247')!.name}`, exact: true });
  await expect(panel).toBeInViewport();
  const bounds = await panel.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await panel.getByRole('button', { name: `הרחבת קדם ${courses.get('02340218')!.name}`, exact: true }).click();
  await expect(instance(page, 'root/b:02340218:strong')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
