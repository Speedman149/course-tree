import {expect,test as base,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {PROGRESS_KEY} from '../src/lib/progress';
import {courseAppearance} from '../src/lib/faculty-colors';
const sap=JSON.parse(readFileSync(new URL('../public/data/courses.json',import.meta.url),'utf8'));
const catalogs=JSON.parse(readFileSync(new URL('../public/data/catalogs.json',import.meta.url),'utf8'));
const courses=new Map([...sap.courses,...catalogs.referencedCourses].map(c=>[c.id,c]));
const test=base.extend<{runtimeErrors:void}>({runtimeErrors:[async({page},use)=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await use();expect(errors).toEqual([]);},{auto:true}]});
const node=(page:Page,id='root')=>page.locator(`.react-flow__node[data-id="${id}"]`);
const saved=(page:Page)=>page.evaluate(key=>{const raw=localStorage.getItem(key);return raw?JSON.parse(raw).progress:null;},PROGRESS_KEY);
async function ready(page:Page,root='02340247') {await page.goto(`/?course=${root}`);await expect(node(page).locator('.course-link')).toHaveText(root);}
async function fit(page:Page){await page.keyboard.press('Escape');await page.getByRole('button',{name:'התאמת המפה למסך',exact:true}).click();}
async function mark(page:Page,id='root'){await fit(page);await node(page,id).locator('.mark-button').click();}
async function seed(page:Page,raw:string){await page.addInitScript(({key,raw})=>{if(!sessionStorage.getItem('seeded-progress')){localStorage.setItem(key,raw);sessionStorage.setItem('seeded-progress','yes');}},{key:PROGRESS_KEY,raw});}
async function openFilters(page:Page){await page.getByRole('button',{name:'פתיחת מסנני המפה'}).click();}
async function closeFilters(page:Page){await page.getByRole('button',{name:'הצגת המפה',exact:true}).click();}

test('session restores root, catalog, faculties, forward/backward expansions, red markings and viewport',async({page,context})=>{
 await ready(page);await openFilters(page);
 await page.getByRole('tab',{name:/קטלוג תואר/}).click();
 await page.getByRole('textbox',{name:'חיפוש תואר'}).fill('מסלול כללי תלת');
 await page.locator('.catalog-option').filter({hasText:'2025-2026'}).click();
 await page.getByRole('tab',{name:/סינון לפי פקולטה/}).click();await page.getByRole('button',{name:'ניקוי הכול',exact:true}).click();
 for(const faculty of ['מדעי המחשב','מתמטיקה','פיזיקה'])await page.getByRole('checkbox',{name:faculty,exact:true}).check();
 await closeFilters(page);await fit(page);
 const forward='root/f:02360299:strong';await node(page,forward).locator('.expand-button').focus();await node(page,forward).locator('.expand-button').press('Enter');await expect(node(page,forward).locator('.expand-button')).toHaveAttribute('aria-expanded','true');
 // Test persistence through keyboard controls while branch-focus camera motion settles.
 // explorer.spec.ts separately covers hover and pointer interaction with this panel.
 await node(page).locator('.node-info').focus();await node(page).locator('.node-info').press('Enter');
 const prerequisite=page.getByRole('dialog',{name:`קדמים של ${courses.get('02340247').name}`,exact:true}).getByRole('button',{name:`הרחבת קדם ${courses.get('02340218').name}`,exact:true});await prerequisite.focus();await prerequisite.press('Enter');
 await expect(node(page,'root/b:02340218:strong')).toHaveCount(1);
 await mark(page);await mark(page,'root/b:02340218:strong');
 await page.getByRole('button',{name:'הגדלת המפה',exact:true}).click();
 await expect.poll(async()=> (await saved(page))?.expandedForward).toContain(forward);
 await expect.poll(async()=> (await saved(page))?.markedCourseIds).toEqual(['02340218','02340247']);
 await expect.poll(async()=> (await saved(page))?.viewport?.zoom??0).toBeGreaterThan(0);
 await page.waitForTimeout(650);
 const before=await saved(page);const ids=await page.locator('.react-flow__node').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-id')).sort());
 await page.reload();await expect(node(page).locator('.course-link')).toHaveText('02340247');
 await expect(node(page,forward).locator('.expand-button')).toHaveAttribute('aria-expanded','true');
 await expect(node(page,'root/b:02340218:strong').locator('.mark-button')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.active-filter-summary')).toContainText('2025-2026');
 expect(await page.locator('.react-flow__node').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-id')).sort())).toEqual(ids);
 await expect.poll(async()=>{const after=await saved(page);return Math.abs((after?.viewport?.zoom??0)-before.viewport.zoom);}).toBeLessThan(.01);
 await expect.poll(async()=>page.locator('.react-flow__viewport').evaluate((el,expected)=>{const m=new DOMMatrixReadOnly(getComputedStyle(el).transform);return Math.max(Math.abs(m.e-expected.x),Math.abs(m.f-expected.y));},before.viewport)).toBeLessThan(1);
 const currentTransform=await page.locator('.react-flow__viewport').getAttribute('style');expect(currentTransform).toContain(`scale(${before.viewport.zoom})`);
 await openFilters(page);for(const faculty of ['מדעי המחשב','מתמטיקה','פיזיקה'])await expect(page.getByRole('checkbox',{name:faculty,exact:true})).toBeChecked();await expect(page.getByRole('checkbox',{name:'הנדסת מכונות',exact:true})).not.toBeChecked();await closeFilters(page);
 // A new tab with no course query restores the last explored root from local storage.
 const reopened=await context.newPage();await reopened.goto('/');await expect(node(reopened).locator('.course-link')).toHaveText('02340247');await expect(node(reopened).locator('.mark-button')).toHaveAttribute('aria-pressed','true');await reopened.close();
});

test('duplicate course instances share markings across roots, filters and branch reset',async({page})=>{
 await ready(page,'00140855');
 for(const id of ['root/f:00140856:strong','root/f:00140889:strong']){await fit(page);await node(page,id).locator('.expand-button').click();}
 const duplicates=page.locator('.course-node').filter({has:page.locator('.course-link').filter({hasText:'00140866'})});
 await expect(duplicates).toHaveCount(2);await fit(page);await duplicates.first().locator('.mark-button').click();
 for(const duplicate of await duplicates.all())await expect(duplicate).toHaveClass(/user-marked/);
 await page.getByRole('button',{name:'איפוס ענפים',exact:true}).click();await expect.poll(async()=> (await saved(page))?.markedCourseIds).toContain('00140866');
 const search=page.getByRole('combobox',{name:'חיפוש קורס לפי מספר או שם'});await search.fill('00140866');await page.getByRole('option').filter({hasText:'00140866'}).click();
 await expect(node(page).locator('.mark-button')).toHaveAttribute('aria-pressed','true');await page.reload();await expect(node(page).locator('.course-node')).toHaveClass(/user-marked/);
 await openFilters(page);await page.getByRole('button',{name:'ניקוי הכול',exact:true}).click();await closeFilters(page);await expect(node(page).locator('.course-node')).toHaveClass(/user-marked/);
 await mark(page);await expect(node(page).locator('.course-node')).not.toHaveClass(/user-marked/);expect((await saved(page)).markedCourseIds).not.toContain('00140866');
});

test('concurrent badge and faculty identity survive red highlighting',async({page})=>{
 await ready(page,'01040067');const id='root/f:01040022:concurrent';const card=node(page,id).locator('.course-node');
 await expect(card.locator('.relationship-chip.concurrent')).toHaveText('מקצוע צמוד');
 const accent=courseAppearance(courses.get('01040022')).accent;
 expect(await card.evaluate(el=>(el as HTMLElement).style.getPropertyValue('--faculty-accent'))).toBe(accent);
 await mark(page,id);await expect(card).toHaveClass(/user-marked/);await expect(card.locator('.relationship-chip.concurrent')).toBeVisible();await expect(card).toHaveCSS('border-color','rgb(198, 43, 61)');
 await page.reload();await expect(card).toHaveClass(/user-marked/);await mark(page,id);await expect(card).not.toHaveClass(/user-marked/);expect(await card.evaluate(el=>(el as HTMLElement).style.getPropertyValue('--faculty-accent'))).toBe(accent);
 const actual=await page.locator('.course-node').evaluateAll(nodes=>nodes.map(n=>({id:n.querySelector('.course-link')!.textContent!.trim(),color:(n as HTMLElement).style.getPropertyValue('--faculty-accent')})));
 for(const item of actual)expect(item.color).toBe(courseAppearance(courses.get(item.id)).accent);
});

for(const raw of ['{broken','{"version":999,"progress":{}}','null'])test(`invalid saved state remains usable: ${raw}`,async({page})=>{
 await seed(page,raw);await ready(page,'02340114');await mark(page);await expect(node(page).locator('.mark-button')).toHaveAttribute('aria-pressed','true');
});

test('partially obsolete state preserves valid marks and catalog selection',async({page})=>{
 await seed(page,JSON.stringify({version:1,progress:{rootId:'02340114',markedCourseIds:['02340114','99999999'],facultyIds:['cs','no-longer-exists'],catalogId:'cs-three-year-2025-2026',catalogYear:'2025-2026',filterTab:'catalog',expandedForward:['root','bad'],expandedBackward:[['root',['99999999']]],viewport:{x:null,y:0,zoom:99}}}));
 await ready(page,'02340114');await expect(node(page).locator('.mark-button')).toHaveAttribute('aria-pressed','true');await expect(page.locator('.active-filter-summary')).toContainText('2025-2026');
 await page.getByRole('button',{name:'הגדלת המפה',exact:true}).click();await expect.poll(async()=> (await saved(page))?.facultyIds).toEqual(['cs']);expect((await saved(page)).markedCourseIds).toEqual(['02340114']);
});

test('branch reset preserves marks, and destructive reset/clear controls require confirmation',async({page})=>{
 await ready(page);await mark(page);await page.getByRole('button',{name:'איפוס ענפים',exact:true}).click();await expect(node(page).locator('.mark-button')).toHaveAttribute('aria-pressed','true');
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'איפוס התקדמות שמורה',exact:true}).click();await expect(node(page).locator('.course-link')).toHaveText('02340247');
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'ניקוי סימונים',exact:true}).click();await expect(node(page).locator('.mark-button')).toHaveAttribute('aria-pressed','false');await expect(node(page).locator('.course-link')).toHaveText('02340247');
 await mark(page);page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'איפוס התקדמות שמורה',exact:true}).click();await expect(node(page).locator('.course-link')).toHaveText('02340114');await expect(page.locator('.marked-count')).toHaveText('קורסים מסומנים: 0');
 await page.reload();await expect(node(page).locator('.course-link')).toHaveText('02340114');await expect(node(page).locator('.mark-button')).toHaveAttribute('aria-pressed','false');
});

test('tabs synchronize exploration, markings and explicit saved-progress reset',async({page,context})=>{
 await ready(page,'02340218');await mark(page);const second=await context.newPage();await second.goto('/');await expect(node(second).locator('.course-link')).toHaveText('02340218');await expect(node(second).locator('.mark-button')).toHaveAttribute('aria-pressed','true');
 await mark(second);await expect(node(page).locator('.mark-button')).toHaveAttribute('aria-pressed','false');
 const search=second.getByRole('combobox');await search.fill('02340247');await second.getByRole('option').filter({hasText:'02340247'}).click();await expect(node(page).locator('.course-link')).toHaveText('02340247');
 second.once('dialog',dialog=>dialog.accept());await second.getByRole('button',{name:'איפוס התקדמות שמורה',exact:true}).click();await expect(node(page).locator('.course-link')).toHaveText('02340114');await second.close();
});

test('mobile footer, one-line credit and direct About refresh preserve exploration',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await ready(page,'02340218');await mark(page);
 const credit=page.getByText('Developed by Chupchick',{exact:true});await expect(credit).toBeVisible();await expect(credit).toHaveCSS('white-space','nowrap');
 const fits=await credit.evaluate(el=>({width:el.scrollWidth,client:el.clientWidth,height:el.getBoundingClientRect().height,line:parseFloat(getComputedStyle(el).lineHeight)}));expect(fits.width).toBeLessThanOrEqual(fits.client);expect(fits.height).toBeLessThanOrEqual(fits.line+1);
 await expect(page.locator('.site-disclaimer')).toHaveText('Course Tree is an independent student project and is not affiliated with or endorsed by the Technion. Always verify degree requirements using official sources.');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('mobile-marked-tree.png')});
 await page.getByRole('link',{name:'אודות / About',exact:true}).click();await expect(page).toHaveURL(/#\/about$/);await expect(page.getByText('idk seems kinda cool ill put something here later',{exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'אודות / About'})).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('mobile-about.png')});await page.getByRole('link',{name:'חזרה למפת הקורסים ←',exact:true}).click();await expect(node(page).locator('.course-link')).toHaveText('02340218');await expect(node(page).locator('.mark-button')).toHaveAttribute('aria-pressed','true');
});

test('unavailable local storage reports the limitation without breaking marking or expansion',async({page})=>{
 await page.addInitScript(key=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(name,value){if(name===key)throw new DOMException('Storage disabled','QuotaExceededError');return original.call(this,name,value);};},PROGRESS_KEY);
 await ready(page);await mark(page);await expect(node(page).locator('.mark-button')).toHaveAttribute('aria-pressed','true');await expect(page.locator('.local-save-status')).toHaveText('השמירה המקומית אינה זמינה כרגע');await node(page).locator('.expand-button').click();await expect(node(page).locator('.expand-button')).toHaveAttribute('aria-expanded','false');
});
test('panning coalesces storage writes instead of saving every pointer frame',async({page})=>{
 await page.addInitScript(key=>{const original=Storage.prototype.setItem;(window as any).progressWrites=0;Storage.prototype.setItem=function(name,value){if(name===key)(window as any).progressWrites++;return original.call(this,name,value);};},PROGRESS_KEY);
 await ready(page,'01040067');await page.waitForTimeout(1000);
 const before=await saved(page);const writes=await page.evaluate(()=>(window as any).progressWrites);
 const box=await page.locator('.graph-canvas').boundingBox();expect(box).not.toBeNull();
 await page.mouse.move(box!.x+35,box!.y+70);await page.mouse.down();await page.mouse.move(box!.x+135,box!.y+120,{steps:25});await page.mouse.up();
 await expect.poll(async()=> (await saved(page))?.viewport?.x).not.toBe(before.viewport.x);
 const delta=await page.evaluate(()=>(window as any).progressWrites)-writes;expect(delta).toBeGreaterThan(0);expect(delta).toBeLessThanOrEqual(2);
});
test('specialization, catalog browsing and all-course search persist while degree changes preserve markings',async({page})=>{
 await ready(page);await mark(page);await openFilters(page);await page.getByRole('tab',{name:/קטלוג תואר/}).click();
 await page.getByRole('textbox',{name:'חיפוש תואר'}).fill('סייבר');await page.locator('.catalog-option').click();
 await page.getByRole('combobox',{name:'פקולטת התואר',exact:true}).selectOption('cs');await page.getByRole('combobox',{name:'שנת קטלוג',exact:true}).selectOption('');await closeFilters(page);
 const search=page.getByRole('combobox',{name:'חיפוש קורס לפי מספר או שם'});await search.fill('01040031');await page.getByRole('button',{name:'חיפוש בכל הקורסים',exact:true}).click();await search.press('Escape');
 await expect.poll(async()=> (await saved(page))?.searchAll).toBe(true);await page.reload();await expect(node(page).locator('.mark-button')).toHaveAttribute('aria-pressed','true');await expect(page.locator('.active-filter-summary')).toContainText('סייבר');
 await openFilters(page);await expect(page.getByRole('combobox',{name:'שנת קטלוג',exact:true})).toHaveValue('');await expect(page.getByRole('combobox',{name:'פקולטת התואר',exact:true})).toHaveValue('cs');
 await page.getByRole('combobox',{name:'שנת קטלוג',exact:true}).selectOption('2025-2026');await page.getByRole('textbox',{name:'חיפוש תואר'}).fill('מסלול כללי תלת');await page.locator('.catalog-option').click();await closeFilters(page);await expect(node(page).locator('.mark-button')).toHaveAttribute('aria-pressed','true');
 await openFilters(page);await page.getByRole('textbox',{name:'חיפוש תואר'}).fill('סייבר');await page.locator('.catalog-option').click();await closeFilters(page);await expect(node(page).locator('.mark-button')).toHaveAttribute('aria-pressed','true');
 await search.fill('01040031');await expect(page.getByRole('button',{name:'חיפוש בכל הקורסים',exact:true})).toHaveAttribute('aria-pressed','true');
});
for(const viewport of [{width:320,height:568},{width:844,height:390}])test(`compact footer and existing graph note remain reachable at ${viewport.width}x${viewport.height}`,async({page})=>{
 await page.setViewportSize(viewport);await ready(page,'01040067');
 const geometry=await page.evaluate(()=>{const note=document.querySelector('.map-footnote')!.getBoundingClientRect();const footer=document.querySelector('.site-footer')!.getBoundingClientRect();return{noteBottom:note.bottom,footerTop:footer.top};});expect(geometry.noteBottom).toBeLessThanOrEqual(geometry.footerTop+1);
 await page.locator('.canvas-controls').scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'הגדלת המפה',exact:true})).toBeInViewport();
 await page.locator('.site-footer').scrollIntoViewIfNeeded();await expect(page.getByText('Developed by Chupchick',{exact:true})).toBeInViewport();await expect(page.locator('.site-disclaimer')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});