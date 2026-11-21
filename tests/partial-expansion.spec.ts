import {expect,test as base,type Page} from '@playwright/test';
import {PROGRESS_KEY,PROGRESS_VERSION} from '../src/lib/progress';
const A='00000001',B='00000002',C='00000003',D='00000004',E='00000005',F='00000006',G='00000007',H='00000008',X='00000009';
const leaf=(courseId:string)=>({type:'course',courseId,relation:'strong'});
const course=(id:string,requirements:any=null,faculty='הפקולטה למדעי המחשב')=>({id,name:'מקצוע ענפים '+id,faculty,requirements,requirementsStatus:requirements?'known':'none',source:{url:'https://portalex.technion.ac.il/ovv/#/details/2026/200/SM/'+id}});
const dataset={meta:{latestTerm:'2026_200'},courses:[course(A),course(B,leaf(A)),course(C,leaf(B)),course(D,leaf(C)),course(E,{type:'or',items:[leaf(B),leaf(X)]}),course(F,leaf(B),'הפקולטה למתמטיקה'),course(G,leaf(B)),course(H,leaf(E)),course(X)]};
const program={id:'partial-program',programId:'partial',officialName:'מסלול בדיקה לענפים',facultyIds:['cs'],degreeType:'B.Sc.',catalogYear:'2025-2026',mandatoryCourseIds:[A,B,C,D,E,F,H,X],additionalEligibleCourseIds:[],electiveGroups:[],sourceRefs:[],coverage:{status:'verified-listed',notes:[]}};
const catalog={meta:{years:['2025-2026'],defaultYear:'2025-2026',notes:[]},sources:[],programs:[program],referencedCourses:[]};
const test=base.extend<{fixture:void}>({fixture:[async({page},use)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/data/courses.json',r=>r.fulfill({json:dataset}));
 await page.route('**/data/catalogs.json',r=>r.fulfill({json:catalog}));
 await use();expect(errors).toEqual([]);
 for(const selector of ['.react-flow__node','.react-flow__edge']) {
  const ids=await page.locator(selector).evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-id')));
  expect(new Set(ids).size).toBe(ids.length);
 }
},{auto:true}]});
const node=(page:Page,id:string)=>page.locator('.react-flow__node[data-id="'+id+'"]');
const card=(page:Page,id=B)=>node(page,id).locator('.course-node');
const key=(source:string,target:string)=>source+'->'+target+':strong';
const edge=(page:Page,source:string,target:string)=>page.locator('[data-connection="'+key(source,target)+'"]');
const saved=(page:Page)=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)??'{}').progress,PROGRESS_KEY);
async function toggle(page:Page,id=B) {const b=node(page,id).locator('.expand-button');await b.focus();await b.press('Enter');}
async function pin(page:Page,id:string) {
 const input=page.getByRole('combobox',{name:'חיפוש קורס לפי מספר או שם',exact:true});
 if(!await input.isVisible())await page.getByRole('button',{name:'חיפוש קורסים',exact:true}).click();
 await input.fill(id);await page.getByRole('option').filter({hasText:id}).getByRole('button',{name:'הוסף לעץ '+id,exact:true}).click();
 await input.press('Escape');await expect(node(page,id).locator('.added-badge')).toBeVisible();
}
async function mark(page:Page,id:string) {const b=node(page,id).locator('.mark-button');await b.focus();await b.press('Enter');await expect(b).toHaveAttribute('aria-pressed','true');}
async function focusB(page:Page) {
 await mark(page,B);await page.getByRole('button',{name:'רשימת מסומנים',exact:true}).click();
 await page.getByRole('dialog',{name:'רשימת מסומנים',exact:true}).getByRole('button',{name:'מיקוד במקצוע מסומן '+B,exact:true}).click();
 await expect(card(page)).toHaveClass(/is-focused/);
}
async function ready(page:Page,width:number) {
 await page.setViewportSize({width,height:width<640?844:1000});await page.goto('/?course='+A);
 await expect(node(page,A).locator('.course-link')).toHaveText(A);await pin(page,D);
 await expect(card(page)).toHaveAttribute('data-expansion','partial');await focusB(page);
}
async function menu(page:Page) {
 const details=node(page,B).locator('.branch-restores');
 if(await details.getAttribute('open')===null){await details.locator('summary').focus();await details.locator('summary').press('Enter');}
 await expect(details).toHaveAttribute('open','');return details;
}
async function count(page:Page,n:number) {await expect(node(page,B).locator('.branch-restores>summary')).toHaveText('הצגת ענפים ('+n+')');}
async function reveal(page:Page,id:string) {
 const details=await menu(page), b=details.locator('[data-restore-connection="'+key(B,id)+'"]');
 await b.focus();await b.press('Enter');await expect(edge(page,B,id)).toHaveCount(1);
}
async function hide(page:Page,id:string) {const b=edge(page,B,id);await b.focus();await b.press('Enter');await expect(b).toHaveCount(0);}
async function all(page:Page) {const details=await menu(page),b=details.getByRole('button',{name:'הצגת כל הענפים של '+B,exact:true});await b.focus();await b.press('Enter');}
async function filters(page:Page) {await page.keyboard.press('Escape');await page.getByRole('button',{name:'פתיחת מסנני המפה',exact:true}).click();}
async function closeFilters(page:Page) {await page.getByRole('button',{name:'הצגת המפה',exact:true}).click();}

for(const width of [1440,390,320])test('partial automatic path supports independent reveals, refresh, show-all and collapse at '+width+'px',async({page},info)=>{
 await ready(page,width);await count(page,3);
 await reveal(page,E);await count(page,2);
 await expect(node(page,E)).toHaveCount(1);for(const id of [F,G,H])await expect(node(page,id)).toHaveCount(0);
 await expect(edge(page,B,C)).toHaveCount(1);
 await expect.poll(async()=>(await saved(page))?.revealedForwardConnections).toEqual([key(B,E)]);
 expect((await saved(page)).expandedForward).not.toContain(B);
 await hide(page,C);await count(page,3);await expect(node(page,C)).toHaveCount(0);await expect(node(page,D)).toHaveCount(1);
 await expect.poll(async()=>(await saved(page))?.hiddenForwardConnections).toContain(key(B,C));
 await page.reload();await expect(card(page)).toHaveAttribute('data-expansion','partial');await count(page,3);
 await expect(node(page,E).locator('.course-link')).toHaveText(E);await expect(node(page,B).locator('.mark-button')).toHaveAttribute('aria-pressed','true');
 await expect(node(page,C)).toHaveCount(0);await expect(node(page,F)).toHaveCount(0);await expect(node(page,G)).toHaveCount(0);
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)??'{}').version,PROGRESS_KEY)).toBe(PROGRESS_VERSION);
 await reveal(page,C);await count(page,2);await expect(node(page,D).locator('.added-badge')).toBeVisible();
 const details=await menu(page);await details.locator('summary').scrollIntoViewIfNeeded();
 await expect(details).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('partial-menu-'+width+'.png')});
 await all(page);await expect(card(page)).toHaveAttribute('data-expansion','expanded');await expect(node(page,B).locator('.branch-restores')).toHaveCount(0);
 for(const id of [C,D,E,F,G])await expect(node(page,id)).toHaveCount(1);await expect(node(page,H)).toHaveCount(0);
 await toggle(page);await expect(card(page)).toHaveAttribute('data-expansion','collapsed');await expect(node(page,B).locator('.expand-button')).toHaveAttribute('aria-expanded','false');
 for(const id of [C,E,F,G])await expect(node(page,id)).toHaveCount(0);await expect(node(page,D)).toHaveCount(1);
 await toggle(page);await expect(card(page)).toHaveAttribute('data-expansion','expanded');await expect(node(page,H)).toHaveCount(0);
 await hide(page,E);await count(page,1);await reveal(page,E);await expect(card(page)).toHaveAttribute('data-expansion','expanded');
 expect((await saved(page)).addedCourseIds).toEqual([A,D]);
});

for(const width of [1440,390])test('partial branch menu follows the faculty/catalog intersection without reopening excluded siblings at '+width+'px',async({page})=>{
 await ready(page,width);await filters(page);await page.getByRole('tab',{name:/קטלוג תואר/}).click();
 await page.getByRole('textbox',{name:'חיפוש תואר',exact:true}).fill(program.officialName);await page.locator('.catalog-option').click();
 await page.getByRole('tab',{name:/סינון לפי פקולטה/}).click();await page.getByRole('button',{name:'ניקוי הכול',exact:true}).click();
 await page.getByRole('checkbox',{name:'מדעי המחשב',exact:true}).check();await closeFilters(page);
 await count(page,1);let details=await menu(page);
 await expect(details.locator('[data-restore-connection="'+key(B,E)+'"]')).toHaveCount(1);
 for(const id of [F,G])await expect(details.locator('[data-restore-connection="'+key(B,id)+'"]')).toHaveCount(0);
 await all(page);await expect(card(page)).toHaveAttribute('data-expansion','expanded');for(const id of [F,G])await expect(node(page,id)).toHaveCount(0);
 expect((await saved(page)).revealedForwardConnections).not.toContain(key(B,F));
 expect((await saved(page)).revealedForwardConnections).not.toContain(key(B,C));
 await filters(page);await page.getByRole('checkbox',{name:'מתמטיקה',exact:true}).check();await closeFilters(page);
 await count(page,1);await expect(node(page,F)).toHaveCount(0);await reveal(page,F);await expect(card(page)).toHaveAttribute('data-expansion','expanded');await expect(node(page,G)).toHaveCount(0);
 await page.getByRole('button',{name:'איפוס כל המסננים',exact:true}).click();await count(page,1);await expect(node(page,G)).toHaveCount(0);
 await all(page);await expect(node(page,G)).toHaveCount(1);await expect(node(page,H)).toHaveCount(0);
 await expect.poll(async()=>(await saved(page))?.revealedForwardConnections).toContain(key(B,G));
 await filters(page);await page.getByRole('button',{name:'ניקוי הכול',exact:true}).click();await page.getByRole('checkbox',{name:'מדעי המחשב',exact:true}).check();await closeFilters(page);
 await expect(node(page,F)).toHaveCount(0);await expect(node(page,B).locator('.mark-button')).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'איפוס כל המסננים',exact:true}).click();await expect(node(page,F)).toHaveCount(1);
 expect((await saved(page)).addedCourseIds).toEqual([A,D]);
});

test('revealing a shared child adds its connection without duplicating or resetting its expanded descendants',async({page})=>{
 await ready(page,1440);await pin(page,X);await expect(node(page,E)).toHaveCount(1);await toggle(page,E);await expect(node(page,H)).toHaveCount(1);await mark(page,E);
 await count(page,3);await reveal(page,E);await count(page,2);await expect(node(page,H)).toHaveCount(1);
 await expect(node(page,E).locator('.mark-button')).toHaveAttribute('aria-pressed','true');await expect(edge(page,X,E)).toHaveCount(1);
 await hide(page,E);await expect(node(page,E)).toHaveCount(1);await expect(node(page,H)).toHaveCount(1);await reveal(page,E);
 await toggle(page);await expect(node(page,C)).toHaveCount(0);for(const id of [E,H,D,X])await expect(node(page,id)).toHaveCount(1);
 await toggle(page);await expect(node(page,H)).toHaveCount(1);await expect(node(page,E)).toHaveCount(1);
});
