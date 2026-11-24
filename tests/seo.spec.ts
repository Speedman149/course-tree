import {expect, test, type Page} from '@playwright/test';
import {HOME_TITLE, HOME_DESCRIPTION, PUBLIC_PAGES, WEBSITE_SCHEMA} from '../src/lib/seo';
import {PROGRESS_KEY, PROGRESS_VERSION} from '../src/lib/progress';

const A='00140855', TEAM='03940902';
async function primaryDomain(page:Page){
 // Verify production-host client behavior entirely against local artifacts, never the live site.
 const fixture=test.info().project.use.baseURL as string;
 await page.route('https://branchquest.app/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.startsWith('/_vercel/'))return route.fulfill({contentType:'text/javascript',body:''});
  const response=await route.fetch({url:fixture+url.pathname+url.search,headers:{...route.request().headers(),host:'branchquest.app'}});
  await route.fulfill({response});
 });
}
for(const route of ['tree','about','feedback'] as const)test(`public ${route} metadata and meaningful content exist without JavaScript`,async({browser,baseURL},info)=>{
 const context=await browser.newContext({baseURL,javaScriptEnabled:false,viewport:{width:320,height:720}});const page=await context.newPage();
 const response=await page.goto(PUBLIC_PAGES[route].path);expect(response?.status()).toBe(200);
 await expect(page).toHaveTitle(PUBLIC_PAGES[route].title);await expect(page.locator('html')).toHaveAttribute('lang','he');await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await expect(page.locator('main h1')).toHaveCount(1);await expect(page.locator('main')).toBeVisible();
 await expect(page.locator('meta[name="description"]')).toHaveAttribute('content',PUBLIC_PAGES[route].description);
 await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://branchquest.app'+PUBLIC_PAGES[route].path);
 await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content','BranchQuest');await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content','summary_large_image');
 expect(JSON.parse(await page.locator('#website-jsonld').textContent()??'{}')).toEqual(WEBSITE_SCHEMA);
 await page.locator('.mobile-site-disclaimer>summary').click();await expect(page.locator('.site-disclaimer:visible')).toContainText('is not affiliated with or endorsed by the Technion');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(route==='tree'){await expect(page.locator('main')).toContainText(HOME_DESCRIPTION);expect(await page.locator('noscript').textContent()).toBe('יש להפעיל JavaScript כדי לחפש קורסים ולהשתמש במפה האינטראקטיבית.');}
 await page.screenshot({path:info.outputPath(`static-${route}-320.png`),fullPage:true});await context.close();
});
test('production pages allow Googlebot and non-primary hosts receive noindex headers',async({request})=>{
 for(const path of ['/','/about','/feedback']){
  const response=await request.get(path,{headers:{host:'branchquest.app','user-agent':'Googlebot'}});expect(response.status()).toBe(200);expect(response.headers()['x-robots-tag']).toBeUndefined();expect(await response.text()).toContain('name="robots" content="index,follow,max-image-preview:large"');
  for(const host of ['branchquest-git-test.vercel.app','staging.branchquest.app','localhost','branchquestXapp','branchquest.app.evil.example']){
   const preview=await request.get(path,{headers:{host}});expect(preview.status()).toBe(200);expect(preview.headers()['x-robots-tag']).toContain('noindex');
  }
 }
});
test('sitemap, robots, sharing image and real 404 responses are served correctly',async({request,page})=>{
 const sitemap=await request.get('/sitemap.xml');expect(sitemap.status()).toBe(200);expect(sitemap.headers()['content-type']).toContain('application/xml');
 const urls=[...(await sitemap.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);expect(urls).toEqual(['https://branchquest.app/','https://branchquest.app/about','https://branchquest.app/feedback']);
 const robots=await request.get('/robots.txt');expect(robots.status()).toBe(200);expect(await robots.text()).toContain('Allow: /');expect(await robots.text()).toContain('Sitemap: https://branchquest.app/sitemap.xml');
 const image=await request.get('/og-image.png');expect(image.status()).toBe(200);expect(image.headers()['content-type']).toContain('image/png');const bytes=await image.body();expect(bytes.readUInt32BE(16)).toBe(1200);expect(bytes.readUInt32BE(20)).toBe(630);
 const missing=await page.goto('/missing-public-page');expect(missing?.status()).toBe(404);await expect(page.getByRole('heading',{name:'העמוד לא נמצא'})).toBeVisible();await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex,nofollow');await expect(page.locator('script[type="module"]')).toHaveCount(0);await expect(page.locator('.react-flow')).toHaveCount(0);
});
for(const width of [1440,320])test(`SPA metadata changes and returns without losing graph, quantities or filters at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:width===320?720:1000});await primaryDomain(page);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({key,version,A,TEAM})=>{if(sessionStorage.getItem('seo-seed'))return;sessionStorage.setItem('seo-seed','1');localStorage.setItem(key,JSON.stringify({version,progress:{primaryCourseId:A,addedCourseIds:[A,TEAM],expandedForward:[A,'00140889'],hiddenForwardConnections:[A+'->00140856:strong'],markedCourseIds:[A,TEAM],markedCourseQuantities:{[TEAM]:3},facultyIds:['civil'],highlightSatisfiedPrerequisites:true}}));},{key:PROGRESS_KEY,version:PROGRESS_VERSION,A,TEAM});
 await page.goto('https://branchquest.app/?course='+A);await expect(page.locator(`.react-flow__node[data-id="${A}"] .course-link`)).toHaveText(A);await expect(page).toHaveTitle(HOME_TITLE);
 await expect(page.locator('meta[name="description"]')).toHaveAttribute('content',HOME_DESCRIPTION);await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','index,follow,max-image-preview:large');
 await expect(page.getByRole('link',{name:'BranchQuest — לדף הבית'})).toBeVisible();
 await page.getByRole('link',{name:'אודות / About',exact:true}).click();await expect(page).toHaveURL('https://branchquest.app/about?course='+A);await expect(page).toHaveTitle(PUBLIC_PAGES.about.title);await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://branchquest.app/about');
 await expect(page.getByRole('heading',{name:'דרישות קדם ומפת קורסים בטכניון'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`about-${width}.png`),fullPage:true});
 await page.getByRole('link',{name:'חזרה למפת הקורסים ←',exact:true}).click();await expect(page).toHaveTitle(HOME_TITLE);await expect(page.locator(`.react-flow__node[data-id="${A}"]`)).toHaveCount(1);
 await page.getByRole('link',{name:'דיווח על תקלה או שליחת משוב',exact:true}).click();await expect(page).toHaveTitle(PUBLIC_PAGES.feedback.title);await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://branchquest.app/feedback');await expect(page.getByRole('heading',{name:'דיווח על תקלה ושליחת משוב'})).toBeVisible();
 await page.goBack();await expect(page).toHaveTitle(HOME_TITLE);
 const state=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'{}').progress,PROGRESS_KEY);
 expect(state.markedCourseQuantities).toEqual({[TEAM]:3});expect(state.markedCourseIds).toEqual([A,TEAM]);expect(state.addedCourseIds).toEqual([A,TEAM]);expect(state.hiddenForwardConnections).toEqual([A+'->00140856:strong']);expect(state.facultyIds).toEqual(['civil']);expect(state.highlightSatisfiedPrerequisites).toBe(true);
 await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);await expect(page.locator('meta[name="description"]')).toHaveCount(1);expect(errors).toEqual([]);
});
for(const legacy of ['about','feedback'])test(`legacy hash ${legacy} links upgrade to clean URLs and retain query parameters`,async({page})=>{
 await page.goto('/?course='+A+'&utm_source=legacy#/'+legacy);await expect.poll(()=>new URL(page.url()).pathname).toBe('/'+legacy);expect(new URL(page.url()).searchParams.get('course')).toBe(A);expect(new URL(page.url()).searchParams.get('utm_source')).toBe('legacy');
 await expect(page).toHaveTitle(PUBLIC_PAGES[legacy as 'about'|'feedback'].title);await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://branchquest.app/'+legacy);await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex,nofollow');
});
