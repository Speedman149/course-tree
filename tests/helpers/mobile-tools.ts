import {expect, type Page} from '@playwright/test';

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
  await trigger.scrollIntoViewIfNeeded(); await trigger.click();
  const panel = page.getByRole('dialog', {name, exact: true}); await expect(panel).toBeVisible(); return panel;
}
