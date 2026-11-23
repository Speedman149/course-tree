import {openCollection, toolsTrigger} from './helpers/mobile-tools';
import {expect, test as base, type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {PROGRESS_KEY} from '../src/lib/progress';

const sap = JSON.parse(readFileSync(new URL('../public/data/courses.json', import.meta.url), 'utf8'));
const catalog = JSON.parse(readFileSync(new URL('../public/data/catalogs.json', import.meta.url), 'utf8'));
const courses = new Map([...sap.courses, ...catalog.referencedCourses].map(course => [course.id, course]));
const footerBefore = JSON.parse(readFileSync(new URL('./fixtures/footer-before.json', import.meta.url), 'utf8'));
const test = base.extend<{runtimeErrors: void}>({
  runtimeErrors: [async ({page}, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await use();
    expect(errors).toEqual([]);
  }, {auto: true}],
});
const A = '00140855', B = '00140856', C = '00140889', D = '00140866';
const connection = (source: string, target: string, relation = 'strong') => `${source}->${target}:${relation}`;
const AB = connection(A, B), AC = connection(A, C), BD = connection(B, D), CD = connection(C, D);
const node = (page: Page, id = 'root') => id === 'root'
  ? page.locator('.react-flow__node:has(.root-node)')
  : page.locator(`.react-flow__node[data-id="${id}"]`);
const edgeControl = (page: Page, id: string) => page.locator(`[data-connection="${id}"]`);
const saved = (page: Page) => page.evaluate(key => {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw).progress : null;
}, PROGRESS_KEY);

async function ready(page: Page, root = A) {
  await page.goto(`/?course=${root}`);
  await expect(node(page).locator('.course-link')).toHaveText(root);
}
async function toggle(page: Page, id: string) {
  const button = node(page, id).locator('.expand-button');
  await button.focus();
  await button.press('Enter');
}
async function diamond(page: Page) {
  await ready(page);
  for (const id of [B, C]) {
    await toggle(page, id);
    await expect(node(page, id).locator('.expand-button')).toHaveAttribute('aria-expanded', 'true');
  }
  await expect(node(page, D)).toHaveCount(1);
  await expect(edgeControl(page, BD)).toHaveCount(1);
  await expect(edgeControl(page, CD)).toHaveCount(1);
}
async function settled(page: Page) {
  await expect.poll(async () => page.locator('.react-flow__viewport').evaluate((element, key) => {
    const view = JSON.parse(localStorage.getItem(key) ?? '{}').progress?.viewport;
    if (!view) return 100;
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return Math.max(Math.abs(matrix.a - view.zoom), Math.abs(matrix.e - view.x), Math.abs(matrix.f - view.y));
  }, PROGRESS_KEY)).toBeLessThan(.1);
}
async function fit(page: Page) {
  await page.keyboard.press('Escape');
  await page.getByRole('button', {name: 'התאמת המפה למסך', exact: true}).click();
  await settled(page);
}
async function hide(page: Page, id: string) {
  await edgeControl(page, id).focus();
  await edgeControl(page, id).press('Enter');
  await expect(edgeControl(page, id)).toHaveCount(0);
}
async function restore(page: Page, parent: string, id: string) {
  const details = node(page, parent).locator('.branch-restores');
  if (await details.getAttribute('open') === null) {
    await details.locator('summary').focus();
    await details.locator('summary').press('Enter');
  }
  const button = details.locator(`[data-restore-connection="${id}"]`);
  await expect(button).toBeVisible();
  await button.focus();
  await button.press('Enter');
  await expect(edgeControl(page, id)).toHaveCount(1);
}
async function mark(page: Page, id: string) {
  const button = node(page, id).locator('.mark-button');
  await button.focus();
  await button.press('Enter');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

test('edge minus hides only B, restores it, and preserves the shared child through C', async ({page}) => {
  await diamond(page);
  await fit(page);
  const before = await node(page).boundingBox();
  const zoom = await page.locator('.canvas-controls>span').textContent();
  await edgeControl(page, AB).click();
  await expect(node(page, B)).toHaveCount(0);
  await expect(node(page, D)).toHaveCount(1);
  await expect(node(page, C).locator('.expand-button')).toHaveAttribute('aria-expanded', 'true');
  await expect(node(page).locator('.expand-button')).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(async () => {
    const box = await node(page).boundingBox();
    return Math.max(Math.abs(box!.x - before!.x), Math.abs(box!.y - before!.y));
  }).toBeLessThan(2);
  await expect(page.locator('.canvas-controls>span')).toHaveText(zoom!);
  for (let i = 0; i < 3; i++) {
    await restore(page, A, AB);
    await expect(node(page, B).locator('.expand-button')).toHaveAttribute('aria-expanded', 'true');
    await expect(node(page, D)).toHaveCount(1);
    await hide(page, AB);
    await expect(node(page, D)).toHaveCount(1);
  }
  await toggle(page, A);
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await toggle(page, A);
  await expect(node(page, B)).toHaveCount(1);
  await expect(node(page, D)).toHaveCount(1);
});

test('one shared course and its red marking survive until both incoming branches are hidden', async ({page}) => {
  await diamond(page);
  await mark(page, D);
  await hide(page, BD);
  await expect(node(page, D)).toHaveCount(1);
  await expect(node(page, D).locator('.course-node')).toHaveClass(/user-marked/);
  await expect(node(page, C).locator('.expand-button')).toHaveAttribute('aria-expanded', 'true');
  await hide(page, CD);
  await expect(node(page, D)).toHaveCount(0);
  await restore(page, B, BD);
  await expect(node(page, D).locator('.course-node')).toHaveClass(/user-marked/);
  await expect(node(page, D)).toHaveCount(1);
  await expect(edgeControl(page, CD)).toHaveCount(0);
  await expect.poll(async () => (await saved(page))?.markedCourseIds).toContain(D);
});

test('hidden connections, expanded siblings, degree/faculty filters and markings survive refresh together', async ({page}) => {
  await diamond(page);
  await page.getByRole('button', {name: 'פתיחת מסנני המפה'}).click();
  await page.getByRole('tab', {name: /קטלוג תואר/}).click();
  const program = catalog.programs.find(program => program.id === 'mapping-3-mapping-2025-2026');
  await page.getByRole('textbox', {name: 'חיפוש תואר'}).fill(program.officialName);
  await page.locator('.catalog-option').click();
  await page.getByRole('tab', {name: /סינון לפי פקולטה/}).click();
  await page.getByRole('button', {name: 'ניקוי הכול', exact: true}).click();
  await page.getByRole('checkbox', {name: 'הנדסה אזרחית וסביבתית', exact: true}).check();
  await page.getByRole('button', {name: 'הצגת המפה', exact: true}).click();
  await mark(page, D);
  const color = await node(page, D).locator('.course-node').evaluate(element => (element as HTMLElement).style.getPropertyValue('--faculty-accent'));
  await hide(page, AB);
  await expect.poll(async () => (await saved(page))?.hiddenForwardConnections).toContain(AB);
  await settled(page);
  await page.reload();
  await expect(node(page).locator('.course-link')).toHaveText(A);
  await expect(node(page, B)).toHaveCount(0);
  await expect(node(page, C).locator('.expand-button')).toHaveAttribute('aria-expanded', 'true');
  await expect(node(page, D).locator('.course-node')).toHaveClass(/user-marked/);
  await expect(page.locator('.active-filter-summary')).toContainText(program.officialName);
  expect((await saved(page)).facultyIds).toEqual(['civil']);
  expect(await node(page, D).locator('.course-node').evaluate(element => (element as HTMLElement).style.getPropertyValue('--faculty-accent'))).toBe(color);
  await restore(page, A, AB);
  await expect(node(page, D)).toHaveCount(1);
});

test('course-level reopen restores direct hidden children while keeping a deeper shared edge hidden', async ({page}) => {
  await diamond(page);
  await hide(page, BD);
  await hide(page, AC);
  await toggle(page, A);
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await toggle(page, A);
  await expect(node(page, C)).toHaveCount(1);
  await expect(node(page, D)).toHaveCount(1);
  await expect(edgeControl(page, BD)).toHaveCount(0);
  await expect(edgeControl(page, CD)).toHaveCount(1);
  await restore(page, B, BD);
  await expect(node(page, D)).toHaveCount(1);
});

test('branch reset and sole-root changes clear hidden connections while preserving markings', async ({page}) => {
  await diamond(page);
  await mark(page, D);
  await hide(page, AB);
  await page.getByRole('button', {name: 'איפוס ענפים', exact: true}).click();
  await expect(node(page, B)).toHaveCount(1);
  await expect.poll(async () => (await saved(page))?.hiddenForwardConnections).toEqual([]);
  await expect.poll(async () => (await saved(page))?.markedCourseIds).toContain(D);
  await hide(page, AB);
  const search = page.getByRole('combobox');
  await search.fill(D);
  await page.getByRole('option').filter({hasText: D}).click();
  await expect(node(page).locator('.mark-button')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await saved(page))?.hiddenForwardConnections).toEqual([]);
  await search.fill(A);
  await page.getByRole('option').filter({hasText: A}).click();
  await expect(node(page, B)).toHaveCount(1);
});

test('legacy and outdated connection identifiers migrate without losing valid progress', async ({page}) => {
  await page.addInitScript(({key, A}) => {
    if (!sessionStorage.getItem('branch-seeded')) {
      localStorage.setItem(key, JSON.stringify({version: 2, progress: {
        rootId: A, expandedForward: ['root', 'root/f:00140856:strong', 'root/f:00140889:strong'],
        expandedBackward: [], hiddenForwardConnections: ['root/f:00140856:strong', 'obsolete', 'root', 'root/b:00140856:strong', 'root/f:99999999:strong'],
        markedCourseIds: ['00140866'], facultyIds: null,
      }}));
      sessionStorage.setItem('branch-seeded', 'yes');
    }
  }, {key: PROGRESS_KEY, A});
  await ready(page);
  await expect(node(page, B)).toHaveCount(0);
  await expect(node(page, D).locator('.mark-button')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: 'הגדלת המפה', exact: true}).click();
  await expect.poll(async () => (await saved(page))?.hiddenForwardConnections).toEqual([AB]);
});

test('ordinary strong badge stays absent while green backward controls and concurrent badges remain', async ({page}) => {
  await ready(page, '02340247');
  await node(page).locator('.node-info').focus();
  await node(page).locator('.node-info').press('Enter');
  await page.getByRole('dialog', {name: `קדמים של ${courses.get('02340247').name}`, exact: true}).getByRole('button', {name: `הרחבת קדם ${courses.get('02340218').name}`, exact: true}).click();
  const backward = node(page, '02340218');
  await expect(backward.locator('.backward-badge')).toContainText('קדם');
  await expect(page.locator('.course-node .relationship-chip.strong')).toHaveCount(0);
  await expect(edgeControl(page, connection('02340218', '02340247'))).toHaveCount(0);
  const green = await backward.locator('.backward-badge').evaluate(element => getComputedStyle(element).color.match(/\d+/g)!.map(Number));
  expect(green[1]).toBeGreaterThan(green[0]);
  await backward.locator('.backward-badge').focus();
  await backward.locator('.backward-badge').press('Enter');
  await expect(backward).toHaveCount(0);
  await ready(page, '01040067');
  await expect(node(page, '01040022').locator('.relationship-chip.concurrent')).toHaveText('מקצוע צמוד');
});

for (const baseline of footerBefore) test(`footer stays compact with original content and the marked-list control at ${baseline.viewport.width}px`, async ({page}) => {
  await page.setViewportSize(baseline.viewport);
  await ready(page, '02340114');
  const height = await page.locator('.site-footer').evaluate(element => element.getBoundingClientRect().height);
  expect(height).toBeLessThan(baseline.height - 8);
  await expect(page.locator('.site-disclaimer')).toHaveText('Course Tree is an independent student project and is not affiliated with or endorsed by the Technion. Always verify degree requirements using official sources.');
  if (await toolsTrigger(page).isVisible()) await openCollection(page, 'marked');
  await expect(page.getByRole('button', {name: 'ניקוי סימונים', exact: true})).toBeVisible();
  if (await toolsTrigger(page).isVisible()) await expect(page.locator('[data-tools-section="marked"]>summary')).toBeVisible();
  else await expect(page.getByRole('button', {name: 'רשימת מסומנים', exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: 'איפוס התקדמות שמורה', exact: true})).toBeVisible();
  if (await toolsTrigger(page).isVisible()) await page.keyboard.press('Escape');
  await expect(page.getByRole('link', {name: 'אודות / About', exact: true})).toBeVisible();
  await expect(page.getByText('Developed by Chupchick', {exact: true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('About keeps its content and upper navigation with the large button absent', async ({page}) => {
  await ready(page);
  await page.getByRole('link', {name: 'אודות / About', exact: true}).click();
  await expect(page.getByText('idk seems kinda cool ill put something here later', {exact: true})).toBeVisible();
  await expect(page.locator('.about-content .modal-primary')).toHaveCount(0);
  await page.reload();
  await page.getByRole('link', {name: 'חזרה למפת הקורסים ←', exact: true}).click();
  await expect(node(page).locator('.course-link')).toHaveText(A);
});

test('all hidden direct branches reopen individually without duplicating their shared child', async ({page}) => {
  await diamond(page);
  const direct = await page.locator('.edge-branch-toggle').evaluateAll((buttons, root) => buttons.map(button => button.getAttribute('data-connection')!).filter(id => id.startsWith(root + '->')), A);
  for (const id of direct) await hide(page, id);
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await expect(node(page).locator('.expand-button')).toHaveAttribute('aria-expanded', 'false');
  await expect(node(page).locator('.course-node')).toHaveAttribute('data-expansion', 'collapsed');
  await expect(page.locator('.single-node-hint')).toContainText('הצגת ענפים');
  await restore(page, A, AB);
  await expect(node(page, D)).toHaveCount(1);
  await expect(node(page, C)).toHaveCount(0);
  await restore(page, A, AC);
  await expect(node(page, D)).toHaveCount(1);
  await expect(edgeControl(page, BD)).toHaveCount(1);
  await expect(edgeControl(page, CD)).toHaveCount(1);
});

test('connection visibility synchronizes across tabs without resetting shared descendants', async ({page, context}) => {
  await diamond(page);
  await expect.poll(async () => (await saved(page))?.expandedForward).toContain(C);
  const second = await context.newPage();
  await second.goto(`/?course=${A}`);
  await expect(node(second, D)).toHaveCount(1);
  await hide(page, AB);
  await expect(node(second, B)).toHaveCount(0);
  await expect(node(second, D)).toHaveCount(1);
  await restore(second, A, AB);
  await expect(node(page, D)).toHaveCount(1);
  await expect(node(page, C).locator('.expand-button')).toHaveAttribute('aria-expanded', 'true');
  await second.close();
});
