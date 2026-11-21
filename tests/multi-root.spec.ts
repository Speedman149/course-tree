import { expect, test as base, type Page } from '@playwright/test';
import { PROGRESS_KEY } from '../src/lib/progress';

const A = '00000001', B = '00000002', C = '00000003', D = '00000004';
const E = '00000005', F = '00000006', X = '00000007', Y = '00000008', U = '00000009';
const leaf = (courseId: string) => ({ type: 'course', courseId, relation: 'strong' });
const course = (id: string, prerequisite?: string, faculty = 'הפקולטה למדעי המחשב') => ({
  id, name: 'מקצוע בדיקה ' + id, faculty,
  requirements: prerequisite ? leaf(prerequisite) : null,
  requirementsStatus: prerequisite ? 'known' : 'none',
  source: { url: 'https://portalex.technion.ac.il/ovv/#/details/2026/200/SM/' + id },
});
const dataset = { meta: { latestTerm: '2026_200' }, courses: [
  course(A), course(B, A, 'הפקולטה למתמטיקה'), course(C, B), course(D, C),
  course(E, A), course(F, E), course(X), course(Y, X), course(U, B),
] };
const catalog = { meta: { years: ['2025-2026'], defaultYear: '2025-2026', notes: [] }, sources: [], programs: [], referencedCourses: [] };
const test = base.extend<{ graphFixture: void }>({
  graphFixture: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/data/courses.json', route => route.fulfill({ json: dataset }));
    await page.route('**/data/catalogs.json', route => route.fulfill({ json: catalog }));
    await use();
    expect(errors).toEqual([]);
    const ids = await page.locator('.react-flow__node').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-id')));
    expect(new Set(ids).size).toBe(ids.length);
  }, { auto: true }],
});
const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const connection = (source: string, target: string) => source + '->' + target + ':strong';
const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').progress, PROGRESS_KEY);
async function ready(page: Page, id = A) {
  await page.goto('/?course=' + id);
  await expect(node(page, id).locator('.course-link')).toHaveText(id);
}
async function expand(page: Page, id: string) {
  const button = node(page, id).locator('.expand-button');
  await button.focus(); await button.press('Enter');
}
async function search(page: Page) {
  const input = page.getByRole('combobox', { name: 'חיפוש קורס לפי מספר או שם' });
  if (!await input.isVisible()) await page.getByRole('button', { name: 'חיפוש קורסים', exact: true }).click();
  return input;
}
async function pin(page: Page, id: string) {
  const input = await search(page); await input.fill(id);
  await page.getByRole('option').filter({ hasText: id }).getByRole('button', { name: 'הוסף לעץ ' + id, exact: true }).click();
  await input.press('Escape');
  await expect(node(page, id).locator('.added-badge')).toBeVisible();
}
async function unpin(page: Page, id: string) {
  await page.getByRole('button', {name:'קורסים שהוספתי',exact:true}).click();
  await page.getByRole('dialog',{name:'קורסים שהוספתי',exact:true}).getByRole('button', { name: 'הסר מהעץ ' + id, exact: true }).click();
  await page.keyboard.press('Escape');
}
async function hide(page: Page, source: string, target: string) {
  const button = page.locator('[data-connection="' + connection(source, target) + '"]');
  await button.focus(); await button.press('Enter');
}
async function backward(page: Page, parent: string, prerequisite: string) {
  // Click waits for the automatic fit animation to settle before opening the next card.
  await node(page, parent).locator('.node-info').click();
  const dialog = page.getByRole('dialog', { name: 'קדמים של מקצוע בדיקה ' + parent, exact: true });
  const button = dialog.getByRole('button', { name: 'הרחבת קדם מקצוע בדיקה ' + prerequisite, exact: true });
  await button.focus(); await button.press('Enter'); await page.keyboard.press('Escape');
  await expect(node(page, prerequisite)).toHaveCount(1);
}

test('backward to forward exploration reuses both the original course and relationship', async ({ page }) => {
  await ready(page, C);
  await backward(page, C, B);
  await backward(page, B, A);
  await expand(page, B);
  await expect(node(page, C)).toHaveCount(1);
  await expect(page.locator('.react-flow__edge[data-id="edge:' + connection(B, C) + '"]')).toHaveCount(1);
  await expect(node(page, B).locator('.backward-badge')).toBeVisible();
  for (let i = 0; i < 2; i++) { await expand(page, B); await expand(page, B); }
  await expect(node(page, C)).toHaveCount(1);
});

test('pinning a hidden descendant reveals just its path and preserves an expanded sibling', async ({ page }) => {
  await ready(page); await expand(page, E);
  await expect(node(page, F)).toHaveCount(1);
  await pin(page, D);
  for (const id of [A, B, C, D, E, F]) await expect(node(page, id)).toHaveCount(1);
  await expect(node(page, U)).toHaveCount(0);
  await expect.poll(async () => (await saved(page))?.automaticConnections?.length).toBe(1);
  await expect(node(page, D).locator('.course-node')).toHaveClass(/is-focused/);
  await expect.poll(async () => node(page, D).locator('.course-node').getAttribute('class')).not.toMatch(/is-focused/);
  await unpin(page, D);
  await expect(node(page, C)).toHaveCount(0);
  await expect(node(page, F)).toHaveCount(1);
});

test('an ancestor pin reveals genuine backwards arrows with no unrelated siblings', async ({ page }) => {
  await ready(page, C); await pin(page, A);
  for (const id of [A, B, C]) await expect(node(page, id)).toHaveCount(1);
  await expect(node(page, E)).toHaveCount(0);
  await expect(node(page, U)).toHaveCount(0);
  await expect(page.locator('.react-flow__edge[data-id="edge:' + connection(A, B) + '"]')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge[data-id="edge:' + connection(B, C) + '"]')).toHaveCount(1);
  await expect(node(page, B).locator('.backward-badge')).toBeVisible();
});

test('a manually hidden bridge stays closed until the pin connector is explicitly revealed', async ({ page }) => {
  await ready(page); await expand(page, B); await hide(page, B, C);
  await pin(page, D);
  await expect(node(page, C)).toHaveCount(0);
  await expect(page.locator('[data-connection="' + connection(B, C) + '"]')).toHaveCount(0);
  await expect.poll(async () => (await saved(page))?.hiddenForwardConnections).toContain(connection(B, C));
  await page.getByRole('button',{name:'קורסים שהוספתי',exact:true}).click();
  await page.getByRole('dialog',{name:'קורסים שהוספתי',exact:true}).getByRole('button',{name:'מיקוד בקורס שהוספתי '+D,exact:true}).click();
  await expect(node(page, C)).toHaveCount(1);
  await expect(node(page, D)).toHaveCount(1);
  await expect.poll(async () => (await saved(page))?.hiddenForwardConnections).not.toContain(connection(B, C));
});

test('course collapse and arrow collapse retain a downstream pin and unrelated expanded courses', async ({ page }) => {
  await ready(page); await expand(page, E); await pin(page, D);
  await hide(page, B, C);
  await expect(node(page, C)).toHaveCount(0);
  await expect(node(page, D).locator('.added-badge')).toBeVisible();
  await expect(node(page, F)).toHaveCount(1);
  const restore = node(page, B).locator('.branch-restores');
  await restore.locator('summary').focus(); await restore.locator('summary').press('Enter');
  await restore.getByRole('button', { name: 'החזרת הענף ' + C + ' דרך ' + B, exact: true }).click();
  await expect(node(page, C)).toHaveCount(1);
  await expect(node(page, U)).toHaveCount(0);
  await expand(page, A);
  await expect(node(page, A)).toHaveCount(1); await expect(node(page, D)).toHaveCount(1);
  await expect(node(page, B)).toHaveCount(0); await expect(node(page, E)).toHaveCount(0);
  await expand(page, A);
  await expect(node(page, F)).toHaveCount(1); await expect(node(page, C)).toHaveCount(1);
});

test('filtered connecting courses stay hidden but manual prerequisite exploration remains unfiltered', async ({ page }) => {
  await ready(page, C);
  await page.getByRole('button', { name: 'פתיחת מסנני המפה' }).click();
  await page.getByRole('button', { name: 'ניקוי הכול', exact: true }).click();
  await page.getByRole('checkbox', { name: 'מדעי המחשב', exact: true }).check();
  await page.getByRole('button', { name: 'הצגת המפה', exact: true }).click();
  await pin(page, A);
  await expect(node(page, B)).toHaveCount(0);
  await page.getByRole('button',{name:'קורסים שהוספתי',exact:true}).click();
  await page.getByRole('dialog',{name:'קורסים שהוספתי',exact:true}).getByRole('button',{name:'מיקוד בקורס שהוספתי '+A,exact:true}).click();
  await expect(page.getByText('החיבור מוסתר במסננים הנוכחיים.',{exact:true})).toBeVisible();
  await backward(page, C, B);
  await expect(node(page, B)).toHaveCount(1);
});

test('all four pins and canonical state survive URL refresh, while removing every addition preserves primary exploration', async ({ page }) => {
  await ready(page);
  for (const id of [D, X, Y]) await pin(page, id);
  await expect.poll(async () => (await saved(page))?.addedCourseIds).toEqual([A, D, X, Y]);
  await page.reload();
  for (const id of [A, D, X, Y]) await expect(node(page, id).locator('.added-badge')).toBeVisible();
  expect((await saved(page)).addedCourseIds).toEqual([A, D, X, Y]);
  for (const id of [A, D, X, Y]) await unpin(page, id);
  await expect(node(page,A)).toHaveCount(1);
  await expect.poll(async()=>(await saved(page))?.addedCourseIds).toEqual([]);
  await expect(page).toHaveURL(new RegExp('course='+A));
  await page.reload();await expect(node(page,A)).toHaveCount(1);
  expect((await saved(page)).addedCourseIds).toEqual([]);
});

test('new explicit course query opens a sole root while preserving marks and preferences', async ({ page }) => {
  await ready(page); await pin(page, D); await pin(page, X);
  const mark = node(page, A).locator('.mark-button'); await mark.focus(); await mark.press('Enter');
  await expect.poll(async () => (await saved(page))?.addedCourseIds).toEqual([A, D, X]);
  await page.goto('/?course=' + E);
  await expect(node(page, E).locator('.added-badge')).toBeVisible();
  await expect.poll(async () => (await saved(page))?.addedCourseIds).toEqual([E]);
  expect((await saved(page)).markedCourseIds).toContain(A);
});
