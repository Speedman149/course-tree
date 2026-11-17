import {expect,test as base,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {PROGRESS_KEY} from '../src/lib/progress';
const sap=JSON.parse(readFileSync(new URL('../public/data/courses.json',import.meta.url),'utf8'));
const catalog=JSON.parse(readFileSync(new URL('../public/data/catalogs.json',import.meta.url),'utf8'));
const courses=new Map([...sap.courses,...catalog.referencedCourses].map(c=>[c.id,c]));
const footerBefore=JSON.parse(readFileSync(new URL('./fixtures/footer-before.json',import.meta.url),'utf8'));
const test=base.extend<{runtimeErrors:void}>({runtimeErrors:[async({page},use)=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await use();expect(errors).toEqual([]);},{auto:true}]});
const A='00140855',B='root/f:00140856:strong',C='root/f:00140889:strong',DB=`${B}/f:00140866:strong`,DC=`${C}/f:00140866:strong`;
const node=(page:Page,id='root')=>page.locator(`.react-flow__node[data-id="${id}"]`);
const saved=(page:Page)=>page.evaluate(key=>{const raw=localStorage.getItem(key);return raw?JSON.parse(raw).progress:null;},PROGRESS_KEY);
async function ready(page:Page,root=A){await page.goto(`/?course=${root}`);await expect(node(page).locator('.course-link')).toHaveText(root);}
async function toggle(page:Page,id:string){const button=node(page,id).locator('.expand-button');await button.focus();await button.press('Enter');}
async function diamond(page:Page){await ready(page);for(const id of [B,C]){await toggle(page,id);await expect(node(page,id).locator('.expand-button')).toHaveAttribute('aria-expanded','true');}await expect(node(page,DB)).toHaveCount(1);await expect(node(page,DC)).toHaveCount(1);}
async function settled(page:Page){await expect.poll(async()=>page.locator('.react-flow__viewport').evaluate((el,key)=>{const raw=localStorage.getItem(key);if(!raw)return 100;const view=JSON.parse(raw).progress.viewport;if(!view)return 100;const m=new DOMMatrixReadOnly(getComputedStyle(el).transform);return Math.max(Math.abs(m.a-view.zoom),Math.abs(m.e-view.x),Math.abs(m.f-view.y));},PROGRESS_KEY)).toBeLessThan(.1);}
async function fit(page:Page){await page.keyboard.press('Escape');await page.getByRole('button',{name:'התאמת המפה למסך',exact:true}).click();await settled(page);}
async function hide(page:Page,id:string){const button=page.locator(`[data-connection="${id}"]`);await button.focus();await button.press('Enter');await expect(node(page,id)).toHaveCount(0);}
async function restore(page:Page,parent:string,id:string){const details=node(page,parent).locator('.branch-restores');if(await details.getAttribute('open')===null){await details.locator('summary').focus();await details.locator('summary').press('Enter');}const button=details.locator(`[data-restore-connection="${id}"]`);await button.focus();await button.press('Enter');await expect(node(page,id)).toHaveCount(1);}
async function mark(page:Page,id:string){const button=node(page,id).locator('.mark-button');await button.focus();await button.press('Enter');await expect(button).toHaveAttribute('aria-pressed','true');}

test('edge minus hides only B, restores its subtree, and original node buttons retain all-branch behavior',async({page})=>{
 await diamond(page);await fit(page);const before=await node(page).boundingBox();const zoom=await page.locator('.canvas-controls>span').textContent();
 // Exercise an actual pointer click near the child arrow endpoint.
 await page.locator(`[data-connection="${B}"]`).click();await expect(node(page,B)).toHaveCount(0);await expect(node(page,DB)).toHaveCount(0);await expect(node(page,C).locator('.expand-button')).toHaveAttribute('aria-expanded','true');await expect(node(page,DC)).toHaveCount(1);await expect(node(page).locator('.expand-button')).toHaveAttribute('aria-expanded','true');
 await expect.poll(async()=>{const box=await node(page).boundingBox();return Math.max(Math.abs(box!.x-before!.x),Math.abs(box!.y-before!.y));}).toBeLessThan(2);await expect(page.locator('.canvas-controls>span')).toHaveText(zoom!);
 await restore(page,'root',B);await expect(node(page,B).locator('.expand-button')).toHaveAttribute('aria-expanded','true');await expect(node(page,DB)).toHaveCount(1);await expect(node(page,DC)).toHaveCount(1);
 for(let i=0;i<2;i++){await hide(page,B);await expect(node(page,DC)).toHaveCount(1);await restore(page,'root',B);await expect(node(page,DB)).toHaveCount(1);}
 await hide(page,B);await toggle(page,'root');await expect(page.locator('.react-flow__node')).toHaveCount(1);await toggle(page,'root');await expect(node(page,B)).toHaveCount(1);await expect(node(page,DB)).toHaveCount(1);await expect(node(page,DC)).toHaveCount(1);
});

test('shared course instances and global red markings survive through the other parent',async({page})=>{
 await diamond(page);await mark(page,DB);await expect(node(page,DC).locator('.course-node')).toHaveClass(/user-marked/);
 await hide(page,DB);await expect(node(page,DC)).toHaveCount(1);await expect(node(page,DC).locator('.course-node')).toHaveClass(/user-marked/);await expect(node(page,C).locator('.expand-button')).toHaveAttribute('aria-expanded','true');
 await hide(page,DC);await expect(page.locator('.course-node').filter({has:page.locator('.course-link').filter({hasText:'00140866'})})).toHaveCount(0);
 await restore(page,B,DB);await expect(node(page,DB).locator('.course-node')).toHaveClass(/user-marked/);await expect(node(page,DC)).toHaveCount(0);await expect.poll(async()=> (await saved(page))?.markedCourseIds).toContain('00140866');
});

test('hidden connections, expanded siblings, degree/faculty filters and markings survive refresh together',async({page})=>{
 await diamond(page);await page.getByRole('button',{name:'פתיחת מסנני המפה'}).click();await page.getByRole('tab',{name:/קטלוג תואר/}).click();
 const program=catalog.programs.find(p=>p.id==='mapping-3-mapping-2025-2026');await page.getByRole('textbox',{name:'חיפוש תואר'}).fill(program.officialName);await page.locator('.catalog-option').click();await page.getByRole('tab',{name:/סינון לפי פקולטה/}).click();await page.getByRole('button',{name:'ניקוי הכול',exact:true}).click();await page.getByRole('checkbox',{name:'הנדסה אזרחית וסביבתית',exact:true}).check();await page.getByRole('button',{name:'הצגת המפה',exact:true}).click();
 await mark(page,DC);const color=await node(page,DC).locator('.course-node').evaluate(el=>(el as HTMLElement).style.getPropertyValue('--faculty-accent'));
 await hide(page,B);await expect.poll(async()=> (await saved(page))?.hiddenForwardConnections).toContain(B);await settled(page);await page.reload();await expect(node(page).locator('.course-link')).toHaveText(A);
 await expect(node(page,B)).toHaveCount(0);await expect(node(page,C).locator('.expand-button')).toHaveAttribute('aria-expanded','true');await expect(node(page,DC).locator('.course-node')).toHaveClass(/user-marked/);await expect(page.locator('.active-filter-summary')).toContainText(program.officialName);
 expect((await saved(page)).facultyIds).toEqual(['civil']);expect(await node(page,DC).locator('.course-node').evaluate(el=>(el as HTMLElement).style.getPropertyValue('--faculty-accent'))).toBe(color);
 await restore(page,'root',B);await expect(node(page,DB).locator('.course-node')).toHaveClass(/user-marked/);
});

test('course-level reopen restores direct hidden children but retains deeper hidden choices',async({page})=>{
 await diamond(page);await hide(page,DB);await hide(page,C);await toggle(page,'root');await expect(page.locator('.react-flow__node')).toHaveCount(1);await toggle(page,'root');
 await expect(node(page,C)).toHaveCount(1);await expect(node(page,DC)).toHaveCount(1);await expect(node(page,DB)).toHaveCount(0);await restore(page,B,DB);await expect(node(page,DB)).toHaveCount(1);
});

test('branch reset and root changes clear hidden connections while preserving markings',async({page})=>{
 await diamond(page);await mark(page,DC);await hide(page,B);await page.getByRole('button',{name:'איפוס ענפים',exact:true}).click();await expect(node(page,B)).toHaveCount(1);await expect.poll(async()=> (await saved(page))?.hiddenForwardConnections).toEqual([]);await expect.poll(async()=> (await saved(page))?.markedCourseIds).toContain('00140866');
 await hide(page,B);const search=page.getByRole('combobox');await search.fill('00140866');await page.getByRole('option').filter({hasText:'00140866'}).click();await expect(node(page).locator('.mark-button')).toHaveAttribute('aria-pressed','true');await expect.poll(async()=> (await saved(page))?.hiddenForwardConnections).toEqual([]);
 await search.fill(A);await page.getByRole('option').filter({hasText:A}).click();await expect(node(page,B)).toHaveCount(1);
});

test('outdated saved connection identifiers are discarded without losing valid progress',async({page})=>{
 await page.addInitScript(({key,B,C,A})=>{if(!sessionStorage.getItem('branch-seeded')){localStorage.setItem(key,JSON.stringify({version:2,progress:{rootId:A,expandedForward:['root',B,C],expandedBackward:[],hiddenForwardConnections:[B,'obsolete','root','root/b:00140856:strong','root/f:99999999:strong'],markedCourseIds:['00140866'],facultyIds:null}}));sessionStorage.setItem('branch-seeded','yes');}},{key:PROGRESS_KEY,B,C,A});
 await ready(page);await expect(node(page,B)).toHaveCount(0);await expect(node(page,DC).locator('.mark-button')).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'הגדלת המפה',exact:true}).click();await expect.poll(async()=> (await saved(page))?.hiddenForwardConnections).toEqual([B]);
});

test('regular strong badge is removed, while backward green controls and concurrent badges remain',async({page})=>{
 await ready(page,'02340247');await node(page).locator('.node-info').click();await page.getByRole('dialog',{name:`קדמים של ${courses.get('02340247').name}`,exact:true}).getByRole('button',{name:`הרחבת קדם ${courses.get('02340218').name}`,exact:true}).click();
 const backward=node(page,'root/b:02340218:strong');await expect(backward.locator('.backward-badge')).toContainText('קדם');await expect(page.locator('.course-node .relationship-chip.strong')).toHaveCount(0);await expect(page.locator('[data-connection="root/b:02340218:strong"]')).toHaveCount(0);
 const green=await backward.locator('.backward-badge').evaluate(el=>getComputedStyle(el).color.match(/\d+/g)!.map(Number));expect(green[1]).toBeGreaterThan(green[0]);
 await backward.locator('.backward-badge').focus();await backward.locator('.backward-badge').press('Enter');await expect(backward).toHaveCount(0);
 await ready(page,'01040067');await expect(node(page,'root/f:01040022:concurrent').locator('.relationship-chip.concurrent')).toHaveText('מקצוע צמוד');
});

for(const baseline of footerBefore)test(`footer is smaller with unchanged content at ${baseline.viewport.width}px`,async({page})=>{
 await page.setViewportSize(baseline.viewport);await ready(page,'02340114');
 const footer=await page.locator('.site-footer').evaluate(el=>({height:el.getBoundingClientRect().height,text:el.textContent}));
 expect(footer.height).toBeLessThan(baseline.height-8);expect(footer.text!.replace(/\s+/g,' ').trim()).toBe(baseline.text.replace(/\s+/g,' ').trim());
 await expect(page.getByText('Developed by Chupchick',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('About keeps its content and upper navigation, with the large button removed',async({page})=>{
 await ready(page);await page.getByRole('link',{name:'אודות / About',exact:true}).click();await expect(page.getByText('idk seems kinda cool ill put something here later',{exact:true})).toBeVisible();await expect(page.locator('.about-content .modal-primary')).toHaveCount(0);await page.reload();await page.getByRole('link',{name:'חזרה למפת הקורסים ←',exact:true}).click();await expect(node(page).locator('.course-link')).toHaveText(A);
});
test('all hidden direct branches can be reopened one at a time without resetting the graph',async({page})=>{
 await diamond(page);const direct=await page.locator('.edge-branch-toggle').evaluateAll(buttons=>buttons.map(button=>button.getAttribute('data-connection')!).filter(id=>id.startsWith('root/f:')&&id.split('/').length===2));for(const connection of direct)await hide(page,connection);await expect(page.locator('.react-flow__node')).toHaveCount(1);await expect(node(page).locator('.expand-button')).toHaveAttribute('aria-expanded','true');await expect(page.locator('.single-node-hint')).toContainText('הצגת ענפים');
 await restore(page,'root',B);await expect(node(page,DB)).toHaveCount(1);await expect(node(page,C)).toHaveCount(0);await restore(page,'root',C);await expect(node(page,DC)).toHaveCount(1);await expect(node(page,DB)).toHaveCount(1);
});

test('connection visibility synchronizes across tabs without resetting expanded sibling paths',async({page,context})=>{
 await diamond(page);await expect.poll(async()=> (await saved(page))?.expandedForward).toContain(C);const second=await context.newPage();await second.goto(`/?course=${A}`);await expect(node(second,DC)).toHaveCount(1);
 await hide(page,B);await expect(node(second,B)).toHaveCount(0);await expect(node(second,DC)).toHaveCount(1);await restore(second,'root',B);await expect(node(page,DB)).toHaveCount(1);await expect(node(page,C).locator('.expand-button')).toHaveAttribute('aria-expanded','true');await second.close();
});