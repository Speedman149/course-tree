import { readFileSync } from 'node:fs';
import { expect, test as base, type Page } from '@playwright/test';
import type { CourseDataset } from '../src/types';
import { collectRequirements } from '../src/lib/graph';
const dataset=JSON.parse(readFileSync(new URL('../public/data/courses.json',import.meta.url),'utf8')) as CourseDataset;
const courses=new Map(dataset.courses.map(c=>[c.id,c]));
const test=base.extend<{runtimeErrors:void}>({runtimeErrors:[async({page},use)=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await use();expect(errors).toEqual([]);},{auto:true}]});
async function ready(page:Page,root='02340114'){
 await page.goto(`/?course=${root}`);
 await expect(page.locator('.root-node .node-name')).toHaveText(courses.get(root)!.name);
 await expect(page.getByRole('button',{name:'פתיחת מסנני המפה'})).toBeEnabled();
}
async function open(page:Page){await page.getByRole('button',{name:'פתיחת מסנני המפה'}).click();await expect(page.getByRole('dialog',{name:'מסנני המפה'})).toBeVisible();}
async function close(page:Page){await page.getByRole('button',{name:'הצגת המפה',exact:true}).click();await expect(page.getByRole('dialog',{name:'מסנני המפה'})).toHaveCount(0);}
async function faculty(page:Page,names:string[]){
 await page.getByRole('tab',{name:/סינון לפי פקולטה/}).click();await page.getByRole('button',{name:'ניקוי הכול',exact:true}).click();
 for(const name of names)await page.getByRole('checkbox',{name,exact:true}).check();
}
async function catalog(page:Page,name:string,year='2026-2027'){
 await page.getByRole('tab',{name:/קטלוג תואר/}).click();await page.getByRole('combobox',{name:'שנת קטלוג',exact:true}).selectOption(year);
 await page.getByRole('textbox',{name:'חיפוש תואר'}).fill(name);
 const option=page.locator('.catalog-option').filter({hasText:name}).filter({hasText:year});await expect(option).toHaveCount(1);await option.click();
}
async function rootSearch(page:Page,id:string){
 const search=page.getByRole('combobox',{name:'חיפוש קורס לפי מספר או שם'});await search.fill(id);await page.getByRole('option').filter({hasText:id}).click();await expect(page.locator('.root-node .course-link')).toHaveText(id);
}
async function forwardIds(page:Page){return page.locator('.react-flow__node:has(.course-node:not(.root-node):not(.backward-node))').evaluateAll(nodes=>nodes.map(node=>node.querySelector('.course-link')!.textContent!.trim()));}

test('faculty checkboxes immediately filter expanded nodes and search; reset restores the existing graph',async({page})=>{
 await ready(page);const before=await page.locator('.react-flow__node').count();
 await open(page);await faculty(page,['מדעי המחשב']);await close(page);
 for(const id of await forwardIds(page))expect(courses.get(id)?.faculty).toBe('הפקולטה למדעי המחשב');
 await expect(page.locator('.active-filter-summary')).toContainText('מוסתרים');
 const search=page.getByRole('combobox',{name:'חיפוש קורס לפי מספר או שם'});await search.fill('01040031');await expect(page.getByText('לא נמצאו קורסים',{exact:true})).toBeVisible();await search.press('Escape');
 await open(page);await faculty(page,['מדעי המחשב','מתמטיקה']);await close(page);
 expect((await forwardIds(page)).some(id=>courses.get(id)?.faculty==='הפקולטה למתמטיקה')).toBe(true);
 await open(page);await faculty(page,[]);await close(page);await expect(page.locator('.react-flow__node')).toHaveCount(1);await expect(page.locator('.root-filter-warning')).toBeVisible();
 await page.getByRole('button',{name:'איפוס כל המסננים'}).click();await expect(page.locator('.react-flow__node')).toHaveCount(before);
});

test('degree catalog includes complete lists, excludes unrelated successors, and shows course roles',async({page})=>{
 await ready(page);await open(page);await catalog(page,'מדעי המחשב — מסלול כללי תלת־שנתי');
 await expect(page.locator('.catalog-details')).toContainText('רשימה א׳');await expect(page.locator('.catalog-details')).toContainText('רשימה ב׳');
 const listB=page.locator('.catalog-details details').filter({has:page.locator('summary',{hasText:'רשימה ב׳'})});await listB.locator('summary').click();await expect(listB.locator('.catalog-course-list a')).toHaveCount(68);
 await close(page);await expect(page.locator('.active-filter-summary')).toContainText('2026-2027');
 await expect(page.locator('.react-flow__node[data-id="02140901"]')).toHaveCount(0);
 await expect(page.locator('.react-flow__node[data-id="01270454"]')).toHaveCount(0);
 await page.locator('.root-node .node-info').click();await expect(page.locator('.course-catalog-roles')).toContainText('חובה');await page.keyboard.press('Escape');
 await rootSearch(page,'01040031');await expect(page.locator('.root-node .node-name')).toContainText('אינפיניטסימלי');
});

test('catalog and faculty filters intersect while backward prerequisite exploration stays unfiltered',async({page})=>{
 await ready(page,'02340141');await open(page);await faculty(page,['מדעי המחשב']);await catalog(page,'מדעי המחשב — מסלול כללי תלת־שנתי');await close(page);
 await page.locator('.root-node .node-info').click();
 const mathRequirement=collectRequirements(courses.get('02340141')!.requirements).find(req=>courses.get(req.courseId)?.faculty==='הפקולטה למתמטיקה')!;
 expect(mathRequirement).toBeTruthy();const required=courses.get(mathRequirement.courseId)!;
 await expect(page.locator('.prerequisite-panel')).toContainText('מחוץ לסינון');
 await page.getByRole('button',{name:`הרחבת קדם ${required.name}`,exact:true}).click();
 const backward=page.locator(`.react-flow__node[data-id="${required.id}"]`);await expect(backward).toHaveCount(1);await expect(backward.locator('.course-node')).toHaveClass(/backward-node/);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'התאמת המפה למסך',exact:true}).click();
 for(const id of await forwardIds(page))expect(courses.get(id)?.faculty).toBe('הפקולטה למדעי המחשב');
 await open(page);await faculty(page,['מתמטיקה']);await close(page);
 await expect(backward).toHaveCount(1);await expect(page.locator('.root-filter-warning')).toBeVisible();
 for(const id of await forwardIds(page))expect(courses.get(id)?.faculty).toBe('הפקולטה למתמטיקה');
});

test('catalog years retain different mathematical eligibility and switching programs changes the graph',async({page})=>{
 await ready(page);await open(page);await catalog(page,'מדעי המחשב — מסלול כללי תלת־שנתי','2025-2026');await close(page);
 let search=page.getByRole('combobox',{name:'חיפוש קורס לפי מספר או שם'});await search.fill('01040033');await expect(page.getByRole('option').filter({hasText:'01040033'})).toHaveCount(1);await search.press('Escape');
 await open(page);await catalog(page,'מדעי המחשב — מסלול כללי תלת־שנתי','2026-2027');await close(page);
 await search.fill('01040033');await expect(page.getByText('לא נמצאו קורסים',{exact:true})).toBeVisible();await search.press('Escape');
 await open(page);await catalog(page,'פיזיקה — תכנית תלת־שנתית');await close(page);await expect(page.locator('.active-filter-summary')).toContainText('פיזיקה');
 await search.fill('01150203');await expect(page.getByRole('option').filter({hasText:'01150203'})).toHaveCount(1);
});

test('mobile filters and developer credit remain usable without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page);await expect(page.locator('.map-developer-credit')).toBeVisible();await expect(page.locator('.map-developer-credit')).toHaveCSS('font-size','10px');
 await open(page);await faculty(page,['מדעי המחשב']);await catalog(page,'מדעי המחשב — מסלול כללי תלת־שנתי');await close(page);
 await expect(page.locator('.active-filter-summary')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await open(page);await page.getByRole('button',{name:'כל המקצועות — ללא סינון לפי קטלוג'}).click();await faculty(page,[]);await page.getByRole('button',{name:'בחירת הכול',exact:true}).click();await close(page);
 await expect(page.locator('.active-filter-summary')).toHaveCount(0);await expect(page.locator('.root-node')).toBeVisible();
});

test('complete program course browser selects an eligible course as root independently of faculty filters',async({page})=>{
 await ready(page);await open(page);await faculty(page,['מדעי המחשב']);await catalog(page,'מדעי המחשב — מסלול כללי תלת־שנתי','2025-2026');
 await page.getByRole('textbox',{name:'חיפוש קורסים בתכנית'}).fill('01040031');
 await expect(page.getByRole('list',{name:'קורסים בתכנית'}).getByRole('listitem')).toHaveCount(1);
 const info=page.getByRole('link',{name:'מידע רשמי על 01040031'});await expect(info).toHaveAttribute('target','_blank');
 await page.getByRole('button',{name:'בחירת 01040031 לעץ חדש',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'מסנני המפה'})).toHaveCount(0);
 await expect(page.locator('.root-node .course-link')).toHaveText('01040031');
 await expect(page.locator('.root-filter-warning')).toBeVisible();
 await expect(page.locator('.active-filter-summary')).toContainText('2025-2026');
});
test('late catalog loading still initializes the baseline year and shows coverage limits',async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/data/catalogs.json',async route=>{await gate;await route.continue();});
 try{
  await ready(page);await open(page);await page.getByRole('tab',{name:/קטלוג תואר/}).click();
  await expect(page.getByText('טוענים את מאגר התארים…',{exact:true})).toBeVisible();
  release();
  await expect(page.getByRole('combobox',{name:'שנת קטלוג',exact:true})).toHaveValue('2025-2026');
  await expect(page.getByLabel('כיסוי מאגר הקטלוג')).toContainText('טרם הושלם אימות מלא');
  await expect(page.getByRole('link',{name:'הורדת דוח הכיסוי (JSON)'})).toHaveAttribute('href',/data\/catalog-coverage\.json$/);
 }finally{release();}
});

test('inventory-only path shows its evidence without inventing curriculum eligibility',async({page})=>{
 await ready(page,'02340141');await open(page);await catalog(page,'ארכיטקטורה — B.Arch.','2025-2026');
 await expect(page.locator('.catalog-details .filter-warning')).toContainText('טרם יובאו ואומתו');
 await expect(page.locator('.program-course-browser')).toHaveCount(0);
 await close(page);await expect(page.locator('.react-flow__node')).toHaveCount(1);
 await expect(page.locator('.catalog-scope-notice')).toContainText('תכנית מתועדת בלבד');
 await page.locator('.root-node .node-info').click();
 expect(await page.locator('.prerequisite-panel .prerequisite-row').count()).toBeGreaterThan(0);
 await expect(page.locator('.prerequisite-panel .prerequisite-expand').first()).toBeEnabled();
});
test('search returns one canonical combined program discoverable from either participating faculty',async({page})=>{
 await ready(page);await open(page);await catalog(page,'מדעי המחשב ופיזיקה','2025-2026');
 const selected=page.locator('.catalog-option[aria-pressed="true"]');await expect(selected).toHaveCount(1);
 await expect(selected).toContainText('תואר משולב');
 await page.getByRole('combobox',{name:'פקולטת התואר',exact:true}).selectOption('physics');
 await expect(selected).toHaveCount(1);await expect(selected).toContainText('מדעי המחשב ופיזיקה');
 await page.getByRole('combobox',{name:'פקולטת התואר',exact:true}).selectOption('cs');
 await expect(selected).toHaveCount(1);await expect(selected).toContainText('מדעי המחשב ופיזיקה');
});

test('all-course root search preserves active degree and faculty filters for an outside course',async({page})=>{
 await ready(page);await open(page);await faculty(page,['מדעי המחשב']);await catalog(page,'מדעי המחשב — מסלול כללי תלת־שנתי','2025-2026');await close(page);
 const search=page.getByRole('combobox',{name:'חיפוש קורס לפי מספר או שם'});
 await search.fill('02140901');await expect(page.getByRole('option').filter({hasText:'02140901'})).toHaveCount(0);
 const scope=page.getByRole('button',{name:'חיפוש בכל הקורסים',exact:true});await expect(scope).toHaveAttribute('aria-pressed','false');await scope.click();
 const outside=page.getByRole('option').filter({hasText:'02140901'});await expect(outside).toContainText('מחוץ לסינון');await outside.click();
 await expect(page.locator('.root-node .course-link')).toHaveText('02140901');
 await expect(page.locator('.root-filter-warning')).toBeVisible();
 await expect(page.locator('.active-filter-summary')).toContainText('2025-2026');
 await open(page);await page.getByRole('tab',{name:/סינון לפי פקולטה/}).click();
 await expect(page.getByRole('checkbox',{checked:true})).toHaveCount(1);await expect(page.getByRole('checkbox',{name:'מדעי המחשב',exact:true})).toBeChecked();
 await close(page);
 for(const id of await forwardIds(page))expect(courses.get(id)?.faculty).toBe('הפקולטה למדעי המחשב');
});
