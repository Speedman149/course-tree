import {expect,test as base,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {THEME_STORAGE_KEY} from '../src/lib/theme-bootstrap';
import {PROGRESS_KEY,PROGRESS_VERSION} from '../src/lib/progress';
import {settledViewport,openCollection,openTools,toolsPanel} from './helpers/mobile-tools';
import {courseAppearance} from '../src/lib/faculty-colors';
import {auditDark} from './helpers/theme';
const A='02340114',SPORT='03940902';
const records=JSON.parse(readFileSync(new URL('../public/data/courses.json',import.meta.url),'utf8')).courses;
const lightReference=JSON.parse(readFileSync(new URL('./fixtures/light-colors-before.json',import.meta.url),'utf8'));
const test=base.extend<{runtimeErrors:void}>({runtimeErrors:[async({page},use)=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await use();expect(errors).toEqual([]);},{auto:true}]});
const current=(page:Page)=>page.locator('html');
async function seed(page:Page,theme='dark',added=[A],marked=true){
 await page.addInitScript(({themeKey,key,version,theme,added,marked,A,SPORT})=>{
  if(sessionStorage.getItem('theme-test-seed'))return;sessionStorage.setItem('theme-test-seed','yes');localStorage.setItem(themeKey,theme);
  localStorage.setItem(key,JSON.stringify({version,progress:{addedCourseIds:added,expandedForward:[],expandedBackward:[],hiddenForwardConnections:[],markedCourseIds:marked?[A,SPORT]:[],markedCourseQuantities:marked?{[SPORT]:2}:{},facultyIds:null,highlightSatisfiedPrerequisites:false}}));
 },{themeKey:THEME_STORAGE_KEY,key:PROGRESS_KEY,version:PROGRESS_VERSION,theme,added,marked,A,SPORT});
}
async function ready(page:Page,width=1440){await page.setViewportSize({width,height:900});await page.goto('/');await expect(page.locator('.course-node').first()).toBeVisible();await settledViewport(page);await page.mouse.move(0,0);}
async function clean(page:Page,scope='body'){const audit=await auditDark(page,scope);expect(audit.bright,'bright panels: '+scope).toEqual([]);expect(audit.failures,'rendered text contrast: '+scope).toEqual([]);}
async function state(page:Page){return page.evaluate(key=>({saved:localStorage.getItem(key),nodes:[...document.querySelectorAll('.react-flow__node')].map(n=>[n.getAttribute('data-id'),n.querySelector('.course-node')?.getAttribute('data-marked')]).sort(),edges:[...document.querySelectorAll('.react-flow__edge')].map(e=>e.getAttribute('data-id')).sort(),viewport:document.querySelector('.react-flow__viewport')?.getAttribute('style')}),PROGRESS_KEY);}
for(const width of [1440,320]){
 test(`theme switching preserves graph/progress and survives refresh/navigation/reset at ${width}px`,async({page})=>{
  await seed(page,'light');await ready(page,width);const before=await state(page),box=await page.locator('.graph-canvas').boundingBox();
  await page.getByRole('button',{name:'מצב כהה',exact:true}).click();await expect(current(page)).toHaveAttribute('data-theme','dark');expect(await state(page)).toEqual(before);expect(await page.locator('.graph-canvas').boundingBox()).toEqual(box);
  await page.reload();await expect(current(page)).toHaveAttribute('data-theme','dark');await expect(page.locator('.course-node').first()).toBeVisible();await settledViewport(page);expect(JSON.parse((await state(page)).saved!).progress).toMatchObject(JSON.parse(before.saved!).progress);
  await page.goto('/about');await expect(page.getByRole('heading',{name:'אודות / About',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'מצב בהיר',exact:true})).toBeVisible();await page.getByRole('button',{name:'מצב בהיר',exact:true}).click();await expect(current(page)).toHaveAttribute('data-theme','light');
  await page.goto('/feedback');await expect(page.locator('#feedback-description')).toBeVisible();await expect(current(page)).toHaveAttribute('data-theme','light');await page.getByRole('button',{name:'מצב כהה',exact:true}).click();
  await page.goto('/');await expect(page.locator('.course-node').first()).toBeVisible();await settledViewport(page);if(width===320)await openTools(page);
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'איפוס התקדמות שמורה',exact:true}).click();expect(await page.evaluate(key=>localStorage.getItem(key),THEME_STORAGE_KEY)).toBe('dark');await expect(current(page)).toHaveAttribute('data-theme','dark');
 });
 test(`dark search, degree filters, backward portals and marked lists stay readable at ${width}px`,async({page},info)=>{
  test.setTimeout(60_000);await seed(page);await ready(page,width);await clean(page);
  const header=await page.locator('.app-header').evaluate(el=>{const brand=el.querySelector('.brand')!.getBoundingClientRect(),actions=el.querySelector('.header-actions')!.getBoundingClientRect();return brand.left>=actions.right;});expect(header,'header icons do not overlap the brand').toBe(true);
  if(width===320)await page.getByRole('button',{name:'חיפוש קורסים',exact:true}).click();await page.locator('.search-input:visible').fill('02340218');await expect(page.locator('.search-result').filter({hasText:'02340218'}).first()).toBeVisible();await clean(page,width===320?'.mobile-search-panel':'.search-dropdown');await page.screenshot({path:info.outputPath(`dark-search-${width}.png`),fullPage:true});await page.locator('.search-result').filter({hasText:'02340218'}).first().click();await settledViewport(page);
  const card=page.locator('.react-flow__node[data-id="02340218"] .course-node');await card.locator('.node-info').click();await expect(page.locator('.prerequisite-panel')).toBeVisible();await clean(page,'.prerequisite-panel');await page.locator('.prerequisite-panel .prerequisite-expand').first().click();await expect(page.locator('.backward-badge').first()).toBeVisible();expect(await page.locator('.react-flow__edge-path').evaluateAll(paths=>paths.every(path=>{const url=path.getAttribute('marker-end');if(!url)return false;const id=url.startsWith("url('#")?url.slice(6,-2):'';const marker=document.getElementById(id);return !!marker&&getComputedStyle(marker.firstElementChild!).fill===getComputedStyle(path).stroke;}))).toBe(true);await page.screenshot({path:info.outputPath(`dark-prerequisites-${width}.png`),fullPage:true});await page.keyboard.press('Escape');await page.mouse.move(0,0);
  await page.getByRole('button',{name:'פתיחת מסנני המפה',exact:true}).click();await clean(page,'.filter-panel');await page.getByRole('tab',{name:'קטלוג תואר',exact:true}).click();await expect(page.locator('.catalog-options')).toBeVisible();await clean(page,'.filter-panel');await page.screenshot({path:info.outputPath(`dark-catalog-${width}.png`),fullPage:true});await page.keyboard.press('Escape');
  await openCollection(page,'marked');const scope=width===320?'.mobile-tools-panel':'.course-collection-popover';await clean(page,scope);await expect(page.locator('.marked-credit-summary')).toContainText('7');await page.screenshot({path:info.outputPath(`dark-marked-${width}.png`),fullPage:true});
 });
 test(`all seven visual tutorial pages support the dark palette and contrast at ${width}px`,async({page},info)=>{
  test.setTimeout(60_000);await seed(page);await ready(page,width);const before=await state(page);await page.getByRole('button',{name:'איך זה עובד?',exact:true}).click();const guide=page.locator('.help-modal');
  for(let i=0;i<7;i++){await guide.locator('.tutorial-progress nav button').nth(i).click();await clean(page,'.help-modal');await page.screenshot({path:info.outputPath(`dark-tutorial-${width}-${i+1}.png`),fullPage:true});await guide.locator('.tutorial-body').evaluate(el=>{el.scrollTop=el.scrollHeight;});await clean(page,'.help-modal');
   if(i===0)await guide.getByRole('button',{name:'סימון הקורס בהדגמה',exact:true}).click();
   if(i===1)await guide.getByRole('button',{name:'הסתרת החיבור a אל b בהדגמה',exact:true}).click();
   if(i===3)await guide.getByRole('button',{name:'הסרת כל הקורסים',exact:true}).click();
   if(i===4)await guide.getByRole('switch').click();
   if(i===5){await guide.getByRole('tab',{name:'קטלוג תואר',exact:true}).click();await guide.getByRole('combobox',{name:'קטלוג בהדגמה',exact:true}).selectOption('sample');}
   if(i===6){await guide.getByRole('button',{name:'הגדלת כמות ספורט בהדגמה',exact:true}).click();await guide.getByRole('button',{name:'ניקוי סימונים',exact:true}).click();}
   await clean(page,'.help-modal');await page.screenshot({path:info.outputPath(`dark-tutorial-active-${width}-${i+1}.png`),fullPage:true});
  }
  await guide.getByRole('button',{name:'הבנתי, בואו נתחיל!',exact:true}).click();expect(await state(page)).toEqual(before);
 });
 test(`dark About, feedback validation, loading and success states at ${width}px`,async({page},info)=>{
  await seed(page);await page.setViewportSize({width,height:900});await page.goto('/about');await expect(page.getByRole('heading',{name:'אודות / About',exact:true})).toBeVisible();await clean(page);await page.screenshot({path:info.outputPath(`dark-about-${width}.png`),fullPage:true});
  await page.goto('/feedback');await expect(page.locator('#feedback-description')).toBeVisible();await clean(page);await page.getByRole('button',{name:'שליחת משוב',exact:true}).click();await expect(page.locator('.feedback-field-error').first()).toBeVisible();await clean(page);
  await page.locator('#feedback-category').selectOption('bug');await page.locator('#feedback-description').fill('בדיקת מראה מצב כהה לטופס המשוב בלבד');let attempt=0,release!:()=>void;const gate=new Promise<void>(r=>release=r);await page.route('**/api/feedback',async route=>{if(attempt++===0){await gate;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,errors:[{code:'DELIVERY_FAILED'}]})});}else await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true})});});
  try{await page.getByRole('button',{name:'שליחת משוב',exact:true}).click();await expect(page.locator('.feedback-submit')).toBeDisabled();await clean(page);}finally{release();}
  await expect(page.locator('.feedback-error-summary')).toBeVisible();await clean(page);await page.screenshot({path:info.outputPath(`dark-feedback-error-${width}.png`),fullPage:true});await page.getByRole('button',{name:'שליחת משוב',exact:true}).click();await expect(page.locator('.feedback-success')).toBeVisible();await clean(page);await page.screenshot({path:info.outputPath(`dark-feedback-success-${width}.png`),fullPage:true});
 });
 test(`original light colors remain unchanged and round trips do not leak dark tokens at ${width}px`,async({page})=>{
  await seed(page,'light',[A],false);await ready(page,width);
  for(const route of ['tree','about','feedback']){if(route!=='tree'){await page.goto('/'+route);await expect(page.locator(route==='about'?'.about-content':'#feedback-description')).toBeVisible();}
   const expected=lightReference[width+'-'+route];const actual=await page.evaluate(reference=>Object.fromEntries(Object.entries(reference).map(([selector,props])=>{const el=document.querySelector(selector)!;const s=getComputedStyle(el);return[selector,Object.fromEntries(Object.keys(props as object).map(k=>[k,(s as any)[k]]))];})),expected);expect(actual).toEqual(expected);
   await page.getByRole('button',{name:'מצב כהה',exact:true}).click();await page.getByRole('button',{name:'מצב בהיר',exact:true}).click();await expect(current(page)).toHaveAttribute('data-theme','light');
  }
 });
}
for(const [mode,width] of [['production',1440],['production',320],['development',390]] as const)test(`${mode}: system dark is applied before first paint and before React at ${width}px`,async({page,baseURL},info)=>{
 await page.emulateMedia({colorScheme:'dark'});await page.setViewportSize({width,height:844});await page.addInitScript(()=>{(window as any).__themePaint=[];new PerformanceObserver(list=>{if(list.getEntries().some(e=>e.name==='first-contentful-paint'))(window as any).__themePaint.push({theme:document.documentElement.dataset.theme,background:getComputedStyle(document.documentElement).backgroundColor});}).observe({type:'paint',buffered:true});});
 let release!:()=>void;const gate=new Promise<void>(r=>release=r);await page.route('**/*',async route=>{if(route.request().resourceType()==='script')await gate;await route.continue();});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:120,downloadThroughput:250_000,uploadThroughput:100_000,connectionType:'cellular3g'});
 try{await page.goto((mode==='development'?(process.env.PLAYWRIGHT_DEV_BASE_URL??'http://127.0.0.1:5174'):baseURL!)+'/',{waitUntil:'commit'});await expect(page.locator('.initial-explorer-shell')).toBeVisible();await expect(current(page)).toHaveAttribute('data-theme','dark');await expect(current(page)).toHaveCSS('background-color','rgb(23, 25, 34)');await expect.poll(()=>page.evaluate(()=>(window as any).__themePaint.length)).toBeGreaterThan(0);expect(await page.evaluate(()=>(window as any).__themePaint[0])).toEqual({theme:'dark',background:'rgb(23, 25, 34)'});await page.screenshot({path:info.outputPath(`dark-first-paint-${mode}-${width}.png`),fullPage:true});
  await page.getByRole('button',{name:'מצב בהיר',exact:true}).click();await expect(current(page)).toHaveAttribute('data-theme','light');expect(await page.evaluate(key=>localStorage.getItem(key),THEME_STORAGE_KEY)).toBe('light');
 }finally{await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});release();}
 await expect(page.locator('.course-node').first()).toBeVisible();await expect(current(page)).toHaveAttribute('data-theme','light');
});
test('system changes and cross-tab explicit preferences synchronize independently of course progress',async({page,context})=>{
 await page.emulateMedia({colorScheme:'light'});await ready(page);await expect(current(page)).toHaveAttribute('data-theme','light');await page.emulateMedia({colorScheme:'dark'});await expect(current(page)).toHaveAttribute('data-theme','dark');await page.getByRole('button',{name:'מצב בהיר',exact:true}).click();await page.emulateMedia({colorScheme:'dark'});await expect(current(page)).toHaveAttribute('data-theme','light');
 const second=await context.newPage();await second.goto('/');await expect(current(second)).toHaveAttribute('data-theme','light');await second.getByRole('button',{name:'מצב כהה',exact:true}).click();await expect(current(page)).toHaveAttribute('data-theme','dark');await second.close();
});
test('all twelve faculty identities, marked red, graph paths and arrowheads retain contrast',async({page},info)=>{
 const ids=['civil','cs','architecture','ee','data','humanities','mechanical','math','aerospace','medicine','physics','chemistry'];
 const all=ids.map(id=>records.find((c:any)=>c.id!==A&&courseAppearance(c).id===id)?.id);expect(all.every(Boolean)).toBe(true);await seed(page,'dark',[A,...all]);await ready(page);await clean(page);
 const card=page.locator('.react-flow__node[data-id="'+A+'"] .course-node');await expect(card).toHaveAttribute('data-marked','true');
 const colors:string[]=[];for(const id of ids){const node=page.locator(`.course-node[data-faculty="${id}"][data-marked="false"]`).first();await expect(node).toHaveCount(1);colors.push(await node.evaluate(el=>getComputedStyle(el).borderTopColor));}expect(new Set(colors).size).toBe(12);
 await page.screenshot({path:info.outputPath('dark-faculty-board.png'),fullPage:true});
});
test('theme control remains usable when browser storage is unavailable',async({page})=>{
 await page.emulateMedia({colorScheme:'dark'});await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});});await page.goto('/');await expect(current(page)).toHaveAttribute('data-theme','dark');await expect(page.locator('.course-node').first()).toBeVisible();await page.getByRole('button',{name:'מצב בהיר',exact:true}).click();await expect(current(page)).toHaveAttribute('data-theme','light');
});

test('dark positive prerequisite highlighting, red markings and concurrent badges stay distinct',async({page},info)=>{
 await seed(page,'dark',['00140855','01040067']);await page.addInitScript(key=>{if(sessionStorage.getItem('dark-relations'))return;sessionStorage.setItem('dark-relations','yes');const saved=JSON.parse(localStorage.getItem(key)!);saved.progress.expandedForward=['00140855','01040067'];saved.progress.markedCourseIds=['00140843'];saved.progress.markedCourseQuantities={};localStorage.setItem(key,JSON.stringify(saved));},PROGRESS_KEY);await ready(page);
 const card=(id:string)=>page.locator(`.react-flow__node[data-id="${id}"] .course-node`);await expect(card('01040022')).toHaveClass(/concurrent/);await expect(card('01040022').locator('.relationship-chip.concurrent')).toHaveText('מקצוע צמוד');
 await page.getByRole('switch').click();await expect(card('00140889')).toHaveClass(/prerequisites-satisfied/);await card('00140855').locator('.mark-button').focus();await page.keyboard.press('Enter');await expect(card('00140856')).toHaveClass(/prerequisites-satisfied/);await card('00140856').locator('.mark-button').focus();await page.keyboard.press('Enter');await expect(card('00140856')).toHaveClass(/user-marked/);await expect(card('00140856')).not.toHaveClass(/prerequisites-satisfied/);await expect(card('00140856')).toHaveCSS('border-top-color','rgb(255, 130, 156)');
 await page.getByRole('button',{name:'התאמת המפה למסך',exact:true}).click();await settledViewport(page);await page.mouse.move(0,0);await clean(page);await page.screenshot({path:info.outputPath('dark-relationship-states.png'),fullPage:true});
});
