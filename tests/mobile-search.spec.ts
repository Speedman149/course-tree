import {settledViewport} from './helpers/mobile-tools';
import {expect as baseExpect,test as base,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {PROGRESS_KEY} from '../src/lib/progress';
// Keep the Windows/WSL startup allowances scoped to this UI suite.
const expect=baseExpect.configure({timeout:25_000});
const before=JSON.parse(readFileSync(new URL('./fixtures/mobile-search-before.json',import.meta.url),'utf8'));
const test=base.extend<{runtimeErrors:void}>({runtimeErrors:[async({page},use)=>{const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await use();expect(errors).toEqual([]);},{auto:true}]});
test.setTimeout(90_000);
const toggle=(page:Page)=>page.getByRole('button',{name:'חיפוש קורסים',exact:true});
const panel=(page:Page)=>page.getByRole('dialog',{name:'חיפוש קורסים',exact:true});
const input=(page:Page)=>panel(page).getByRole('combobox',{name:'חיפוש קורס לפי מספר או שם',exact:true});
const close=(page:Page)=>page.getByRole('button',{name:'סגירת חיפוש הקורסים',exact:true});
const root=(page:Page)=>page.locator('.course-node.is-added .course-link');
const saved=(page:Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'{}').progress,PROGRESS_KEY);
async function ready(page:Page,course='02340247'){await page.goto(`/?course=${course}`,{waitUntil:'domcontentloaded'});await expect(root(page)).toHaveText(course);await expect(toggle(page)).toBeEnabled();await page.evaluate(()=>document.fonts.ready);}
async function seeded(page:Page){await page.addInitScript(key=>{if(!sessionStorage.getItem('mobile-search-seed')){localStorage.setItem(key,JSON.stringify({version:2,progress:{rootId:'00140855',expandedForward:['root','root/f:00140889:strong'],expandedBackward:[],hiddenForwardConnections:['root/f:00140856:strong'],markedCourseIds:['00140866'],facultyIds:['civil'],catalogId:'mapping-3-mapping-2025-2026',catalogYear:'2025-2026',catalogFaculty:'civil',filterTab:'catalog',searchAll:false,recent:[],viewport:{x:-100,y:90,zoom:.7}}}));sessionStorage.setItem('mobile-search-seed','yes');}},PROGRESS_KEY);await ready(page,'00140855');await expect.poll(async()=>(await saved(page))?.searchAll).toBe(false);await expect.poll(async()=>page.locator('.react-flow__viewport').evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).a)).toBe(.7);await settledViewport(page);}
async function contained(page:Page,bottom:number){const box=await panel(page).boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(await page.evaluate(()=>innerWidth));expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(bottom+.5);await expect(close(page)).toBeInViewport();}

for(const width of [390,320])test(`mobile defaults to only the search icon with no reserved search row at ${width}px`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});await ready(page);await expect(toggle(page)).toBeInViewport();await expect(toggle(page)).toHaveAttribute('aria-expanded','false');await expect(page.getByRole('combobox')).toHaveCount(0);await expect(panel(page)).toHaveCount(0);
 const header=await page.locator('.app-header').boundingBox();const graph=await page.locator('.graph-canvas').boundingBox();expect(header!.height).toBe(65);await expect(page.locator('.added-courses')).toHaveCount(0);
 // Collapsed search adds no row: the canvas follows the current responsive toolbar.
 const toolbar=await page.locator('.map-toolbar').boundingBox();
 expect(graph!.height-before[width]['.graph-canvas'].height).toBeGreaterThan(0);expect(graph!.y).toBeCloseTo(toolbar!.y+toolbar!.height,1);
 for(const key of ['x','width'] as const)expect(graph![key],`mobile graph.${key}`).toBeCloseTo(before[width]['.graph-canvas'][key],1);
 const icon=await toggle(page).boundingBox();const controls=await page.locator('.canvas-controls').boundingBox();expect(icon!.width).toBeGreaterThanOrEqual(40);expect(icon!.x).toBeGreaterThanOrEqual(graph!.x);expect(icon!.y+icon!.height).toBeLessThan(controls!.y);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`collapsed-${width}.png`),fullPage:true});
});

test('opening and closing the RTL overlay preserves branches, filters, red marks, layout and saved progress',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await seeded(page);const progress=await saved(page);const transform=await page.locator('.react-flow__viewport').getAttribute('style');const graph=await page.locator('.graph-canvas').boundingBox();const ids=await page.locator('.react-flow__node').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-id')));
 await toggle(page).click();await expect(panel(page)).toBeVisible();await expect(input(page)).toBeFocused();await expect(panel(page)).toHaveAttribute('dir','rtl');await contained(page,844);await input(page).fill('001408');await page.screenshot({path:testInfo.outputPath('search-open-390.png')});await close(page).click();
 await expect(panel(page)).toHaveCount(0);await expect(toggle(page)).toBeFocused();expect(await page.locator('.graph-canvas').boundingBox()).toEqual(graph);expect(await page.locator('.react-flow__viewport').getAttribute('style')).toEqual(transform);expect(await page.locator('.react-flow__node').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-id')))).toEqual(ids);expect(await saved(page)).toEqual(progress);await expect(page.locator('.user-marked .course-link')).toHaveText('00140866');
});

test('legacy and Hebrew search add or focus equal courses and close the mobile panel',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page);await toggle(page).click();await input(page).fill('234114');await panel(page).getByRole('option').filter({hasText:'02340114'}).click();await expect(page.locator('.react-flow__node[data-id="02340114"] .added-badge')).toBeVisible();await expect(panel(page)).toHaveCount(0);await expect(page.locator('.course-node.is-added')).toHaveCount(2);
 await toggle(page).click();await input(page).fill('אלגוריתמים 1');await input(page).press('Enter');await expect(page.locator('.react-flow__node[data-id="02340247"] .course-node')).toHaveClass(/is-focused/);await expect(page.locator('.course-node.is-added')).toHaveCount(2);await expect(panel(page)).toHaveCount(0);
});

test('existing clear control works, Escape closes, and an outside zoom click still reaches the graph',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page);await toggle(page).click();await input(page).fill('234114');await panel(page).getByRole('button',{name:'ניקוי החיפוש',exact:true}).click();await expect(input(page)).toHaveValue('');await expect(input(page)).toBeFocused();await input(page).press('Escape');await expect(panel(page)).toHaveCount(0);
 const zoom=await page.locator('.canvas-controls>span').textContent();await toggle(page).click();await page.getByRole('button',{name:'הגדלת המפה',exact:true}).click();await expect(panel(page)).toHaveCount(0);await expect(page.locator('.canvas-controls>span')).not.toHaveText(zoom!);await expect(root(page)).toHaveText('02340247');
});

test('the existing all-course search scope remains usable without changing active filters',async({page})=>{
 await page.setViewportSize({width:320,height:568});await seeded(page);const progress=await saved(page);await toggle(page).click();await input(page).fill('02340247');await expect(panel(page).getByText('לא נמצאו קורסים',{exact:true})).toBeVisible();const scope=panel(page).getByRole('button',{name:'חיפוש בכל הקורסים',exact:true});await scope.click();await expect(scope).toHaveAttribute('aria-pressed','true');await expect(panel(page).getByRole('option').filter({hasText:'02340247'})).toBeVisible();await close(page).click();await expect.poll(async()=>(await saved(page))?.searchAll).toBe(true);const after=await saved(page);expect(after.facultyIds).toEqual(progress.facultyIds);expect(after.catalogId).toBe(progress.catalogId);expect(after.expandedForward).toEqual(progress.expandedForward);expect(after.addedCourseIds).toEqual(progress.addedCourseIds);
});

test('the panel follows a keyboard-sized visual viewport and keeps the input and close button accessible',async({page},testInfo)=>{
 await page.setViewportSize({width:320,height:568});await page.addInitScript(()=>{const viewport=Object.assign(new EventTarget(),{width:innerWidth,height:innerHeight,offsetTop:0,offsetLeft:0,pageTop:0,pageLeft:0,scale:1});Object.defineProperty(window,'visualViewport',{configurable:true,value:viewport});(window as any).searchTestViewport=viewport;});await seeded(page);await toggle(page).click();await input(page).fill('0014');
 await page.evaluate(()=>{const viewport=(window as any).searchTestViewport;viewport.height=280;viewport.dispatchEvent(new Event('resize'));});await contained(page,280);await expect(input(page)).toBeInViewport();expect(await input(page).evaluate(el=>getComputedStyle(el).fontSize)).toBe('16px');await expect.poll(async()=>panel(page).locator('.search-results').evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
 await page.evaluate(()=>{const viewport=(window as any).searchTestViewport;viewport.offsetTop=30;viewport.height=270;viewport.dispatchEvent(new Event('scroll'));});await contained(page,300);await page.screenshot({path:testInfo.outputPath('keyboard-viewport-320.png')});await close(page).click();await expect(panel(page)).toHaveCount(0);await expect(root(page)).toHaveText('00140855');
});

test('resizing restores desktop search and returns to collapsed mobile without changing the root',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/?course=02340247');await expect(root(page)).toHaveText('02340247');const desktop=page.locator('.desktop-course-search .search-input');await desktop.fill('234114');await page.setViewportSize({width:640,height:844});await expect(desktop).toBeHidden();await expect(toggle(page)).toHaveAttribute('aria-expanded','false');await toggle(page).click();await input(page).fill('אלגוריתמים');await page.setViewportSize({width:641,height:1000});await expect(panel(page)).toHaveCount(0);await expect(desktop).toBeVisible();await expect(desktop).toHaveValue('234114');await expect(toggle(page)).toBeHidden();await page.setViewportSize({width:390,height:844});await expect(toggle(page)).toHaveAttribute('aria-expanded','false');await expect(root(page)).toHaveText('02340247');
});

for(const width of [1440,641])test(`desktop header accommodates the theme control and preserves search and graph geometry at ${width}px`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});await page.goto('/?course=02340247');await expect(root(page)).toHaveText('02340247');await page.evaluate(()=>document.fonts.ready);await expect(page.getByRole('combobox',{name:'חיפוש קורס לפי מספר או שם',exact:true})).toBeVisible();await expect(toggle(page)).toBeHidden();
 // The new 33px theme button and 6px icon gap intentionally occupy one header slot.
 const theme=await page.locator('.app-header .theme-toggle').boundingBox();expect(theme!.width).toBe(33);expect(await page.locator('.header-icon-actions').evaluate(el=>getComputedStyle(el).columnGap)).toBe('6px');const themeSlot=39;
 for(const selector of ['.app-header','.brand','.header-actions','.search-container']){
  const expected={...before[width][selector]};
  if(selector==='.header-actions')expected.width+=themeSlot;
  if(selector==='.search-container'&&width===641){expected.width-=themeSlot;expected.x+=themeSlot;}
  const box=await page.locator(selector).boundingBox();for(const key of ['x','y','width','height'] as const)expect(box![key],`${selector}.${key}`).toBeCloseTo(expected[key],1);
 }
 // Brand/header height and graph geometry remain exact; only the intentional theme slot is budgeted.
 const graph=await page.locator('.graph-canvas').boundingBox();const footer=await page.locator('.site-footer').boundingBox();
 for(const key of ['x','width'] as const)expect(graph![key],`desktop graph.${key}`).toBeCloseTo(before[width]['.graph-canvas'][key],1);
 expect(graph!.y).toBeCloseTo(before[width]['.graph-canvas'].y,1);expect(graph!.height).toBeLessThanOrEqual(before[width]['.graph-canvas'].height);
 expect(graph!.height).toBeGreaterThanOrEqual(before[width]['.graph-canvas'].height-footer!.height);expect(graph!.y+graph!.height).toBeLessThanOrEqual(footer!.y);
 await page.getByRole('combobox',{name:'חיפוש קורס לפי מספר או שם',exact:true}).fill('234114');await expect(page.getByRole('option').filter({hasText:'02340114'})).toBeVisible();await page.locator('.app-header').screenshot({path:testInfo.outputPath(`desktop-${width}.png`)});
});

test('refresh closes transient mobile search while restoring the existing graph progress',async({page})=>{
 await page.setViewportSize({width:390,height:844});await seeded(page);const progress=await saved(page);await toggle(page).click();await input(page).fill('001408');await page.reload();await expect(toggle(page)).toHaveAttribute('aria-expanded','false');await expect(root(page)).toHaveText('00140855');await expect(panel(page)).toHaveCount(0);await expect(page.locator('.user-marked .course-link')).toHaveText('00140866');await expect.poll(async()=>(await saved(page))?.expandedForward).toEqual(progress.expandedForward);expect((await saved(page)).hiddenForwardConnections).toEqual(progress.hiddenForwardConnections);expect((await saved(page)).catalogId).toBe(progress.catalogId);
});
