import {expect,test as base,type Page,type Route} from '@playwright/test';
import {FEEDBACK_ENDPOINT} from '../src/lib/feedback';
import {PROGRESS_KEY} from '../src/lib/progress';
import {readFileSync} from 'node:fs';
const appVersion=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
const test=base.extend<{runtimeErrors:void}>({runtimeErrors:[async({page},use)=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await use();expect(errors).toEqual([]);},{auto:true}]});
const description='מצאתי תקלה בעת פתיחת ענף במפת הקורסים. אשמח שתבדקו אותה.';
const success={next:'https://formspree.io/thanks'};
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST, OPTIONS'};
// All Formspree traffic is intercepted. Tests never send mail to the real inbox.
test.beforeEach(async({page})=>{await page.route('https://formspree.io/**',route=>route.fulfill({status:503,headers,contentType:'application/json',body:JSON.stringify({error:'Unmocked submission blocked by test'})}));});
async function mock(page:Page,handler:(route:Route)=>Promise<void>){await page.route(FEEDBACK_ENDPOINT,async route=>{if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}await handler(route);});}
async function respond(route:Route,body:unknown,status=200){await route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});}
async function form(page:Page,url='/feedback'){await page.goto(url);await expect(page.getByRole('heading',{name:'דיווח על תקלה ושליחת משוב'})).toBeVisible();}
async function fill(page:Page){await page.getByLabel('סוג המשוב').selectOption('bug');await page.locator('#feedback-description').fill(description);}
const send=(page:Page)=>page.getByRole('button',{name:'שליחת משוב',exact:true});

test('header bug icon navigates internally and preserves expanded/hidden branches and markings on return',async({page})=>{
 await page.addInitScript(key=>{if(!sessionStorage.getItem('feedback-seed')){localStorage.setItem(key,JSON.stringify({version:2,progress:{rootId:'00140855',expandedForward:['root','root/f:00140889:strong'],expandedBackward:[],hiddenForwardConnections:['root/f:00140856:strong'],markedCourseIds:['00140866'],facultyIds:['civil'],catalogId:'mapping-3-mapping-2025-2026',catalogYear:'2025-2026'}}));sessionStorage.setItem('feedback-seed','yes');}},PROGRESS_KEY);
 await page.goto('/?course=00140855');await expect(page.locator('.root-node')).toBeVisible();await page.getByRole('button',{name:'התאמת המפה למסך',exact:true}).click();await expect.poll(async()=>page.locator('.react-flow__viewport').evaluate((el,key)=>{const view=JSON.parse(localStorage.getItem(key)??'{}').progress?.viewport;if(!view)return 100;const m=new DOMMatrixReadOnly(getComputedStyle(el).transform);return Math.max(Math.abs(m.a-view.zoom),Math.abs(m.e-view.x),Math.abs(m.f-view.y));},PROGRESS_KEY)).toBeLessThan(.1);const before=await page.locator('.react-flow__viewport').evaluate(el=>getComputedStyle(el).transform);await page.evaluate(()=>(window as any).spaFeedbackProbe=42);
 const icon=page.getByRole('link',{name:'דיווח על תקלה או שליחת משוב',exact:true});await expect(icon).toHaveAttribute('title','דיווח על תקלה או שליחת משוב');await icon.click();await expect(page).toHaveURL(/\/feedback$/);expect(await page.evaluate(()=>(window as any).spaFeedbackProbe)).toBe(42);
 await page.getByRole('link',{name:'חזרה למפת הקורסים',exact:true}).click();await expect(page.locator('.root-node .course-link')).toHaveText('00140855');await expect(page.locator('.react-flow__node[data-id="00140856"]')).toHaveCount(0);await expect(page.locator('.react-flow__node[data-id="00140889"] .expand-button')).toHaveAttribute('aria-expanded','true');await expect(page.locator('.user-marked .course-link')).toHaveText('00140866');await expect(page.locator('.active-filter-summary')).toContainText('2025-2026');expect(await page.evaluate(()=>(window as any).spaFeedbackProbe)).toBe(42);await expect.poll(async()=>page.locator('.react-flow__viewport').evaluate(el=>getComputedStyle(el).transform)).toBe(before);
});

test('required and optional fields validate in Hebrew without sending invalid data',async({page})=>{
 let requests=0;await mock(page,async route=>{requests++;await respond(route,success);});await form(page);await send(page).click();await expect(page.getByText('יש לבחור סוג משוב.',{exact:true})).toBeVisible();await expect(page.getByLabel('סוג המשוב')).toBeFocused();
 await page.getByLabel('סוג המשוב').selectOption('bug');await page.locator('#feedback-description').fill('קצר');await send(page).click();await expect(page.getByText('יש לכתוב תיאור של לפחות 10 תווים.',{exact:true})).toBeVisible();
 await page.locator('#feedback-description').fill(description);await page.getByLabel('מספר קורס (אם רלוונטי)').fill('abc');await page.getByLabel('כתובת אימייל (לא חובה)').fill('not-an-email');await send(page).click();await expect(page.getByText('מספר קורס צריך להכיל 5–8 ספרות בלבד.',{exact:true})).toBeVisible();await expect(page.getByText(/יש להזין כתובת אימייל תקינה/)).toBeVisible();expect(requests).toBe(0);
});

test('anonymous submission has the structured payload and sanitized context, and confirms success in-app',async({page})=>{
 let payload:any;await mock(page,async route=>{payload=route.request().postDataJSON();await respond(route,success);});await page.goto('/?course=02340247&email=private@example.com&token=secret');await expect(page.locator('.root-node .course-link')).toHaveText('02340247');await page.getByRole('link',{name:'דיווח על תקלה או שליחת משוב',exact:true}).click();await fill(page);const submitted=Date.now();await send(page).click();await expect(page.getByText('המשוב נשלח בהצלחה! תודה שעזרתם לנו להשתפר.',{exact:true})).toBeVisible();
 expect(payload.category).toBe('bug');expect(payload.category_label).toBe('דיווח על תקלה');expect(payload.description).toBe(description);expect(payload.starting_course_id).toBe('02340247');expect(payload.source_route).toBe('tree');expect(payload.user_agent).toBeTruthy();expect(payload.app_version).toBe(appVersion);expect(Date.parse(payload.submitted_at)).toBeGreaterThanOrEqual(submitted);expect(payload.course_number).toBeUndefined();expect(payload.email).toBeUndefined();expect(payload._gotcha).toBe('');expect(payload.page_url).toMatch(/\/feedback$/);expect(payload.source_page_url).toMatch(/\/?\?course=02340247$/);expect(JSON.stringify(payload)).not.toMatch(/private|secret|expandedForward|markedCourseIds/);await expect(page).toHaveURL(/\/feedback$/);
 await page.getByRole('link',{name:'חזרה למפת הקורסים',exact:true}).last().click();await expect(page.locator('.root-node .course-link')).toHaveText('02340247');
});

test('pending request disables duplicate submit events and displays a loading indicator',async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let count=0;await mock(page,async route=>{count++;await gate;await respond(route,success);});await form(page);await fill(page);
 try{await send(page).click();await expect(page.getByRole('button',{name:'שולחים את המשוב…',exact:true})).toBeDisabled();await page.locator('form').evaluate(form=>{for(let i=0;i<4;i++)form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});expect(count).toBe(1);}finally{release();}
 await expect(page.getByText('המשוב נשלח בהצלחה! תודה שעזרתם לנו להשתפר.',{exact:true})).toBeVisible();expect(count).toBe(1);
});

test('network failure preserves the description and permits a successful retry',async({page})=>{
 let count=0;await mock(page,async route=>{if(++count===1)await route.abort('failed');else await respond(route,success);});await form(page);await fill(page);await send(page).click();await expect(page.getByRole('alert')).toContainText('לא הצלחנו לשלוח');await expect(page.locator('#feedback-description')).toHaveValue(description);await expect(send(page)).toBeEnabled();await send(page).click();await expect(page.getByText('המשוב נשלח בהצלחה! תודה שעזרתם לנו להשתפר.',{exact:true})).toBeVisible();expect(count).toBe(2);
});

for(const scenario of [{status:429,body:{error:'Too many submissions; rate limit exceeded'},message:'בעוד כמה דקות'},{status:403,body:{errors:[{code:'INACTIVE',message:'This form is inactive'}]},message:'אינה זמינה'}])test(`submission limit or inactive form is handled without data loss (${scenario.status})`,async({page})=>{
 await mock(page,route=>respond(route,scenario.body,scenario.status));await form(page);await fill(page);await send(page).click();await expect(page.getByRole('alert')).toContainText(scenario.message);await expect(page.locator('#feedback-description')).toHaveValue(description);await expect(send(page)).toBeEnabled();await expect(page.locator('.feedback-success')).toHaveCount(0);
});

test('server-side field validation is translated and optional fields survive correction/retry',async({page})=>{
 let count=0;let payload:any;await mock(page,async route=>{payload=route.request().postDataJSON();if(++count===1)await respond(route,{errors:[{field:'email',code:'TYPE_EMAIL',message:'<script>not accepted</script>'}]},422);else await respond(route,success);});await form(page);await fill(page);await page.getByLabel('מספר קורס (אם רלוונטי)').fill('234114');await page.getByLabel('כתובת אימייל (לא חובה)').fill('student@example.com');await send(page).click();await expect(page.getByText(/הכתובת לא התקבלה/)).toBeVisible();await expect(page.locator('#feedback-description')).toHaveValue(description);await expect(page.locator('body')).not.toContainText('<script>not accepted');await page.getByLabel('כתובת אימייל (לא חובה)').fill('correct@example.com');await send(page).click();await expect(page.locator('.feedback-success')).toBeVisible();expect(payload.email).toBe('correct@example.com');expect(payload.course_number).toBe('234114');
});

for(const scenario of ['unexpected JSON','HTML error'])test(`unexpected response never shows success: ${scenario}`,async({page})=>{
 await mock(page,async route=>{if(scenario==='unexpected JSON')await respond(route,{});else await route.fulfill({status:500,headers,contentType:'text/html',body:'<html>Temporary outage</html>'});});await form(page);await fill(page);await send(page).click();await expect(page.getByRole('alert')).toContainText('לא הצלחנו לשלוח');await expect(page.locator('.feedback-success')).toHaveCount(0);await expect(page.locator('#feedback-description')).toHaveValue(description);
});

test('reporting a course prefills its number/category while retaining the distinct starting course context',async({page})=>{
 let payload:any;await mock(page,async route=>{payload=route.request().postDataJSON();await respond(route,success);});await page.goto('/?course=02340247');await expect(page.locator('.root-node')).toBeVisible();const child=page.locator('.react-flow__node:not(:has(.root-node))').first();const childId=(await child.locator('.course-link').textContent())!.trim();await child.locator('.node-info').focus();await child.locator('.node-info').press('Enter');await page.getByRole('button',{name:'דיווח על מידע בקורס',exact:true}).click();
 await expect(page.getByLabel('סוג המשוב')).toHaveValue('course-information');await expect(page.getByLabel('מספר קורס (אם רלוונטי)')).toHaveValue(childId);await page.locator('#feedback-description').fill(description);await send(page).click();await expect(page.locator('.feedback-success')).toBeVisible();expect(payload.relevant_course_id).toBe(childId);expect(payload.course_number).toBe(childId);expect(payload.starting_course_id).toBe('02340247');
});

test('direct route, refresh, browser history and About navigation remain within the app',async({page})=>{
 await form(page,'/feedback?courseId=00440102');await expect(page.getByLabel('מספר קורס (אם רלוונטי)')).toHaveValue('00440102');await page.reload();await expect(page.getByRole('heading',{name:'דיווח על תקלה ושליחת משוב'})).toBeVisible();await expect(page.getByLabel('מספר קורס (אם רלוונטי)')).toHaveValue('00440102');await page.getByRole('link',{name:'אודות / About',exact:true}).click();await expect(page.getByRole('heading',{name:'אודות / About'})).toBeVisible();await page.goBack();await expect(page.getByRole('heading',{name:'דיווח על תקלה ושליחת משוב'})).toBeVisible();await page.getByRole('link',{name:'חזרה למפת הקורסים',exact:true}).click();await expect(page.locator('.root-node')).toBeVisible();
});

for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:568}])test(`Hebrew feedback form and bug entry stay accessible at ${viewport.width}px`,async({page},testInfo)=>{
 await page.setViewportSize(viewport);await page.goto('/');await expect(page.locator('.root-node')).toBeVisible();const icon=page.getByRole('link',{name:'דיווח על תקלה או שליחת משוב',exact:true});await expect(icon).toBeInViewport();await icon.focus();await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'דיווח על תקלה ושליחת משוב'})).toBeFocused();expect(await page.locator('.feedback-shell').getAttribute('dir')).toBe('rtl');await page.keyboard.press('Tab');await expect(page.getByLabel('סוג המשוב')).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.feedback-submit').scrollIntoViewIfNeeded();await expect(send(page)).toBeInViewport();const layout=await page.locator('.feedback-submit-row').evaluate(row=>{const bounds=row.getBoundingClientRect();return [...row.children].every(child=>{const box=child.getBoundingClientRect();return box.left>=bounds.left-1&&box.right<=bounds.right+1;});});expect(layout).toBe(true);await page.screenshot({path:testInfo.outputPath(`feedback-${viewport.width}.png`),fullPage:true});
});

test('browser Back restores the prior report course rather than the latest report context',async({page})=>{
 let payload:any;await mock(page,async route=>{payload=route.request().postDataJSON();await respond(route,success);});
 await form(page,'/feedback?courseId=00440102');await page.getByRole('link',{name:'חזרה למפת הקורסים',exact:true}).click();await expect(page.locator('.root-node')).toBeVisible();
 await page.locator('.root-node .node-info').focus();await page.locator('.root-node .node-info').press('Enter');await page.getByRole('button',{name:'דיווח על מידע בקורס',exact:true}).click();await expect(page.locator('#feedback-course')).not.toHaveValue('00440102');
 await page.goBack();await expect(page.locator('.root-node')).toBeVisible();await page.goBack();await expect(page.locator('#feedback-course')).toHaveValue('00440102');await page.locator('#feedback-description').fill(description);await send(page).click();await expect(page.locator('.feedback-success')).toBeVisible();expect(payload.relevant_course_id).toBe('00440102');expect(payload.course_number).toBe('00440102');
});


test('feedback and About links retain the selected root even without writable local storage',async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new Error('Storage unavailable for navigation test');};});
 await page.goto('/?course=00140855');await expect(page.locator('.root-node .course-link')).toHaveText('00140855');await page.locator('.feedback-trigger').click();await expect(page.getByRole('link',{name:'חזרה למפת הקורסים',exact:true})).toHaveAttribute('href','/?course=00140855');
 await page.getByRole('link',{name:'אודות / About',exact:true}).click();await expect(page).toHaveURL(/\/about\?course=00140855$/);await page.reload();await page.getByRole('link',{name:'חזרה למפת הקורסים ←',exact:true}).click();await expect(page.locator('.root-node .course-link')).toHaveText('00140855');
});
