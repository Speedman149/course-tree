import {expect, test as base, type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {CourseDataset} from '../src/types';
import {PROGRESS_KEY, PROGRESS_VERSION} from '../src/lib/progress';
import {buildDependents} from '../src/lib/graph';
import {PREREQUISITE_HIGHLIGHT_LABEL} from '../src/lib/prerequisite-satisfaction';
import {openCollection, openTools, toolsPanel, toolsTrigger} from './helpers/mobile-tools';

const A='00140855', B='00140856', C='00140889', S='00140843';
const records=(JSON.parse(readFileSync(new URL('../public/data/courses.json',import.meta.url),'utf8')) as CourseDataset).courses;
const index=new Map(records.map(c=>[c.id,c])), dependents=buildDependents(records);
const many=records.filter(c=>!dependents.has(c.id)&&![A,B,C,S].includes(c.id)).slice(0,20).map(c=>c.id);
const before=JSON.parse(readFileSync(new URL('./fixtures/mobile-tools-before.json',import.meta.url),'utf8')) as {width:number;graphHeight:number;footerHeight:number}[];
const disclaimer='Course Tree is an independent student project and is not affiliated with or endorsed by the Technion. Always verify degree requirements using official sources.';
const node=(page:Page,id:string)=>page.locator(`.react-flow__node[data-id="${id}"]`);
const card=(page:Page,id:string)=>node(page,id).locator('.course-node');
const saved=(page:Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'{}').progress,PROGRESS_KEY);
const test=base.extend<{runtimeErrors:void}>({runtimeErrors:[async({page},use)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await use();expect(errors).toEqual([]);
 const ids=await page.locator('.react-flow__node').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-id')));expect(new Set(ids).size).toBe(ids.length);
},{auto:true}]});
async function ready(page:Page,overrides:Record<string,unknown>={}){
 await page.addInitScript(({key,version,A,overrides})=>{if(sessionStorage.getItem('tools-seeded'))return;sessionStorage.setItem('tools-seeded','yes');localStorage.setItem(key,JSON.stringify({version,progress:{primaryCourseId:A,addedCourseIds:[A],expandedForward:[A],markedCourseIds:[],viewport:{x:0,y:0,zoom:.75},...overrides}}));},{key:PROGRESS_KEY,version:PROGRESS_VERSION,A,overrides});
 await page.goto('/?course='+A);await expect(node(page,A).locator('.course-link')).toHaveText(A);await page.evaluate(()=>document.fonts.ready);
}
async function closeTools(page:Page){await toolsPanel(page).getByRole('button',{name:'סגירת הכלים',exact:true}).click();await expect(toolsPanel(page)).toHaveCount(0);}

for(const width of [320,360,375,390,430,640,641,1440])test(`responsive controls reclaim graph space and preserve desktop at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:844});await ready(page);
 const baseline=before.find(v=>v.width===width)!;
 const graph=await page.locator('.graph-canvas').boundingBox(),footer=await page.locator('.site-footer').boundingBox();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width<=640){
  await expect(toolsTrigger(page)).toBeInViewport();await expect(toolsTrigger(page)).toHaveAttribute('aria-expanded','false');await expect(toolsPanel(page)).toHaveCount(0);
  await expect(page.locator('.saved-progress-controls')).toHaveCount(0);await expect(page.locator('.map-legend')).toHaveCount(0);await expect(page.getByRole('switch')).toHaveCount(0);
  expect(graph!.height-baseline.graphHeight).toBeGreaterThan(35);expect(footer!.height).toBeLessThan(baseline.footerHeight-15);
  await expect(page.getByRole('button',{name:'חיפוש קורסים',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'פתיחת מסנני המפה'})).toBeVisible();await expect(page.getByRole('button',{name:'התאמת המפה למסך'})).toBeVisible();
  const legal=page.locator('.mobile-site-disclaimer');await legal.locator('summary').click();await expect(legal.locator('.site-disclaimer')).toBeVisible();await expect(legal.locator('.site-disclaimer')).toHaveText(disclaimer);await expect(legal.locator('.site-disclaimer')).toHaveCSS('font-size','11px');await legal.locator('summary').click();
  await expect.poll(async()=>Math.abs((await page.locator('.graph-canvas').boundingBox())!.height-graph!.height)).toBeLessThan(1);
  if([320,390,640].includes(width))await page.screenshot({path:info.outputPath(`closed-${width}.png`),fullPage:true});
  const drawer=await openTools(page);await expect(drawer).toHaveAttribute('dir','rtl');await expect(drawer.getByRole('button',{name:'סגירת הכלים'})).toBeFocused();await expect(page.locator('.course-collection-popover')).toHaveCount(0);
  expect(await page.locator('.graph-canvas').boundingBox()).toEqual(graph);await closeTools(page);await expect(toolsTrigger(page)).toBeFocused();
 }else{
  await expect(toolsTrigger(page)).toHaveCount(0);await expect(page.locator('.saved-progress-controls')).toBeVisible();await expect(page.getByRole('switch')).toBeVisible();await expect(page.locator('.site-disclaimer')).toBeVisible();
  // Desktop compact buttons intentionally add a small amount of height; mobile budgets above are unchanged.
  expect(footer!.height-baseline.footerHeight).toBeLessThan(30);expect(footer!.height).toBeLessThan(110);expect(graph!.height).toBeGreaterThan(baseline.graphHeight-30);
  const added=await openCollection(page,'added');await expect(added.locator('[data-added-course]')).toHaveCount(1);await page.keyboard.press('Escape');
 }
 await expect(page.getByRole('link',{name:'אודות / About',exact:true})).toBeVisible();await expect(page.getByText('Developed by Chupchick',{exact:true})).toBeVisible();
});

test('drawer traps focus, locks background, closes by Escape/backdrop, and preserves viewport',async({page})=>{
 await page.setViewportSize({width:320,height:568});await ready(page);
 const box=await page.locator('.graph-canvas').boundingBox(),transform=await page.locator('.react-flow__viewport').getAttribute('style');
 let drawer=await openTools(page);await expect(page.locator('.app-shell')).toHaveAttribute('inert','');expect(await page.evaluate(()=>document.body.style.position)).toBe('fixed');
 await drawer.getByRole('button',{name:'איפוס התקדמות שמורה',exact:true}).focus();await page.keyboard.press('Tab');await expect(drawer.getByRole('button',{name:'סגירת הכלים'})).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(drawer.getByRole('button',{name:'איפוס התקדמות שמורה',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');await expect(toolsPanel(page)).toHaveCount(0);await expect(toolsTrigger(page)).toBeFocused();await expect(page.locator('.app-shell')).not.toHaveAttribute('inert','');expect(await page.evaluate(()=>document.body.style.position)).toBe('');
 drawer=await openTools(page);await page.mouse.click(8,180);await expect(drawer).toHaveCount(0);await expect(toolsTrigger(page)).toBeFocused();expect(await page.locator('.graph-canvas').boundingBox()).toEqual(box);expect(await page.locator('.react-flow__viewport').getAttribute('style')).toBe(transform);
});

test('long marked and added lists search, scroll and edit inline, with independent focus and credits',async({page},info)=>{
 await page.setViewportSize({width:320,height:740});const marked=[A,S,...many],added=[A,...many];await ready(page,{addedCourseIds:added,markedCourseIds:marked,expandedForward:[]});
 let section=await openCollection(page,'marked');await expect(section.locator('[data-marked-course]')).toHaveCount(marked.length);await expect(section.locator('summary')).toHaveAccessibleDescription(String(marked.length));await expect(page.locator('.course-collection-popover')).toHaveCount(0);
 const sum=marked.reduce((n,id)=>n+(index.get(id)?.credits??0),0);await expect(section.getByRole('status')).toHaveText('סה״כ נק״ז: '+sum);
 expect(await section.locator('.collection-rows').evaluate(e=>e.scrollHeight>e.clientHeight)).toBe(true);await page.screenshot({path:info.outputPath('long-marked-list.png'),fullPage:true});
 const query=section.getByRole('textbox',{name:'חיפוש ברשימת מסומנים',exact:true});await query.fill(many[19]);await expect(section.locator('[data-marked-course]')).toHaveCount(1);await section.getByRole('button',{name:'הסרת סימון של '+many[19],exact:true}).click();await expect(section.getByRole('status')).toHaveText('סה״כ נק״ז: '+(sum-index.get(many[19])!.credits!));
 section=await openCollection(page,'added');await expect(section.locator('[data-added-course]')).toHaveCount(21);await section.getByRole('textbox',{name:'חיפוש בקורסים שהוספתי',exact:true}).fill(many[19]);await section.getByRole('button',{name:'הסר מהעץ '+many[19],exact:true}).click();
 await section.getByRole('textbox',{name:'חיפוש בקורסים שהוספתי',exact:true}).fill(many[0]);await section.getByRole('button',{name:'מיקוד בקורס שהוספתי '+many[0],exact:true}).click();await expect(toolsPanel(page)).toHaveCount(0);await expect(card(page,many[0])).toHaveClass(/is-focused/);
 await expect.poll(async()=>(await saved(page))?.addedCourseIds.length).toBe(20);expect((await saved(page)).markedCourseIds).not.toContain(many[19]);expect((await saved(page)).markedCourseIds).toContain(many[0]);await page.reload();await expect(node(page,A)).toHaveCount(1);await expect(toolsPanel(page)).toHaveCount(0);expect((await saved(page)).addedCourseIds).not.toContain(many[19]);
});

test('highlighting and marking updates from the drawer stay reactive and clearing requires confirmation',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await ready(page,{markedCourseIds:[A,S],highlightSatisfiedPrerequisites:false});
 let drawer=await openTools(page);const control=drawer.getByRole('switch',{name:PREREQUISITE_HIGHLIGHT_LABEL,exact:true});await control.press('Space');await expect(card(page,B)).toHaveClass(/prerequisites-satisfied/);await expect(card(page,C)).toHaveClass(/prerequisites-satisfied/);await expect(card(page,A)).toHaveClass(/user-marked/);
 let section=await openCollection(page,'marked');await section.getByRole('button',{name:'הסרת סימון של '+A,exact:true}).click();await expect(card(page,B)).not.toHaveClass(/prerequisites-satisfied/);await expect(card(page,C)).toHaveClass(/prerequisites-satisfied/);
 await closeTools(page);const mark=node(page,A).locator('.mark-button');await mark.focus();await mark.press('Enter');await expect(card(page,B)).toHaveClass(/prerequisites-satisfied/);await page.screenshot({path:info.outputPath('highlighted-mobile-graph.png'),fullPage:true});
 section=await openCollection(page,'marked');page.once('dialog',d=>d.dismiss());await section.getByRole('button',{name:'ניקוי סימונים',exact:true}).click();await expect(card(page,B)).toHaveClass(/prerequisites-satisfied/);
 page.once('dialog',d=>d.accept());await section.getByRole('button',{name:'ניקוי סימונים',exact:true}).click();await expect(card(page,B)).not.toHaveClass(/prerequisites-satisfied/);await expect(section.getByRole('status')).toHaveText('סה״כ נק״ז: 0');await expect(control).toHaveAttribute('aria-checked','true');await closeTools(page);
 await expect.poll(async()=>(await saved(page))?.markedCourseIds).toEqual([]);await page.reload();await expect(node(page,A)).toHaveCount(1);drawer=await openTools(page);await expect(drawer.getByRole('switch')).toHaveAttribute('aria-checked','true');
});

test('full reset preserves cancellation and restores default progress after acceptance',async({page})=>{
 await page.setViewportSize({width:360,height:640});await ready(page,{addedCourseIds:[A,B],markedCourseIds:[A],facultyIds:['civil'],highlightSatisfiedPrerequisites:true,hiddenForwardConnections:[A+'->'+C+':strong']});
 let drawer=await openTools(page);await expect(drawer.getByText('ההתקדמות נשמרת בדפדפן הזה',{exact:true})).toBeVisible();const reset=drawer.getByRole('button',{name:'איפוס התקדמות שמורה',exact:true});
 page.once('dialog',d=>d.dismiss());await reset.click();await expect(drawer).toBeVisible();expect((await saved(page)).markedCourseIds).toEqual([A]);
 page.once('dialog',d=>d.accept());await reset.click();await expect(drawer).toHaveCount(0);await expect(page.locator('.root-node .course-link')).toHaveText('02340114');drawer=await openTools(page);await expect(drawer.getByRole('switch')).toHaveAttribute('aria-checked','false');const marked=await openCollection(page,'marked');await expect(marked.getByRole('status')).toHaveText('סה״כ נק״ז: 0');await closeTools(page);
 await page.reload();await expect(page.locator('.root-node .course-link')).toHaveText('02340114');
});

test('search, filters, course details and desktop resizing never leave overlapping tools overlays',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page,{markedCourseIds:[S]});
 await page.getByRole('button',{name:'חיפוש קורסים',exact:true}).click();await expect(page.getByRole('dialog',{name:'חיפוש קורסים',exact:true})).toBeVisible();await toolsTrigger(page).focus();await toolsTrigger(page).press('Enter');await expect(toolsPanel(page)).toBeVisible();await expect(page.getByRole('dialog',{name:'חיפוש קורסים',exact:true})).toHaveCount(0);await closeTools(page);
 const info=node(page,A).locator('.node-info');await info.focus();await info.press('Enter');await expect(page.locator('.prerequisite-panel')).toBeVisible();await openTools(page);await expect(page.locator('.prerequisite-panel')).toHaveCount(0);await closeTools(page);
 await page.getByRole('button',{name:'פתיחת מסנני המפה'}).click();await expect(page.getByRole('dialog',{name:'מסנני המפה'})).toBeVisible();await expect(page.getByRole('button',{name:'חיפוש קורסים',exact:true})).toBeDisabled();await page.getByRole('button',{name:'הצגת המפה',exact:true}).click();
 await openTools(page);await page.setViewportSize({width:641,height:844});await expect(toolsPanel(page)).toHaveCount(0);await expect(page.locator('.saved-progress-controls')).toBeVisible();await expect(page.getByRole('switch')).toBeVisible();expect(await page.evaluate(()=>document.body.style.position)).toBe('');await expect(page.locator('.app-shell')).not.toHaveAttribute('inert','');
 await page.setViewportSize({width:640,height:844});await expect(toolsTrigger(page)).toBeVisible();await expect(toolsTrigger(page)).toHaveAttribute('aria-expanded','false');await expect(page.locator('.saved-progress-controls')).toHaveCount(0);await expect.poll(async()=>(await saved(page))?.markedCourseIds).toEqual([S]);
 await page.getByRole('link',{name:'אודות / About',exact:true}).click();await expect(page.getByRole('heading',{name:'אודות / About',exact:true})).toBeVisible();await page.goBack();await expect(toolsTrigger(page)).toBeVisible();await openTools(page);
 await page.goForward();await expect(page.getByRole('heading',{name:'אודות / About',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.body.style.position)).toBe('');await page.goBack();await expect(toolsTrigger(page)).toHaveAttribute('aria-expanded','false');await expect(toolsPanel(page)).toHaveCount(0);
});

test('drawer remains usable inside a keyboard-sized visual viewport and honors reduced motion',async({page})=>{
 await page.setViewportSize({width:320,height:568});await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>{const view=Object.assign(new EventTarget(),{width:innerWidth,height:innerHeight,offsetTop:0,offsetLeft:0});Object.defineProperty(window,'visualViewport',{value:view,configurable:true});});
 await ready(page,{markedCourseIds:[A,...many],expandedForward:[]});const section=await openCollection(page,'marked');const input=section.getByRole('textbox',{name:'חיפוש ברשימת מסומנים',exact:true});await input.fill(many[0]);
 await page.evaluate(()=>{const view=window.visualViewport!;Object.assign(view,{height:280,offsetTop:35});view.dispatchEvent(new Event('resize'));});
 await expect.poll(async()=>{const b=(await toolsPanel(page).boundingBox())!;return b.y+b.height;}).toBeLessThanOrEqual(315);
 await input.scrollIntoViewIfNeeded();const box=await input.boundingBox();expect(box!.y).toBeGreaterThanOrEqual(35);expect(box!.y+box!.height).toBeLessThanOrEqual(315);await expect(toolsPanel(page)).toHaveCSS('animation-name','none');await toolsPanel(page).getByRole('button',{name:'סגירת הכלים'}).click();await expect(toolsTrigger(page)).toBeFocused();
});


test('touch taps toggle tools, update markings, and close the backdrop without moving the graph',async({browser})=>{
 const context=await browser.newContext({viewport:{width:375,height:812},hasTouch:true,isMobile:true,deviceScaleFactor:2,baseURL:process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:4173'});
 const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await ready(page,{markedCourseIds:[A,S],highlightSatisfiedPrerequisites:false});const transform=await page.locator('.react-flow__viewport').getAttribute('style');
  await toolsTrigger(page).tap();const drawer=toolsPanel(page);await expect(drawer).toBeVisible();await drawer.getByRole('switch').tap();await expect(card(page,B)).toHaveClass(/prerequisites-satisfied/);
  await drawer.locator('[data-tools-section="marked"]>summary').tap();await drawer.getByRole('button',{name:'הסרת סימון של '+A,exact:true}).tap();await expect(card(page,B)).not.toHaveClass(/prerequisites-satisfied/);await expect(card(page,C)).toHaveClass(/prerequisites-satisfied/);
  await page.touchscreen.tap(8,180);await expect(drawer).toHaveCount(0);expect(await page.locator('.react-flow__viewport').getAttribute('style')).toBe(transform);expect(errors).toEqual([]);
 }finally{await context.close();}
});
