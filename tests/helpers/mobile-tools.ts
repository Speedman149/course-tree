import {expect, type Page} from '@playwright/test';
import {PROGRESS_KEY} from '../../src/lib/progress';

export const toolsTrigger = (page: Page) => page.getByRole('button', {name: 'כלים', exact: true});
export const toolsPanel = (page: Page) => page.getByRole('dialog', {name: 'כלים', exact: true});
export async function openTools(page: Page) {
  if (!await toolsPanel(page).isVisible()) {
    await page.mouse.move(0, 0);
    await page.keyboard.press('Escape');
    await toolsTrigger(page).click();
    await expect(toolsPanel(page)).toBeVisible();
  }
  return toolsPanel(page);
}
export async function openCollection(page: Page, kind: 'added' | 'marked') {
  if (await toolsTrigger(page).isVisible()) {
    const drawer = await openTools(page);
    const section = drawer.locator(`[data-tools-section="${kind}"]`);
    if (!await section.evaluate((e: HTMLDetailsElement) => e.open)) await section.locator(':scope > summary').click();
    return section;
  }
  await page.mouse.move(0, 0);
  await page.keyboard.press('Escape');
  const name = kind === 'added' ? 'קורסים שהוספתי' : 'רשימת מסומנים';
  const trigger = page.getByRole('button', {name, exact: true});
  // The pre-rendered loading footer intentionally disables actions until the app is ready.
  await expect(trigger).toBeEnabled();
  await trigger.scrollIntoViewIfNeeded(); await trigger.click();
  const panel = page.getByRole('dialog', {name, exact: true}); await expect(panel).toBeVisible(); return panel;
}

/** Wait for an intentional camera focus and its saved viewport before taking a no-movement snapshot. */
export async function settledViewport(page:Page){
 let previous:string|null=null,stable=0;
 await expect.poll(async()=>{const next=await page.locator('.react-flow__viewport').getAttribute('style');stable=next===previous?stable+1:0;previous=next;return stable;},{intervals:[50,100,100]}).toBeGreaterThanOrEqual(2);
 await expect.poll(()=>page.locator('.react-flow__viewport').evaluate((el,key)=>{
  const saved=JSON.parse(localStorage.getItem(key)??'{}').progress?.viewport;if(!saved)return Infinity;
  const matrix=new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return Math.max(Math.abs(matrix.a-saved.zoom),Math.abs(matrix.e-saved.x),Math.abs(matrix.f-saved.y));
 },PROGRESS_KEY)).toBeLessThan(.1);
}
