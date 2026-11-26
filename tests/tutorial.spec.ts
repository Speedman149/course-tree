import {expect,test as base,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {PROGRESS_KEY,PROGRESS_VERSION} from '../src/lib/progress';
import {settledViewport} from './helpers/mobile-tools';
const A='02340114',TEAM='03940902';
const catalogs=JSON.parse(readFileSync(new URL('../public/data/catalogs.json',import.meta.url),'utf8'));
const catalogId=catalogs.programs.find((p:any)=>p.facultyIds.includes('cs')&&p.catalogYear==='2025-2026'&&p.coverage.status!=='inventory-only')?.id??'';
const test=base.extend<{errors:void}>({errors:[async({page},use)=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await use();expect(errors).toEqual([]);},{auto:true}]});
const dialog=(page:Page)=>page.getByRole('dialog',{name:'איך משתמשים במפת הקורסים?',exact:true});
const help=(page:Page)=>page.getByRole('button',{name:'איך זה עובד?',exact:true});
async function ready(page:Page,width=1440){await page.setViewportSize({width,height:width===320?568:900});await page.goto('/');await expect(page.locator(`.react-flow__node[data-id="${A}"] .added-badge`)).toBeVisible();await settledViewport(page);await page.mouse.move(0,0);}
async function open(page:Page){await help(page).click();const guide=dialog(page);await expect(guide).toBeVisible();await expect(guide.getByRole('button',{name:'סגירה',exact:true})).toBeFocused();return guide;}
async function step(page:Page,index:number){const guide=dialog(page);await guide.locator('.tutorial-progress nav button').nth(index).click();await expect(guide.locator('.tutorial-progress nav button').nth(index)).toHaveAttribute('aria-current','step');return guide;}
async function snapshot(page:Page){return page.evaluate(key=>({stored:localStorage.getItem(key),keys:Object.keys(localStorage).sort(),nodes:[...document.querySelectorAll('.react-flow__node')].map(e=>[e.getAttribute('data-id'),e.querySelector('.course-node')?.getAttribute('data-marked')]).sort(),edges:[...document.querySelectorAll('.react-flow__edge')].map(e=>e.getAttribute('data-id')).sort(),transform:document.querySelector('.react-flow__viewport')?.getAttribute('style')}),PROGRESS_KEY);}
for(const width of [1440,390,320])test(`all seven visual steps stay readable, annotated and within the viewport at ${width}px`,async({page},info)=>{
 await ready(page,width);await expect(dialog(page)).toHaveCount(0);const guide=await open(page);
 for(let i=0;i<7;i++){
  await step(page,i);await expect(guide.locator('.tutorial-step-heading h3')).toBeVisible();await expect(guide.locator('.tutorial-topics button[aria-pressed="true"]')).toHaveCount(1);
  await expect.poll(()=>guide.locator('.tutorial-leader>path').getAttribute('d')).toBeTruthy();
  const layout=await guide.evaluate(el=>{const frame=el.getBoundingClientRect(),label=el.querySelector('.tutorial-callout')!.getBoundingClientRect(),target=el.querySelector('[data-tutorial-active]')!.getBoundingClientRect();return {width:el.scrollWidth<=el.clientWidth,inside:frame.left>=0&&frame.right<=innerWidth+1&&frame.top>=0&&frame.bottom<=innerHeight+1,overlap:label.left<target.right&&label.right>target.left&&label.top<target.bottom&&label.bottom>target.top,bodyOverflow:(el.querySelector('.tutorial-body') as HTMLElement).scrollWidth>(el.querySelector('.tutorial-body') as HTMLElement).clientWidth};});
  expect(layout).toEqual({width:true,inside:true,overlap:false,bodyOverflow:false});
  await expect(guide.getByRole('button',{name:'סגירה',exact:true})).toBeInViewport();await expect(guide.getByRole('button',{name:i===6?'הבנתי, בואו נתחיל!':'הבא',exact:true})).toBeInViewport();
  await page.screenshot({path:info.outputPath(`tutorial-${width}-step-${i+1}.png`),fullPage:true});
  await guide.locator('.tutorial-body').evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await expect(guide.getByRole('button',{name:i===6?'הבנתי, בואו נתחיל!':'הבא',exact:true})).toBeInViewport();
  if(width===320&&[2,3,6].includes(i))await page.screenshot({path:info.outputPath(`tutorial-${width}-step-${i+1}-bottom.png`),fullPage:true});
  // Every annotation, including deep controls, has its own measured target and readable callout.
  for(const topic of await guide.locator('.tutorial-topics button').all()){
   await topic.click();await expect(topic).toHaveAttribute('aria-pressed','true');
   await expect(guide.locator('[data-tutorial-active]')).toHaveCount(1);
   await expect.poll(()=>guide.locator('.tutorial-leader>path').getAttribute('d')).toBeTruthy();
   expect(await guide.evaluate(el=>{const a=el.querySelector('.tutorial-callout')!.getBoundingClientRect(),b=el.querySelector('[data-tutorial-active]')!.getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;})).toBe(false);
  }
 }
 await guide.getByRole('button',{name:'הבנתי, בואו נתחיל!',exact:true}).click();await expect(guide).toHaveCount(0);await expect(help(page)).toBeFocused();
});
for(const width of [1440,320])test(`practice branches collapse independently, retain a shared course and reopen at ${width}px`,async({page})=>{
 await ready(page,width);const before=await snapshot(page);await open(page);const guide=await step(page,1);const node=(id:string)=>guide.locator(`[data-demo-node="${id}"]`);
 await expect(node('d')).toHaveCount(1);await guide.getByRole('button',{name:'הסתרת החיבור a אל b בהדגמה',exact:true}).click();await expect(node('b')).toHaveCount(0);await expect(node('c')).toHaveCount(1);await expect(node('d')).toHaveCount(1);
 await guide.getByRole('button',{name:'החזרת החיבור ab בהדגמה',exact:true}).click();await expect(node('b')).toHaveCount(1);
 await guide.getByRole('button',{name:'הסתרת החיבור b אל d בהדגמה',exact:true}).click();await expect(node('d')).toHaveCount(1);
 await guide.getByRole('button',{name:'הסתרת החיבור c אל d בהדגמה',exact:true}).click();await expect(node('d')).toHaveCount(0);
 await guide.getByRole('button',{name:'החזרת החיבור bd בהדגמה',exact:true}).click();await expect(node('d')).toHaveCount(1);
 await guide.getByRole('button',{name:'סגירת ענפים של קורס א׳ בהדגמה',exact:true}).click();await expect(guide.locator('[data-demo-node]')).toHaveCount(1);
 await guide.getByRole('button',{name:'פתיחת ענפים של קורס א׳ בהדגמה',exact:true}).click();await expect(node('b')).toHaveCount(1);await expect(node('c')).toHaveCount(1);
 await page.keyboard.press('Escape');expect(await snapshot(page)).toEqual(before);
});
for(const width of [1440,320])test(`all practice interactions leave saved filters, marks, quantities, branches and viewport unchanged at ${width}px`,async({page})=>{
 await page.addInitScript(({key,version,catalogId,A,TEAM})=>{if(sessionStorage.getItem('tutorial-seed'))return;sessionStorage.setItem('tutorial-seed','yes');localStorage.setItem(key,JSON.stringify({version,progress:{addedCourseIds:[A],expandedForward:[A],hiddenForwardConnections:[A+'->02340124:strong'],expandedBackward:[],markedCourseIds:[A,TEAM],markedCourseQuantities:{[TEAM]:2},facultyIds:['cs'],catalogId,catalogYear:'2025-2026',highlightSatisfiedPrerequisites:false,viewport:{x:-100,y:80,zoom:.75}}}));},{key:PROGRESS_KEY,version:PROGRESS_VERSION,catalogId,A,TEAM});
 await ready(page,width);const before=await snapshot(page);await page.evaluate(key=>{(window as any).__tutorialWrites=0;const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)(window as any).__tutorialWrites++;return set.call(this,k,v);};},PROGRESS_KEY);
 const guide=await open(page);await guide.getByRole('button',{name:'סימון הקורס בהדגמה',exact:true}).click();await expect(guide.locator('.tutorial-course-card')).toHaveClass(/is-marked/);
 await step(page,2);const prerequisite=guide.locator('.tutorial-prerequisite-row button').first();await prerequisite.click();await prerequisite.click();await expect(guide.locator('.tutorial-backward-badge')).toBeVisible();
 await step(page,3);await guide.getByRole('button').filter({hasText:'אלגוריתמים 1'}).first().click();await expect(guide.locator('.tutorial-collection-demo header')).toContainText('(4)');await expect(guide.locator('[data-demo-node="algo"]')).toHaveCount(1);await guide.getByRole('button').filter({hasText:'אלגוריתמים 1'}).first().click();await expect(guide.locator('.tutorial-collection-demo header')).toContainText('(4)');
 await step(page,4);await guide.getByRole('switch').click();await expect(guide.locator('.tutorial-highlight-result')).toHaveClass(/is-satisfied/);await guide.getByRole('checkbox').first().uncheck();await expect(guide.locator('.tutorial-highlight-result')).not.toHaveClass(/is-satisfied/);await guide.locator('.tutorial-toolbar-demo').getByRole('button',{name:'עוד שכבה',exact:true}).click();await expect(guide.locator('.tutorial-extra-layer')).toBeVisible();await guide.locator('.tutorial-toolbar-demo').getByRole('button',{name:'איפוס ענפים',exact:true}).click();await expect(guide.locator('.tutorial-extra-layer')).toHaveCount(0);await expect(guide.getByRole('switch')).toHaveAttribute('aria-checked','true');
 await step(page,5);await guide.getByRole('checkbox').first().uncheck();await guide.getByRole('tab',{name:'קטלוג תואר',exact:true}).click();await guide.getByRole('combobox',{name:'קטלוג בהדגמה',exact:true}).selectOption('sample');await expect(guide.locator('.tutorial-catalog-groups')).toBeVisible();
 await step(page,6);await expect(guide.locator('.tutorial-credit-total')).toHaveText('סה״כ נק״ז: 7');await guide.getByRole('button',{name:'הגדלת כמות ספורט בהדגמה',exact:true}).click();await expect(guide.locator('.tutorial-credit-total')).toHaveText('סה״כ נק״ז: 8.5');await guide.getByRole('button',{name:'ניקוי סימונים',exact:true}).click();await expect(guide.locator('.tutorial-credit-total')).toHaveText('סה״כ נק״ז: 0');await guide.getByRole('button',{name:'איפוס התקדמות שמורה',exact:true}).click();
 await guide.getByRole('button',{name:'הבנתי, בואו נתחיל!',exact:true}).click();await expect(guide).toHaveCount(0);expect(await snapshot(page)).toEqual(before);expect(await page.evaluate(()=>(window as any).__tutorialWrites)).toBe(0);
 await page.reload();await settledViewport(page);await expect(dialog(page)).toHaveCount(0);expect(JSON.parse((await snapshot(page)).stored!).progress).toMatchObject(JSON.parse(before.stored!).progress);
});
test('close, Escape, backdrop and completion restore focus; reopening always starts at the first step',async({page})=>{
 await ready(page);for(const close of ['x','escape','backdrop','complete']){
  const guide=await open(page);await step(page,4);await guide.getByRole('button',{name:'הקודם',exact:true}).click();await expect(guide.locator('[data-tutorial-step="added"]')).toBeVisible();
  if(close==='x')await guide.getByRole('button',{name:'סגירה',exact:true}).click();
  if(close==='escape')await page.keyboard.press('Escape');
  if(close==='backdrop')await page.locator('.tutorial-overlay').click({position:{x:2,y:2}});
  if(close==='complete'){await step(page,6);await guide.getByRole('button',{name:'הבנתי, בואו נתחיל!',exact:true}).click();}
  await expect(guide).toHaveCount(0);await expect(help(page)).toBeFocused();const again=await open(page);await expect(again.locator('[data-tutorial-step="card"]')).toBeVisible();await page.keyboard.press('Escape');
 }
});
test('keyboard focus stays in the dialog and reduced motion is respected on a short mobile viewport',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await ready(page,320);await page.setViewportSize({width:568,height:320});const guide=await open(page);
 await page.keyboard.press('Shift+Tab');await expect(guide.getByRole('button',{name:'הבא',exact:true})).toBeFocused();await page.keyboard.press('Tab');await expect(guide.getByRole('button',{name:'סגירה',exact:true})).toBeFocused();
 expect(await guide.locator('.tutorial-progress nav span').first().evaluate(e=>getComputedStyle(e).transitionDuration)).toBe('0s');await step(page,3);await guide.getByRole('textbox',{name:'חיפוש קורס בהדגמה',exact:true}).fill('03940902');await expect(guide.getByRole('button',{name:'הבא',exact:true})).toBeInViewport();await page.locator('.tutorial-overlay').evaluate(el=>{(el as HTMLElement).style.setProperty('--tutorial-safe-top','44px');(el as HTMLElement).style.setProperty('--tutorial-safe-bottom','34px');});
 const safe=await guide.evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight};});expect(safe.top).toBeGreaterThanOrEqual(44);expect(safe.bottom).toBeLessThanOrEqual(safe.height-34);await expect(guide.getByRole('button',{name:'סגירה',exact:true})).toBeInViewport();await expect(guide.getByRole('button',{name:'הבא',exact:true})).toBeInViewport();
 await page.keyboard.press('Escape');await expect(guide).toHaveCount(0);
});
