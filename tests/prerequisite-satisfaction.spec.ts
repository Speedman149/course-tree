import {openTools, toolsTrigger} from './helpers/mobile-tools';
import {expect, test as base, type Page} from '@playwright/test';
import {PROGRESS_KEY, PROGRESS_VERSION} from '../src/lib/progress';
import {PREREQUISITE_HIGHLIGHT_LABEL, PREREQUISITE_HIGHLIGHT_SHORT_LABEL} from '../src/lib/prerequisite-satisfaction';

const A = '00140855', B = '00140856', C = '00140889', S = '00140843';
const INTRO = '02340114', UNKNOWN = '00180106';
const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const card = (page: Page, id: string) => node(page, id).locator('.course-node');
const toggle = (page: Page) => page.getByRole('switch', {name: PREREQUISITE_HIGHLIGHT_LABEL, exact: true});
const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').progress, PROGRESS_KEY);
const test = base.extend<{runtimeErrors: void}>({runtimeErrors: [async ({page}, use) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await use(); expect(errors).toEqual([]);
}, {auto: true}]});
async function ready(page: Page, primary = A, overrides: Record<string, unknown> = {}) {
  await page.addInitScript(({key, version, primary, overrides}) => {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, JSON.stringify({version, progress: {addedCourseIds: [primary], expandedForward: [primary], markedCourseIds: [], ...overrides}}));
  }, {key: PROGRESS_KEY, version: PROGRESS_VERSION, primary, overrides});
  await page.goto('/?course=' + primary);
  await expect(node(page, primary).locator('.course-link')).toHaveText(primary);
  if (await toolsTrigger(page).isVisible()) await expect(page.locator('.map-actions > .filters-trigger + .mobile-tools-trigger')).toHaveCount(1);
  else {await expect(toggle(page)).toBeVisible(); await expect(page.locator('.map-actions > .filters-trigger + .prerequisite-highlight-toggle')).toHaveCount(1);}
  await expect(page.locator('.site-footer [role="switch"]')).toHaveCount(0);
}
async function showToggle(page: Page) {if (await toolsTrigger(page).isVisible()) await openTools(page); return toggle(page);}
async function changeHighlight(page: Page, key: string) {const control = await showToggle(page); await control.focus(); await control.press(key); if (await toolsTrigger(page).isVisible()) await page.keyboard.press('Escape');}
async function changeMark(page: Page, id: string) {
  const button = node(page, id).locator('.mark-button'); await button.focus(); await button.press('Enter');
}
async function details(page: Page, id: string) {
  const button = node(page, id).locator('.node-info'); await button.focus(); await button.press('Enter');
  const panel = page.locator('.prerequisite-panel'); await expect(panel).toBeVisible(); return panel;
}

for (const width of [1440, 320]) test(`ordinary satisfaction reacts without changing graph geometry at ${width}px`, async ({page}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({width, height: width === 320 ? 568 : 1000});
  await ready(page, A, {markedCourseIds: [S]}); // S is marked but hidden and not added.
  await expect(node(page, S)).toHaveCount(0);
  await expect(await showToggle(page)).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('.prerequisites-satisfied')).toHaveCount(0);
  const before = await node(page, B).getAttribute('style');
  const border = await card(page, B).evaluate(e => getComputedStyle(e).borderColor);
  const ids = await page.locator('.react-flow__node').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-id')).sort());
  await changeHighlight(page, 'Space');
  await expect(card(page, C)).toHaveClass(/prerequisites-satisfied/); // A OR S, with S marked.
  await expect(card(page, B)).not.toHaveClass(/prerequisites-satisfied/); // A AND S, A still absent.
  await expect(card(page, A)).not.toHaveClass(/prerequisites-satisfied/);
  await changeMark(page, A);
  await expect(card(page, B)).toHaveClass(/prerequisites-satisfied/);
  await expect(card(page, A)).toHaveClass(/user-marked/);
  await expect(card(page, A)).not.toHaveClass(/prerequisites-satisfied/);
  await expect(node(page, A).locator('.added-badge')).toBeVisible();
  await expect(node(page, B).getByRole('img', {name: 'כל הקדמים הרגילים מסומנים', exact: true})).toHaveCount(1);
  expect(await card(page, B).evaluate(e => getComputedStyle(e).borderColor)).toBe(border);
  expect(await node(page, B).getAttribute('style')).toBe(before);
  expect(await page.locator('.react-flow__node').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-id')).sort())).toEqual(ids);
  const indicator = await node(page, B).locator('.prerequisite-satisfied-indicator').boundingBox();
  const title = await node(page, B).locator('.node-name').boundingBox();
  expect(indicator && title && indicator.y + indicator.height <= title.y).toBe(true);
  let panel = await details(page, B);
  await expect(panel.locator('.prerequisite-mark-summary')).toContainText('כל הקדמים הרגילים מסומנים');
  await expect(panel.locator('.prerequisite-mark-state').filter({hasText: /^מסומן$/})).toHaveCount(2);
  await expect(panel.getByRole('link', {name: 'מידע במקור', exact: true})).toHaveAttribute('target', '_blank');
  await page.keyboard.press('Escape');
  await changeMark(page, B);
  await expect(card(page, B)).toHaveClass(/user-marked/);
  await expect(node(page, B).locator('.prerequisite-satisfied-indicator')).toHaveCount(0);
  await changeMark(page, B); await expect(card(page, B)).toHaveClass(/prerequisites-satisfied/);
  await changeMark(page, A); await expect(card(page, B)).not.toHaveClass(/prerequisites-satisfied/);
  await expect(card(page, C)).toHaveClass(/prerequisites-satisfied/);
  const collapse = node(page, A).locator('.expand-button'); await collapse.focus(); await collapse.press('Enter');
  await expect(node(page, C)).toHaveCount(0); await collapse.press('Enter');
  await expect(card(page, C)).toHaveClass(/prerequisites-satisfied/);
  await changeHighlight(page, 'Enter');
  await expect(page.locator('.prerequisites-satisfied')).toHaveCount(0);
  await expect(page.locator('.prerequisite-satisfied-indicator')).toHaveCount(0);
  await expect.poll(async () => (await saved(page))?.highlightSatisfiedPrerequisites).toBe(false);
  expect((await saved(page)).markedCourseIds).toEqual([S]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('restored markings, clearing, unknown data and cross-tab preference remain independent of visibility', async ({page, context}) => {
  await ready(page, INTRO, {addedCourseIds: [INTRO, B, UNKNOWN], expandedForward: [], markedCourseIds: [A, S], highlightSatisfiedPrerequisites: true, facultyIds: ['cs']});
  await expect(toggle(page)).toHaveAttribute('aria-checked', 'true');
  await expect(card(page, B)).toHaveClass(/prerequisites-satisfied/); // Both prerequisites hidden by graph and faculty filters.
  await expect(card(page, INTRO)).toHaveClass(/prerequisites-satisfied/);
  await expect(node(page, INTRO).getByRole('img', {name: 'ללא קדמים רגילים לפי המידע במאגר'})).toHaveCount(1);
  await expect(card(page, UNKNOWN)).toHaveAttribute('data-prerequisite-status', 'unknown');
  await expect(card(page, UNKNOWN)).not.toHaveClass(/prerequisites-satisfied/);
  await expect(node(page, A)).toHaveCount(0); await expect(node(page, S)).toHaveCount(0);
  await page.reload(); await expect(card(page, B)).toHaveClass(/prerequisites-satisfied/);
  await changeMark(page, INTRO); await expect(card(page, INTRO)).toHaveClass(/user-marked/);
  await expect(node(page, INTRO).locator('.prerequisite-satisfied-indicator')).toHaveCount(0);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', {name: 'ניקוי סימונים', exact: true}).focus();
  await page.getByRole('button', {name: 'ניקוי סימונים', exact: true}).press('Enter');
  await expect(card(page, B)).not.toHaveClass(/prerequisites-satisfied/);
  await expect(card(page, INTRO)).toHaveClass(/prerequisites-satisfied/);
  await expect(toggle(page)).toHaveAttribute('aria-checked', 'true');
  const other = await context.newPage(); await other.goto('/');
  await expect(toggle(other)).toHaveAttribute('aria-checked', 'true');
  await toggle(other).focus(); await toggle(other).press('Space');
  await expect(toggle(page)).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('.prerequisites-satisfied')).toHaveCount(0); await other.close();
  await page.reload(); await expect(toggle(page)).toHaveAttribute('aria-checked', 'false');
  expect((await saved(page)).facultyIds).toEqual(['cs']); expect((await saved(page)).addedCourseIds).toEqual([INTRO, B, UNKNOWN]);
});

test('real concurrent requirements are explained separately without blocking ordinary satisfaction', async ({page}) => {
  await ready(page, '00940210', {addedCourseIds: ['00940210', '00940222'], expandedForward: [], markedCourseIds: ['02340111'], highlightSatisfiedPrerequisites: true});
  for (const id of ['00940210', '00940222']) await expect(card(page, id)).toHaveClass(/prerequisites-satisfied/);
  const panel = await details(page, '00940210');
  await expect(panel.locator('.prerequisite-mark-summary')).toContainText('מקצועות צמודים ותנאי רישום נוספים אינם נבדקים');
  await expect(panel.locator('.prerequisite-mark-state').filter({hasText: 'לא נבדק בהדגשה'})).toHaveCount(1);
  expect(await panel.locator('.prerequisite-mark-state').filter({hasText: /^לא מסומן$/}).count()).toBeGreaterThan(0); // Unchosen OR alternatives do not block.
  await page.keyboard.press('Escape');
  await expect(node(page, '00940222').getByRole('img', {name: 'ללא קדמים רגילים לפי המידע במאגר'})).toHaveCount(1);
});

for (const width of [1440, 320]) test(`the existing help entry opens the visual seven-step tutorial at ${width}px`, async ({page}) => {
  await page.setViewportSize({width, height: width === 320 ? 568 : 1000});
  await ready(page);
  const help = page.getByRole('button', {name: 'איך זה עובד?', exact: true}); await help.click();
  const guide = page.getByRole('dialog', {name: 'איך משתמשים במפת הקורסים?', exact: true}); await expect(guide).toBeVisible();
  await expect(guide).toHaveCSS('direction', 'rtl');
  await expect(guide.locator('.tutorial-progress nav button')).toHaveCount(7);
  await expect(guide.getByRole('button',{name:'הקודם',exact:true})).toBeDisabled();
  for(let step=0;step<7;step++){
    await expect(guide.locator('.tutorial-step-heading h3')).toBeVisible();
    await expect(guide.locator('.tutorial-progress nav button').nth(step)).toHaveAttribute('aria-current','step');
    if(step===4)await expect(guide.getByText(PREREQUISITE_HIGHLIGHT_SHORT_LABEL,{exact:true})).toBeAttached();
    if(step===6)await expect(guide.locator('.tutorial-credit-total')).toContainText('סה״כ נק״ז');
    expect(await guide.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
    if(step<6)await guide.getByRole('button',{name:'הבא',exact:true}).click();
  }
  await expect(guide).not.toContainText(/נעיצות|נעוצים|pinned|React Flow/i);
  await guide.getByRole('button', {name:'סגירה',exact:true}).focus();await page.keyboard.press('Shift+Tab');
  await expect(guide.getByRole('button',{name:'הבנתי, בואו נתחיל!',exact:true})).toBeFocused();
  await page.keyboard.press('Tab');await expect(guide.getByRole('button',{name:'סגירה',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(guide).toHaveCount(0);await expect(help).toBeFocused();
  await expect(await showToggle(page)).toHaveAttribute('aria-checked','false');
  if(await toolsTrigger(page).isVisible())await page.keyboard.press('Escape');
});
