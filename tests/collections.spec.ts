import {expect,test as base,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {buildDependents} from '../src/lib/graph';
import {PROGRESS_KEY,PROGRESS_VERSION} from '../src/lib/progress';
const A='00140855',B='00140856',C='00140889',D='00140866',E='02340114';
const records=JSON.parse(readFileSync(new URL('../public/data/courses.json',import.meta.url),'utf8')).courses;
const dependents=buildDependents(records);
const many:string[]=records.filter((c:any)=>!dependents.has(c.id)&&![A,B,C,D,E].includes(c.id)).slice(0,20).map((c:any)=>c.id);
const test=base.extend<{errors:void}>({errors:[async({page},use)=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await use();expect(errors).toEqual([]);for(const cls of ['node','edge']){const ids=await page.locator('.react-flow__'+cls).evaluateAll(n=>n.map(x=>x.getAttribute('data-id')));expect(new Set(ids).size).toBe(ids.length);}},{auto:true}]});
const node=(page:Page,id:string)=>page.locator('.react-flow__node[data-id="'+id+'"]');
const saved=(page:Page)=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)??'{}').progress,PROGRESS_KEY);
async function ready(page:Page){await page.goto('/?course='+A);await expect(node(page,A).locator('.course-link')).toHaveText(A);}
async function search(page:Page){const input=page.getByRole('combobox',{name:'חיפוש קורס לפי מספר או שם',exact:true});if(!await input.isVisible())await page.getByRole('button',{name:'חיפוש קורסים',exact:true}).click();return input;}
async function add(page:Page,id:string){const input=await search(page);await input.fill(id);await page.getByRole('option').filter({hasText:id}).getByRole('button',{name:'הוסף לעץ '+id,exact:true}).click();await input.press('Escape');await expect(node(page,id).locator('.added-badge')).toBeVisible();}
async function addedMenu(page:Page){await page.mouse.move(0,0);const trigger=page.getByRole('button',{name:'קורסים שהוספתי',exact:true});await trigger.scrollIntoViewIfNeeded();await page.keyboard.press('Escape');await trigger.click();const menu=page.getByRole('dialog',{name:'קורסים שהוספתי',exact:true});await expect(menu).toBeVisible();return menu;}
async function markedMenu(page:Page){await page.mouse.move(0,0);const trigger=page.getByRole('button',{name:'רשימת מסומנים',exact:true});await trigger.scrollIntoViewIfNeeded();await page.keyboard.press('Escape');await trigger.click();const menu=page.getByRole('dialog',{name:'רשימת מסומנים',exact:true});await expect(menu).toBeVisible();return menu;}
async function mark(page:Page,id:string){const b=node(page,id).locator('.mark-button');await b.focus();await b.press('Enter');await expect(b).toHaveAttribute('aria-pressed','true');}
async function remove(page:Page,id:string){const menu=await addedMenu(page);await menu.getByRole('button',{name:'הסר מהעץ '+id,exact:true}).click();await page.keyboard.press('Escape');}

test('one add/remove system stays synchronized across search, cards and list beyond four courses',async({page})=>{
 await ready(page);for(const id of [B,C,D,E])await add(page,id);
 await expect.poll(async()=>(await saved(page))?.addedCourseIds).toEqual([A,B,C,D,E]);
 let menu=await addedMenu(page);await expect(menu.locator('[data-added-course]')).toHaveCount(5);await page.keyboard.press('Escape');
 await node(page,B).locator('.added-badge').focus();await node(page,B).locator('.added-badge').press('Enter');
 await expect(node(page,B)).toHaveCount(1);await expect(node(page,B).locator('.added-badge')).toHaveCount(0);
 const input=await search(page);await input.fill(B);await expect(page.getByRole('option').filter({hasText:B}).getByRole('button',{name:'הוסף לעץ '+B,exact:true})).toBeVisible();await input.press('Escape');
 await remove(page,C);await expect.poll(async()=>(await saved(page))?.addedCourseIds).toEqual([A,D,E]);
 await input.fill(E);const row=page.getByRole('option').filter({hasText:E});await row.getByRole('button',{name:'הסר מהעץ '+E,exact:true}).focus();await row.locator('.search-result-name').click();
 await expect(page.getByRole('listbox')).toHaveCount(0);await expect(input).toBeFocused();
 await expect.poll(async()=>(await saved(page))?.addedCourseIds).toEqual([E]);expect((await saved(page)).primaryCourseId).toBe(E);
});

test('marked and added collections stay independent and clear markings leaves additions intact',async({page})=>{
 await ready(page);await mark(page,B);await mark(page,C);await add(page,B);
 let menu=await markedMenu(page);await expect(menu.locator('[data-marked-course]')).toHaveCount(2);
 await menu.locator('[data-marked-course="'+C+'"]').getByRole('button',{name:'הוסף לעץ '+C,exact:true}).click();
 await expect(node(page,C).locator('.added-badge')).toBeVisible();
 await menu.locator('[data-marked-course="'+B+'"]').getByRole('button',{name:'הסר מהעץ '+B,exact:true}).click();
 await expect(node(page,B).locator('.mark-button')).toHaveAttribute('aria-pressed','true');
 await menu.locator('[data-marked-course="'+C+'"]').getByRole('button',{name:'הסרת סימון של '+C,exact:true}).click();
 await expect(node(page,C).locator('.added-badge')).toBeVisible();await page.keyboard.press('Escape');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'ניקוי סימונים',exact:true}).click();
 await expect.poll(async()=>(await saved(page))?.markedCourseIds).toEqual([]);expect((await saved(page)).addedCourseIds).toEqual([A,C]);
 menu=await markedMenu(page);await expect(menu.getByText('אין מקצועות מסומנים עדיין',{exact:true})).toBeVisible();
});

test('added-list locate restores a deliberately collapsed connector and keeps one shared node',async({page})=>{
 await ready(page);await add(page,D);await add(page,B);await remove(page,B);
 await expect(node(page,B)).toHaveCount(1);await expect(node(page,B).locator('.added-badge')).toHaveCount(0);
 const edge=page.locator('[data-connection="'+B+'->'+D+':strong"]');await edge.focus();await edge.press('Enter');await expect(edge).toHaveCount(0);await expect(node(page,D)).toHaveCount(1);
 const menu=await addedMenu(page);await menu.getByRole('button',{name:'מיקוד בקורס שהוספתי '+D,exact:true}).click();
 await expect(edge).toHaveCount(1);await expect(node(page,D)).toHaveCount(1);await expect(node(page,D).locator('.course-node')).toHaveClass(/is-focused/);
});

test('mobile collection menu stays compact and removing every addition preserves exploration and markings',async({page})=>{
 await page.setViewportSize({width:320,height:568});await ready(page);await add(page,B);await mark(page,A);
 let menu=await addedMenu(page);await expect(menu).toBeInViewport();await expect(menu).toHaveAttribute('dir','rtl');
 await menu.getByRole('button',{name:'הסר מהעץ '+B,exact:true}).click();await menu.getByRole('button',{name:'הסר מהעץ '+A,exact:true}).click();
 await expect(menu.getByText('עדיין לא הוספתם קורסים לעץ',{exact:true})).toBeVisible();await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'קורסים שהוספתי',exact:true})).toBeFocused();await expect(node(page,A)).toHaveCount(1);
 await expect.poll(async()=>(await saved(page))?.addedCourseIds).toEqual([]);await page.reload();await expect(node(page,A).locator('.mark-button')).toHaveAttribute('aria-pressed','true');
 expect((await saved(page)).addedCourseIds).toEqual([]);expect((await saved(page)).primaryCourseId).toBe(A);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('twenty additions have a searchable scrollable list, stable unique nodes and durable removal',async({page})=>{
 test.setTimeout(120_000);await ready(page);await mark(page,A);const start=Date.now();
 for(const id of many)await add(page,id);
 await expect.poll(async()=>(await saved(page))?.addedCourseIds.length).toBe(21);
 const menu=await addedMenu(page);await expect(menu.locator('[data-added-course]')).toHaveCount(21);
 expect(await menu.locator('.collection-rows').evaluate(e=>e.scrollHeight>e.clientHeight)).toBe(true);
 const input=menu.getByRole('textbox',{name:'חיפוש בקורסים שהוספתי',exact:true});await input.fill(many[19]);await expect(menu.locator('[data-added-course]')).toHaveCount(1);
 await menu.getByRole('button',{name:'הסר מהעץ '+many[19],exact:true}).click();await page.keyboard.press('Escape');
 await expect.poll(async()=>(await saved(page))?.addedCourseIds.length).toBe(20);await page.reload();await expect(node(page,A).locator('.course-link')).toHaveText(A);
 expect((await saved(page)).addedCourseIds).not.toContain(many[19]);expect((await saved(page)).markedCourseIds).toContain(A);
 console.log('20-course interaction check:',Date.now()-start,'ms');
});

test('real version4 pins migrate once into additions with partial reveals, filters and marks preserved',async({page})=>{
 await page.addInitScript(({key,A,B,C,D})=>{if(!sessionStorage.getItem('legacy-added-seed')){localStorage.setItem(key,JSON.stringify({version:4,progress:{pinnedRootIds:[A,B,C,D],expandedForward:[A],revealedForwardConnections:[B+'->'+D+':strong'],expandedBackward:[],hiddenForwardConnections:[A+'->'+C+':strong'],automaticConnections:[],markedCourseIds:[C],facultyIds:['civil'],catalogYear:'2025-2026'}}));sessionStorage.setItem('legacy-added-seed','yes');}},{key:PROGRESS_KEY,A,B,C,D});
 await ready(page);await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)??'{}').version,PROGRESS_KEY)).toBe(PROGRESS_VERSION);
 expect((await saved(page)).addedCourseIds).toEqual([A,B,C,D]);expect((await saved(page)).revealedForwardConnections).toContain(B+'->'+D+':strong');expect((await saved(page)).facultyIds).toEqual(['civil']);
 await remove(page,B);await page.reload();await expect(node(page,A)).toHaveCount(1);expect((await saved(page)).addedCourseIds).toEqual([A,C,D]);expect((await saved(page)).markedCourseIds).toContain(C);
 expect((await saved(page)).pinnedRootIds).toBeUndefined();
});


test('removing Algorithms 1 keeps its shared path for Computability and preserves existing layout',async({page})=>{
 const intro='02340114',algo='02340247',comp='02360343';await page.goto('/?course='+intro);await expect(node(page,intro).locator('.course-link')).toHaveText(intro);
 await add(page,algo);await add(page,comp);await mark(page,comp);
 const before=await node(page,algo).evaluate(e=>(e as HTMLElement).style.transform);
 await remove(page,algo);await expect(node(page,algo)).toHaveCount(1);await expect(node(page,algo).locator('.added-badge')).toHaveCount(0);
 expect(await node(page,algo).evaluate(e=>(e as HTMLElement).style.transform)).toBe(before);
 await expect(node(page,comp).locator('.mark-button')).toHaveAttribute('aria-pressed','true');
 await expect.poll(async()=>(await saved(page))?.addedCourseIds).toEqual([intro,comp]);
 await page.reload();await expect(node(page,algo)).toHaveCount(1);await expect(node(page,algo).locator('.added-badge')).toHaveCount(0);
 await remove(page,comp);await expect(node(page,algo)).toHaveCount(0);await expect(node(page,intro)).toHaveCount(1);
 expect((await saved(page)).markedCourseIds).toContain(comp);
});
