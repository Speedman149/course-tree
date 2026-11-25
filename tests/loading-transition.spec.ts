import {expect,test,type Page} from '@playwright/test';
import {PROGRESS_KEY,PROGRESS_VERSION} from '../src/lib/progress';
import {HOME_DESCRIPTION,HOME_TITLE} from '../src/lib/seo';
const A='00140855',TEAM='03940902';
const devURL=process.env.PLAYWRIGHT_DEV_BASE_URL??'http://127.0.0.1:5174';
const deferred=()=>{let release!:()=>void;const promise=new Promise<void>(resolve=>release=resolve);return{promise,release};};
async function boxes(page:Page){
 return page.evaluate(()=>Object.fromEntries(['.app-header','.graph-canvas','.site-footer'].map(selector=>{const r=document.querySelector(selector)!.getBoundingClientRect();return[selector,{x:r.x,y:r.y,width:r.width,height:r.height}];})));
}
function sameGeometry(before:Awaited<ReturnType<typeof boxes>>,after:Awaited<ReturnType<typeof boxes>>){
 for(const key of Object.keys(before))for(const axis of ['x','y','width','height'] as const)expect(Math.abs(after[key][axis]-before[key][axis]),key+' '+axis).toBeLessThanOrEqual(1);
}
for(const mode of ['development','production'] as const)for(const width of [1440,375])for(const savedFilters of [false,true])test(`${mode} ${width}px${savedFilters?' with saved filters':''}: three cold hard refreshes keep the first paint and hydrated explorer aligned, including throttling`,async({page,baseURL},info)=>{
 test.setTimeout(180_000);const base=mode==='development'?devURL:baseURL!;
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&/hydrat|server rendered|didn't match|Minified React error/i.test(message.text()))errors.push(message.text());});
 await page.setViewportSize({width,height:844});
 await page.addInitScript(({key,version,A,TEAM,savedFilters})=>{
  if(!sessionStorage.getItem('transition-progress')){sessionStorage.setItem('transition-progress','yes');localStorage.setItem(key,JSON.stringify({version,progress:{addedCourseIds:[A,TEAM],expandedForward:[A,'00140889'],hiddenForwardConnections:[A+'->00140856:strong'],markedCourseIds:[A,TEAM],markedCourseQuantities:{[TEAM]:3},facultyIds:savedFilters?['civil']:null,highlightSatisfiedPrerequisites:true}}));}
  (window as any).__transition={shifts:[],firstPaint:null};
  new PerformanceObserver(list=>{for(const e of list.getEntries())if(!(e as any).hadRecentInput)(window as any).__transition.shifts.push({value:(e as any).value,time:e.startTime});}).observe({type:'layout-shift',buffered:true});
  new PerformanceObserver(list=>{if(list.getEntries().some(e=>e.name==='first-contentful-paint')){const header=document.querySelector('.app-header');(window as any).__transition.firstPaint={margin:getComputedStyle(document.body).margin,headerHeight:header?.getBoundingClientRect().height};}}).observe({type:'paint',buffered:true});
 },{key:PROGRESS_KEY,version:PROGRESS_VERSION,A,TEAM,savedFilters});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 let scripts=deferred(),data=deferred(),dataStarted=deferred();
 await page.route('**/*',async route=>{
  if(route.request().url().includes('/_vercel/'))return route.fulfill({contentType:'text/javascript',body:''});
  if(route.request().resourceType()==='script')await scripts.promise;
  if(/\/data\/(courses|catalogs)\.json(?:\?|$)/.test(route.request().url())){dataStarted.release();await data.promise;}
  await route.continue();
 });
 const measures=[];
 try{
  for(let round=0;round<3;round++){
   scripts=deferred();data=deferred();dataStarted=deferred();
   await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:round?150:0,downloadThroughput:round?250_000:-1,uploadThroughput:round?100_000:-1,connectionType:round?'cellular3g':'wifi'});
   await cdp.send('Emulation.setCPUThrottlingRate',{rate:round?2:1});
   if(round===0)await page.goto(base+'/?course='+A,{waitUntil:'commit'});else await page.reload({waitUntil:'commit'});
   await expect(page.locator('.initial-explorer-shell')).toBeVisible();
   await page.waitForFunction(()=>getComputedStyle(document.body).margin==='0px');await page.evaluate(()=>document.fonts.ready);
   await page.waitForFunction(()=>(window as any).__transition.firstPaint!==null);
   if(width>640){const button=await page.locator('.map-actions button.initial-desktop-action').first().boundingBox();expect(button?.height??0).toBeGreaterThanOrEqual(26);expect(button?.width??0).toBeGreaterThan(50);}
   const first=await boxes(page);await expect(page.locator('.graph-canvas .initial-explorer-description')).toBeVisible();await expect(page.locator('.graph-canvas')).toContainText(HOME_DESCRIPTION);await expect(page.locator('.seo-static-shell,.seo-static-content')).toHaveCount(0);
   expect(await page.evaluate(()=>(window as any).__transition.firstPaint.margin)).toBe('0px');
   expect(await page.evaluate(()=>(window as any).__transition.firstPaint.headerHeight)).toBe(first['.app-header'].height);
   if(round===1)await page.screenshot({path:info.outputPath(`first-paint-${mode}-${width}.png`),fullPage:true});
   scripts.release();await dataStarted.promise;
   await expect(page.locator('.initial-explorer-shell')).toBeVisible();sameGeometry(first,await boxes(page));
   const boot=await page.evaluate(()=>(window as any).__transition);const bootCLS=boot.shifts.reduce((sum:number,e:{value:number})=>sum+e.value,0);expect(bootCLS).toBeLessThan(.02);
   data.release();await expect(page.locator(`.react-flow__node[data-id="${A}"]`)).toHaveCount(1,{timeout:45_000});await expect(page.locator('.initial-explorer-shell')).toHaveCount(0);await expect(page).toHaveTitle(HOME_TITLE);
   const interactive=await boxes(page);
   if(savedFilters){
    // Restoring personal filters deliberately adds the existing summary above the canvas.
    // It is separate from the identical prerender/hydration frames checked above.
    const summary=await page.locator('.active-filter-summary').evaluate(el=>{const css=getComputedStyle(el);return el.getBoundingClientRect().height+parseFloat(css.marginTop)+parseFloat(css.marginBottom);});
    sameGeometry({'.app-header':first['.app-header'],'.site-footer':first['.site-footer']},{'.app-header':interactive['.app-header'],'.site-footer':interactive['.site-footer']});
    expect(Math.abs(interactive['.graph-canvas'].y-first['.graph-canvas'].y-summary)).toBeLessThanOrEqual(1);
    expect(Math.abs(interactive['.graph-canvas'].y+interactive['.graph-canvas'].height-first['.graph-canvas'].y-first['.graph-canvas'].height)).toBeLessThanOrEqual(1);
   }else{
    await expect(page.locator('.active-filter-summary')).toHaveCount(0);sameGeometry(first,interactive);
   }
   const progress=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'{}').progress,PROGRESS_KEY);expect(progress.markedCourseQuantities).toEqual({[TEAM]:3});expect(progress.markedCourseIds).toEqual([A,TEAM]);expect(progress.addedCourseIds).toEqual([A,TEAM]);expect(progress.hiddenForwardConnections).toEqual([A+'->00140856:strong']);if(savedFilters)expect(progress.facultyIds).toEqual(['civil']);else expect(progress.facultyIds).toBeNull();expect(progress.highlightSatisfiedPrerequisites).toBe(true);
   if(round===1)await page.screenshot({path:info.outputPath(`interactive-${mode}-${width}.png`),fullPage:true});
   measures.push({round,throttled:round>0,bootCLS,first,interactive:await boxes(page)});
  }
 }finally{scripts.release();data.release();await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await cdp.detach();}
 await info.attach('refresh-measurements',{body:JSON.stringify(measures,null,2),contentType:'application/json'});expect(errors).toEqual([]);
});
for(const mode of ['development','production'] as const)for(const size of [{width:1440,height:900},{width:375,height:844},{width:320,height:568}])test(`${mode} About ${size.width}px: title is reachable from the top and footer About stays a text link`,async({page,baseURL},info)=>{
 const base=mode==='development'?devURL:baseURL!;await page.setViewportSize(size);await page.route('**/_vercel/**',route=>route.fulfill({contentType:'text/javascript',body:''}));
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/about');await expect(page.getByRole('heading',{name:'אודות / About',exact:true})).toBeInViewport();await page.waitForFunction(()=>document.querySelectorAll('.site-disclaimer').length===1);
 for(let round=0;round<2;round++){
  if(round){await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.site-disclaimer').length===1);}
  await expect(page.getByRole('heading',{name:'אודות / About',exact:true})).toBeInViewport();
  const top=await page.locator('.about-content').evaluate(el=>({scroll:el.scrollTop,container:el.getBoundingClientRect().top,first:el.firstElementChild!.getBoundingClientRect().top,title:el.querySelector('h1')!.getBoundingClientRect().top}));expect(top.scroll).toBe(0);expect(top.first).toBeGreaterThanOrEqual(top.container);expect(top.title).toBeGreaterThanOrEqual(top.container);
 }
 const link=page.locator('.site-footer').getByRole('link',{name:'אודות / About',exact:true});await expect(link).toHaveCSS('text-decoration-line','underline');await expect(link).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await expect(link).toHaveCSS('border-top-width','0px');
 await page.screenshot({path:info.outputPath(`about-top-${mode}-${size.width}.png`),fullPage:true});
 await page.goto(base+'/feedback');await expect(page.locator('form')).toBeVisible();await page.locator('.site-footer').scrollIntoViewIfNeeded();await page.locator('.site-footer').getByRole('link',{name:'אודות / About',exact:true}).click();await expect(page.getByRole('heading',{name:'אודות / About',exact:true})).toBeInViewport();expect(await page.evaluate(()=>scrollY)).toBe(0);expect(await page.locator('.about-content').evaluate(el=>el.scrollTop)).toBe(0);expect(errors).toEqual([]);
});

for(const mode of ['development','production'] as const)test(`${mode}: an early About back link preserves the course before the interactive module loads, without storage`,async({page,baseURL})=>{
 const base=mode==='development'?devURL:baseURL!;const moduleReady=deferred(),moduleRequested=deferred();
 await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new Error('Storage unavailable');};});
 await page.route('**/_vercel/**',route=>route.fulfill({contentType:'text/javascript',body:''}));
 await page.route(/InteractiveApplication/,async route=>{moduleRequested.release();await moduleReady.promise;await route.continue();});
 try{
  await page.goto(base+'/about?course='+A);await moduleRequested.promise;
  await expect(page.locator('.about-back')).toHaveAttribute('href','/');
  await page.locator('.about-back').click();await expect(page).toHaveURL(new RegExp('/\\?course='+A+'$'));
  moduleReady.release();await expect(page.locator('.course-node.is-added .course-link')).toHaveText(A);
 }finally{moduleReady.release();}
});
