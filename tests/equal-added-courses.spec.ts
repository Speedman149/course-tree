import {expect,test as base,type Page} from '@playwright/test';
import {PROGRESS_KEY,PROGRESS_VERSION} from '../src/lib/progress';
import {openCollection,toolsTrigger} from './helpers/mobile-tools';
const A='02340114',B='02340218',C='02340247',D='02340217',X='01040031',Y='01040032',U='00900001',TEAM='03940902';
const item=(id:string,parent?:string,faculty='הפקולטה למדעי המחשב')=>({id,name:id===A?'מבוא למדעי המחשב מ׳':'קורס בדיקה '+id,faculty,credits:id===TEAM?1:3,
 requirements:parent?{type:'course',courseId:parent,relation:'strong'}:null,requirementsStatus:parent?'known':'none',source:{url:'https://portalex.technion.ac.il/ovv/#/details/2026/200/SM/'+id}});
const data={meta:{latestTerm:'2026_200'},courses:[item(A),item(B,A),item(C,B),item(D,C),item(X,A,'הפקולטה למתמטיקה'),item(Y,X,'הפקולטה למתמטיקה'),item(U),item(TEAM,undefined,'המרכז לחינוך גופני וספורט')]};
const catalog={meta:{years:['2025-2026'],defaultYear:'2025-2026',notes:[]},sources:[],programs:[],referencedCourses:[]};
const test=base.extend<{fixture:void}>({fixture:[async({page},use)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.context().route('**/data/courses.json',r=>r.fulfill({json:data}));await page.context().route('**/data/catalogs.json',r=>r.fulfill({json:catalog}));
 await page.context().route('https://portalex.technion.ac.il/**',r=>r.fulfill({contentType:'text/html',body:'Official course link test'}));
 await use();expect(errors).toEqual([]);
 const ids=await page.locator('.react-flow__node').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-id')));expect(new Set(ids).size).toBe(ids.length);
},{auto:true}]});
const node=(page:Page,id:string)=>page.locator(`.react-flow__node[data-id="${id}"]`);
const saved=(page:Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'{}').progress,PROGRESS_KEY);
async function centered(page:Page,id:string){await expect.poll(async()=>{
 const canvas=await page.locator('.graph-canvas').boundingBox(),course=await node(page,id).boundingBox();
 return !canvas||!course?Infinity:Math.max(Math.abs(course.x+course.width/2-canvas.x-canvas.width/2),Math.abs(course.y+course.height/2-canvas.y-canvas.height/2));
}).toBeLessThan(3);}

async function search(page:Page){
 if(await toolsTrigger(page).isVisible()&&await page.getByRole('dialog',{name:'כלים',exact:true}).isVisible())await page.getByRole('button',{name:'סגירת הכלים',exact:true}).click();
 const input=page.getByRole('combobox',{name:'חיפוש קורס לפי מספר או שם',exact:true});
 if(!await input.isVisible())await page.getByRole('button',{name:'חיפוש קורסים',exact:true}).click();return input;
}
async function choose(page:Page,id:string){const input=await search(page);await input.fill(id);const option=page.getByRole('option').filter({hasText:id});await expect(option.locator('.search-result-add')).toHaveCount(0);await option.click();await expect(node(page,id).locator('.added-badge')).toBeVisible();}
async function fresh(page:Page,width:number){await page.setViewportSize({width,height:844});await page.goto('/');await expect(node(page,A).locator('.added-badge')).toBeVisible();}
for(const width of [1440,320]){
 test(`equal additions ${width}px: the default is ordinary, removable and an empty board survives refresh`,async({page})=>{
  await fresh(page,width);const list=await openCollection(page,'added');await expect(list.locator('[data-added-course]')).toHaveCount(1);
  await list.getByRole('button',{name:'הסר מהעץ '+A,exact:true}).click();await expect(page.locator('.react-flow__node')).toHaveCount(0);await expect(page.locator('.empty-graph-state')).toContainText('לא הוספתם קורסים עדיין');
  await expect.poll(async()=>(await saved(page))?.addedCourseIds).toEqual([]);await page.reload();await expect(page.locator('.empty-graph-state')).toBeVisible();await expect(page.locator('.react-flow__node')).toHaveCount(0);
  expect((await saved(page)).primaryCourseId).toBeUndefined();
 });
 test(`equal additions ${width}px: search adds, reuses paths, focuses duplicates and leaves external links independent`,async({page})=>{
  await fresh(page,width);const initialCount=await page.locator('.react-flow__node').count();await choose(page,B);await expect(page.locator('.react-flow__node')).toHaveCount(initialCount);
  await choose(page,D);await expect(node(page,C)).toHaveCount(1);await expect(node(page,Y)).toHaveCount(0);await choose(page,U);
  await expect.poll(async()=>(await saved(page))?.addedCourseIds).toEqual([A,B,D,U]);
  const ids=await page.locator('.react-flow__node').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-id')).sort());await choose(page,D);await expect(node(page,D).locator('.course-node')).toHaveClass(/is-focused/);
  expect(await page.locator('.react-flow__node').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-id')).sort())).toEqual(ids);
  const input=await search(page);await input.fill(C);const popup=page.waitForEvent('popup');await page.getByRole('option').filter({hasText:C}).locator('.search-result-number').click();const tab=await popup;await tab.waitForLoadState();await tab.close();
  expect((await saved(page)).addedCourseIds).toEqual([A,B,D,U]);await page.keyboard.press('Escape');
  const list=await openCollection(page,'added');await list.getByRole('button',{name:'הסר מהעץ '+A,exact:true}).click();await expect.poll(async()=>(await saved(page))?.addedCourseIds).toEqual([B,D,U]);
  for(const id of [B,D,U])await expect(node(page,id).locator('.added-badge')).toBeVisible();
  await expect(page.locator('.root-node')).toHaveCount(0);await expect(page.getByText('הקורס הנבחר',{exact:true})).toHaveCount(0);
 });
 test(`equal additions ${width}px: clear-all confirms and preserves v6 markings, quantities, filters and intentional emptiness`,async({page})=>{
  await page.setViewportSize({width,height:844});await page.addInitScript(({key,A,D,U,TEAM})=>{if(sessionStorage.getItem('equal-seed'))return;sessionStorage.setItem('equal-seed','yes');localStorage.setItem(key,JSON.stringify({version:6,progress:{primaryCourseId:A,addedCourseIds:[U,D],expandedForward:[A],hiddenForwardConnections:[],markedCourseIds:[A,TEAM],markedCourseQuantities:{[TEAM]:3},facultyIds:['cs'],catalogYear:'2025-2026'}}));},{key:PROGRESS_KEY,A,D,U,TEAM});
  await page.goto('/?course='+D);await expect(node(page,D).locator('.added-badge')).toBeVisible();await expect.poll(async()=>(await saved(page))?.addedCourseIds).toEqual([A,U,D]);
  let list=await openCollection(page,'added');page.once('dialog',d=>d.dismiss());await list.getByRole('button',{name:'הסרת כל הקורסים שהוספתי',exact:true}).click();expect((await saved(page)).addedCourseIds).toEqual([A,U,D]);
  page.once('dialog',d=>d.accept());await list.getByRole('button',{name:'הסרת כל הקורסים שהוספתי',exact:true}).click();await expect(page.locator('.react-flow__node')).toHaveCount(0);await expect.poll(async()=>(await saved(page))?.addedCourseIds).toEqual([]);
  let progress=await saved(page);expect(progress.markedCourseIds).toEqual([A,TEAM]);expect(progress.markedCourseQuantities).toEqual({[TEAM]:3});expect(progress.facultyIds).toEqual(['cs']);expect(progress.primaryCourseId).toBeUndefined();expect(new URL(page.url()).searchParams.has('course')).toBe(false);
  await page.reload();await expect(page.locator('.empty-graph-state')).toBeVisible();expect((await saved(page)).addedCourseIds).toEqual([]);
  await choose(page,C);await expect.poll(async()=>(await saved(page))?.addedCourseIds).toEqual([C]);await expect(node(page,A)).toHaveCount(0);progress=await saved(page);expect(progress.markedCourseQuantities).toEqual({[TEAM]:3});
 });
}
test('a different course deep link joins existing additions and refresh preserves the complete collection',async({page})=>{
 await page.addInitScript(({key,version,A,U,TEAM})=>{if(sessionStorage.getItem('equal-url-seed'))return;sessionStorage.setItem('equal-url-seed','yes');localStorage.setItem(key,JSON.stringify({version,progress:{addedCourseIds:[A,U],expandedForward:[A],markedCourseIds:[TEAM],markedCourseQuantities:{[TEAM]:2}}}));},{key:PROGRESS_KEY,version:PROGRESS_VERSION,A,U,TEAM});
 await page.goto('/?course='+D);await expect(node(page,D).locator('.course-node')).toHaveClass(/is-focused/);await centered(page,D);await expect.poll(async()=>(await saved(page))?.addedCourseIds).toEqual([A,U,D]);await expect(node(page,C)).toHaveCount(1);
 await page.reload();await expect(node(page,D)).toHaveCount(1);expect((await saved(page)).addedCourseIds).toEqual([A,U,D]);
 await page.goto('/?course='+U);await expect(node(page,U).locator('.course-node')).toHaveClass(/is-focused/);await centered(page,U);expect((await saved(page)).addedCourseIds).toEqual([A,U,D]);expect((await saved(page)).markedCourseQuantities).toEqual({[TEAM]:2});
});

test('clear-all in another tab removes a stale course link and keeps both boards empty after refresh',async({page,context})=>{
 await page.goto('/?course='+A);await expect(node(page,A).locator('.added-badge')).toBeVisible();await choose(page,U);
 const mark=node(page,A).locator('.mark-button');await mark.focus();await mark.press('Enter');await expect.poll(async()=>(await saved(page))?.markedCourseIds).toContain(A);
 const second=await context.newPage();await second.goto('/');await expect(node(second,U).locator('.added-badge')).toBeVisible();
 const list=await openCollection(second,'added');second.once('dialog',d=>d.accept());await list.getByRole('button',{name:'הסרת כל הקורסים שהוספתי',exact:true}).click();
 await expect(page.locator('.empty-graph-state')).toBeVisible();expect(new URL(page.url()).searchParams.has('course')).toBe(false);await page.reload();await expect(page.locator('.empty-graph-state')).toBeVisible();expect((await saved(page)).markedCourseIds).toContain(A);await second.close();
});
