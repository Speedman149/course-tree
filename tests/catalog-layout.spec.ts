import {expect,test} from '@playwright/test';

for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
 test(`baseline catalog layout at ${viewport.width}px`,async({page},testInfo)=>{
  await page.setViewportSize(viewport);
  await page.goto('/?course=02340114');
  await expect(page.locator('.course-node.is-added .course-link')).toHaveText('02340114');
  await expect(page.getByRole('button',{name:viewport.width<=640?'כלים':'קורסים שהוספתי',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'פתיחת מסנני המפה'}).click();
  await page.getByRole('tab',{name:/קטלוג תואר/}).click();
  await expect(page.getByRole('combobox',{name:'שנת קטלוג',exact:true})).toHaveValue('2025-2026');
  await page.getByRole('textbox',{name:'חיפוש תואר'}).fill('סייבר');
  const option=page.locator('.catalog-option');await expect(option).toHaveCount(1);await option.click();
  await expect(page.locator('.catalog-details')).toContainText('מידע חלקי');
  await expect(page.getByRole('textbox',{name:'חיפוש קורסים בתכנית'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('catalog-panel.png')});
  await page.getByRole('button',{name:'הצגת המפה',exact:true}).click();
  await expect(page.locator('.active-filter-summary')).toContainText('2025-2026');
  const credit=page.locator(viewport.width<641?'.map-developer-credit':'.developer-credit');
  await expect(credit).toBeVisible();await expect(credit).toHaveCSS('font-size',viewport.width<641?'10px':'11px');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('catalog-graph.png')});
 });
}