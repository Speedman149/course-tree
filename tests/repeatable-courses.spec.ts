import {expect, test as base, type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {CourseDataset} from '../src/types';
import {PROGRESS_KEY, PROGRESS_VERSION} from '../src/lib/progress';
import {openCollection, toolsTrigger} from './helpers/mobile-tools';
const TEAM='03940902', REG='00140855', BALL='03940803';
const node=(page:Page,id:string)=>page.locator(`.react-flow__node[data-id="${id}"]`);
const saved=(page:Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'{}').progress,PROGRESS_KEY);
const test=base.extend<{runtimeErrors:void}>({runtimeErrors:[async({page},use)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await use();expect(errors).toEqual([]);
 const ids=await page.locator('.react-flow__node').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-id')));expect(new Set(ids).size).toBe(ids.length);
},{auto:true}]});
async function ready(page:Page,width=1440,overrides:Record<string,unknown>={},version=PROGRESS_VERSION){
 await page.setViewportSize({width,height:width===320?568:900});
 await page.addInitScript(({key,version,TEAM,REG,BALL,overrides})=>{if(sessionStorage.getItem('repeat-seeded'))return;sessionStorage.setItem('repeat-seeded','yes');localStorage.setItem(key,JSON.stringify({version,progress:{primaryCourseId:TEAM,addedCourseIds:[TEAM,REG],expandedForward:[],facultyIds:null,catalogId:'',markedCourseIds:[TEAM,REG,BALL],highlightSatisfiedPrerequisites:true,viewport:{x:0,y:0,zoom:.5},...overrides}}));},{key:PROGRESS_KEY,version,TEAM,REG,BALL,overrides});
 await page.goto('/?course='+TEAM);await expect(node(page,TEAM)).toHaveCount(1);await page.evaluate(()=>document.fonts.ready);
}
for(const width of [1440,320])test(`repeat quantities update credits, clamp, persist and preserve graph/filter/addition state at ${width}px`,async({page},info)=>{
 test.setTimeout(60_000);await ready(page,width);
 const before=await saved(page),ids=await page.locator('.react-flow__node').evaluateAll(ns=>ns.map(n=>n.getAttribute('data-id')));
 let panel=await openCollection(page,'marked');const row=()=>panel.locator(`[data-marked-course="${TEAM}"]`);
 const plus=()=>row().getByRole('button',{name:'הוספת מופע של '+TEAM,exact:true}),minus=()=>row().getByRole('button',{name:'הפחתת מופע של '+TEAM,exact:true});
 await expect(panel.locator('.marked-credit-summary')).toHaveText('סה״כ נק״ז: 5.5');await expect(minus()).toBeDisabled();
 await expect(panel.locator(`[data-marked-course="${REG}"] .repetition-stepper`)).toHaveCount(0);await expect(panel.locator(`[data-marked-course="${BALL}"] .repetition-stepper`)).toHaveCount(1);
 await plus().click();await expect(row().getByRole('status')).toHaveText('2');await expect(panel.locator('.marked-credit-summary')).toHaveText('סה״כ נק״ז: 7');
 await minus().click();await expect(panel.locator('.marked-credit-summary')).toHaveText('סה״כ נק״ז: 5.5');
 for(let i=1;i<8;i++)await plus().click();await expect(plus()).toBeDisabled();await expect(row().getByRole('status')).toHaveText('8');
 await expect(row().locator('.repetition-limit')).toContainText('סוף הטווח המתועד');await expect(panel.locator('.marked-credit-summary')).toHaveText('סה״כ נק״ז: 16');
 await expect.poll(async()=>(await saved(page)).markedCourseQuantities).toEqual({[TEAM]:8});
 await page.screenshot({path:info.outputPath(`repetitions-${width}.png`),fullPage:true});
 await page.reload();panel=await openCollection(page,'marked');await expect(row().getByRole('status')).toHaveText('8');await expect(minus()).toBeEnabled();
 const after=await saved(page);for(const key of ['addedCourseIds','expandedForward','facultyIds','catalogId','highlightSatisfiedPrerequisites'])expect(after[key]).toEqual(before[key]);
 await page.keyboard.press('Escape');expect(await page.locator('.react-flow__node').evaluateAll(ns=>ns.map(n=>n.getAttribute('data-id')))).toEqual(ids);
 // A real faculty filter change leaves personal quantities intact, including hidden ball-games credit.
 await page.getByRole('button',{name:'פתיחת מסנני המפה'}).click();await page.getByRole('tab',{name:/סינון לפי פקולטה/}).click();await page.getByRole('button',{name:'ניקוי הכול',exact:true}).click();await page.getByRole('checkbox',{name:'מדעי המחשב',exact:true}).check();await page.getByRole('button',{name:'הצגת המפה',exact:true}).click();
 panel=await openCollection(page,'marked');await expect(panel.locator('.marked-credit-summary')).toHaveText('סה״כ נק״ז: 16');await expect(row().getByRole('status')).toHaveText('8');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await panel.getByRole('button',{name:'פתיחת עץ חדש עם '+REG,exact:true}).click();await expect(page).toHaveURL(new RegExp('course='+REG));
 panel=await openCollection(page,'marked');await expect(row().getByRole('status')).toHaveText('8');await expect(panel.locator('.marked-credit-summary')).toHaveText('סה״כ נק״ז: 16');
 await page.reload();panel=await openCollection(page,'marked');await expect(row().getByRole('status')).toHaveText('8');
});
for(const width of [1440,320])test(`graph removal confirms all repetitions, keeps additions, and re-mark/clear starts at one at ${width}px`,async({page})=>{
 await ready(page,width,{markedCourseQuantities:{[TEAM]:3}});
 const button=node(page,TEAM).locator('.mark-button');
 page.once('dialog',d=>d.dismiss());await button.focus();await button.press('Enter');await expect(button).toHaveAttribute('aria-pressed','true');expect((await saved(page)).markedCourseQuantities[TEAM]).toBe(3);
 page.once('dialog',d=>d.accept());await button.press('Enter');await expect(button).toHaveAttribute('aria-pressed','false');await expect.poll(async()=>(await saved(page)).markedCourseQuantities).toEqual({});expect((await saved(page)).addedCourseIds).toContain(TEAM);
 await button.press('Enter');let panel=await openCollection(page,'marked');await expect(panel.locator(`[data-marked-course="${TEAM}"] output`)).toHaveText('1');
 await panel.getByRole('button',{name:'הוספת מופע של '+TEAM,exact:true}).click();
 page.once('dialog',d=>d.dismiss());const remove=panel.getByRole('button',{name:'הסרת סימון של '+TEAM,exact:true});await remove.click();await expect(remove).toBeFocused();await expect(panel.locator(`[data-marked-course="${TEAM}"] output`)).toHaveText('2');
 page.once('dialog',d=>d.accept());await remove.click();await expect(panel.locator(`[data-marked-course="${TEAM}"]`)).toHaveCount(0);
 await page.keyboard.press('Escape');await button.focus();await button.press('Enter');panel=await openCollection(page,'marked');await panel.getByRole('button',{name:'הוספת מופע של '+TEAM,exact:true}).click();
 if(!await toolsTrigger(page).isVisible())await page.keyboard.press('Escape');page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'ניקוי סימונים',exact:true}).click();
 panel=await openCollection(page,'marked');await expect(panel.locator('.marked-credit-summary')).toHaveText('סה״כ נק״ז: 0');await expect.poll(async()=>(await saved(page)).markedCourseQuantities).toEqual({});expect((await saved(page)).addedCourseIds).toContain(TEAM);
});
test('old v5 session migrates to default one and persists v6 without losing its other state',async({page})=>{
 await ready(page,1440,{markedCourseQuantities:{[TEAM]:4},facultyIds:[],searchAll:true},5);
 const panel=await openCollection(page,'marked');await expect(panel.locator(`[data-marked-course="${TEAM}"] output`)).toHaveText('1');
 await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'{}').version,PROGRESS_KEY)).toBe(6);
 const state=await saved(page);expect(state.markedCourseIds).toEqual([TEAM,REG,BALL]);expect(state.markedCourseQuantities).toEqual({});expect(state.addedCourseIds).toEqual([TEAM,REG]);expect(state.facultyIds).toEqual([]);expect(state.searchAll).toBe(true);expect(state.highlightSatisfiedPrerequisites).toBe(true);
});
test('malformed/excessive saved quantities are bounded and cannot enable an ordinary course',async({page})=>{
 await ready(page,320,{markedCourseQuantities:{[TEAM]:100,[REG]:3,[BALL]:4,orphan:10}});
 const panel=await openCollection(page,'marked');await expect(panel.locator(`[data-marked-course="${TEAM}"] output`)).toHaveText('8');await expect(panel.locator('.repetition-stepper')).toHaveCount(2);await expect(panel.locator('.marked-credit-summary')).toHaveText('סה״כ נק״ז: 19');
 await panel.getByRole('button',{name:'הפחתת מופע של '+TEAM,exact:true}).click();await expect.poll(async()=>(await saved(page)).markedCourseQuantities).toEqual({[TEAM]:7,[BALL]:4});
});
test('quantity-only edits synchronize across tabs and storage reset clears counts',async({page,context})=>{
 await ready(page);const other=await context.newPage();await other.goto('/?course='+TEAM);await expect(node(other,TEAM)).toHaveCount(1);
 const panel=await openCollection(page,'marked');await panel.getByRole('button',{name:'הוספת מופע של '+TEAM,exact:true}).click();
 const otherPanel=await openCollection(other,'marked');await expect(otherPanel.locator(`[data-marked-course="${TEAM}"] output`)).toHaveText('2');await expect(node(other,TEAM).locator('.mark-button')).toHaveAttribute('aria-pressed','true');
 await other.evaluate(key=>localStorage.removeItem(key),PROGRESS_KEY);await expect(panel.locator('[data-marked-course]')).toHaveCount(0);await other.close();
});
for(const width of [641,1440])test(`desktop footer buttons remain compact, focusable and navigable at ${width}px`,async({page},info)=>{
 await ready(page,width);const footer=page.locator('.site-footer');const actions=footer.locator('.saved-progress-controls>button,.saved-progress-controls .collection-control>button');
 for(const button of await actions.all()){await expect(button).toHaveCSS('text-decoration-line','none');const box=await button.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(26);expect(box!.height).toBeLessThan(32);await button.focus();await expect(button).toBeFocused();}
 expect((await footer.boundingBox())!.height).toBeLessThan(110);await page.screenshot({path:info.outputPath(`desktop-footer-${width}.png`),fullPage:true});
 await footer.getByRole('link',{name:'אודות / About',exact:true}).click();await expect(page.getByRole('heading',{name:'אודות / About'})).toBeVisible();
});

test('narrow mobile repetition controls stay usable in a reduced keyboard-sized viewport',async({page},info)=>{
 await ready(page,320,{markedCourseQuantities:{[TEAM]:3}});let panel=await openCollection(page,'marked');
 await page.setViewportSize({width:320,height:340});
 const drawer=page.getByRole('dialog',{name:'כלים',exact:true});await expect(drawer).toBeInViewport();
 const plus=panel.getByRole('button',{name:'הוספת מופע של '+TEAM,exact:true});await plus.click();await expect(panel.locator(`[data-marked-course="${TEAM}"] output`)).toHaveText('4');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await panel.getByText('כללי הספירה ומקורות',{exact:true}).click();await expect(panel.getByRole('link',{name:'טבלת הכרה רשמית — עמוד 1'})).toHaveAttribute('href',/humanities.technion.ac.il/);
 await page.screenshot({path:info.outputPath('mobile-short-viewport.png'),fullPage:true});
 await page.keyboard.press('Escape');await expect(drawer).toHaveCount(0);expect((await saved(page)).markedCourseQuantities[TEAM]).toBe(4);
});

const existingSports=['03940800','03940801','03940802','03940803','03940804','03940805','03940806','03940807','03940808','03940820','03940900','03940902'];
for(const width of [1440,320])test(`all twelve existing sports courses share quantity controls, accurate totals and persistence at ${width}px`,async({page},info)=>{
 test.setTimeout(60_000);await ready(page,width,{markedCourseIds:[...existingSports,REG]});
 let panel=await openCollection(page,'marked');await expect(panel.locator('.repetition-stepper')).toHaveCount(12);await expect(panel.locator('[data-marked-course]')).toHaveCount(13);
 await expect(panel.locator('.marked-credit-summary')).toHaveText('סה״כ נק״ז: 15.5');
 for(const id of existingSports){
  const row=panel.locator(`[data-marked-course="${id}"]`);await row.getByRole('button',{name:'הוספת מופע של '+id,exact:true}).click();await expect(row.locator('output')).toHaveText('2');
 }
 await expect(panel.locator('.marked-credit-summary')).toHaveText('סה״כ נק״ז: 28');
 const quantities=Object.fromEntries(existingSports.map(id=>[id,2]));await expect.poll(async()=>(await saved(page)).markedCourseQuantities).toEqual(quantities);
 const ball=panel.locator(`[data-marked-course="${BALL}"]`);await ball.getByRole('button',{name:'הפחתת מופע של '+BALL,exact:true}).click();await expect(panel.locator('.marked-credit-summary')).toHaveText('סה״כ נק״ז: 27');
 await ball.getByRole('button',{name:'הוספת מופע של '+BALL,exact:true}).click();await expect(panel.locator('.marked-credit-summary')).toHaveText('סה״כ נק״ז: 28');
 await expect(panel.locator(`[data-marked-course="${REG}"] .repetition-stepper`)).toHaveCount(0);
 await page.screenshot({path:info.outputPath(`sports-whitelist-${width}.png`),fullPage:true});
 await page.reload();panel=await openCollection(page,'marked');await expect(panel.locator('.marked-credit-summary')).toHaveText('סה״כ נק״ז: 28');
 for(const id of existingSports)await expect(panel.locator(`[data-marked-course="${id}"] output`)).toHaveText('2');
 expect((await saved(page)).addedCourseIds).toEqual([TEAM,REG]);await page.keyboard.press('Escape');await expect(page.locator('.react-flow__node')).toHaveCount(2);
});
for(const width of [1440,320])test(`row and overall totals use updated database credits for sports and teams at ${width}px`,async({page})=>{
 const dataset=JSON.parse(readFileSync(new URL('../public/data/courses.json',import.meta.url),'utf8')) as CourseDataset;
 for(const c of dataset.courses){if(c.id===BALL)c.credits=2.25;if(c.id===TEAM)c.credits=1.75;}
 await page.route('**/data/courses.json',route=>route.fulfill({json:dataset}));await ready(page,width);
 let panel=await openCollection(page,'marked');await expect(panel.locator('.marked-credit-summary')).toHaveText('סה״כ נק״ז: 7');
 await panel.getByRole('button',{name:'הוספת מופע של '+BALL,exact:true}).click();await expect(panel.locator(`[data-marked-course="${BALL}"] .repetition-count strong`)).toHaveText('סה״כ מהקורס: 4.5 נק״ז');await expect(panel.locator('.marked-credit-summary')).toHaveText('סה״כ נק״ז: 9.25');
 await panel.getByRole('button',{name:'הוספת מופע של '+TEAM,exact:true}).click();await expect(panel.locator(`[data-marked-course="${TEAM}"] .repetition-count strong`)).toHaveText('סה״כ מהקורס: 3.5 נק״ז');await expect(panel.locator('.marked-credit-summary')).toHaveText('סה״כ נק״ז: 11');
 await page.reload();panel=await openCollection(page,'marked');await expect(panel.locator('.marked-credit-summary')).toHaveText('סה״כ נק״ז: 11');expect((await saved(page)).markedCourseQuantities).toEqual({[BALL]:2,[TEAM]:2});
});
test('a whitelisted course with missing credits keeps counts but reports an incomplete total',async({page})=>{
 const dataset=JSON.parse(readFileSync(new URL('../public/data/courses.json',import.meta.url),'utf8')) as CourseDataset;delete dataset.courses.find(c=>c.id===BALL)!.credits;
 await page.route('**/data/courses.json',route=>route.fulfill({json:dataset}));await ready(page,320);
 let panel=await openCollection(page,'marked');const row=panel.locator(`[data-marked-course="${BALL}"]`);
 for(let i=0;i<2;i++)await row.getByRole('button',{name:'הוספת מופע של '+BALL,exact:true}).click();await expect(row.locator('output')).toHaveText('3');await expect(row.locator('.repetition-count strong')).toHaveText('חסר נתון נק״ז לקורס');
 await expect(panel.locator('.marked-credit-summary')).toContainText('נק״ז ידוע: 4.5');await expect(panel.locator('.marked-credit-summary')).toContainText('ל־1 מקצועות חסר נתון נק״ז');
 await page.reload();panel=await openCollection(page,'marked');await expect(panel.locator(`[data-marked-course="${BALL}"] output`)).toHaveText('3');
});
