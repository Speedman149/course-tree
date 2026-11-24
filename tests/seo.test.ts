import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PUBLIC_PAGES, HOME_TITLE, HOME_DESCRIPTION, WEBSITE_SCHEMA, WEBSITE_JSON_LD, renderMetadata, renderSitemap, ROBOTS_TXT, canonicalURL, indexableBuild} from '../src/lib/seo';
import {StaticPublicPage} from '../src/components/PublicContent';
import {appRoute} from '../src/lib/navigation';
import {redactAnalyticsEvent} from '../src/lib/analytics';
import {feedbackPageURL} from '../src/lib/feedback';

test('BranchQuest homepage metadata matches the requested Hebrew title and description exactly',()=>{
 assert.equal(HOME_TITLE,'BranchQuest – עץ קורסים ותכנון תואר בטכניון');
 assert.equal(HOME_DESCRIPTION,'חקרו את עץ הקורסים של הטכניון, בדקו דרישות קדם, גלו אילו קורסים תוכלו לקחת ותכננו את מסלול הלימודים שלכם.');
 assert.equal(WEBSITE_SCHEMA.name,'BranchQuest');assert.equal(WEBSITE_SCHEMA.url,'https://branchquest.app/');
 assert.deepEqual(JSON.parse(WEBSITE_JSON_LD),WEBSITE_SCHEMA);
 assert.ok(!('potentialAction' in WEBSITE_SCHEMA)); // no fictional search endpoint
});
test('public page canonicals, OG and Twitter metadata are distinct, stable and free of personal state',()=>{
 assert.equal(canonicalURL('tree'),'https://branchquest.app/');assert.equal(canonicalURL('about'),'https://branchquest.app/about');assert.equal(canonicalURL('feedback'),'https://branchquest.app/feedback');
 const titles=new Set();
 for(const route of ['tree','about','feedback'] as const){
  const head=renderMetadata(route,true);titles.add(PUBLIC_PAGES[route].title);
  assert.equal((head.match(/<title>/g)??[]).length,1);assert.equal((head.match(/rel="canonical"/g)??[]).length,1);
  assert.match(head,/og:site_name" content="BranchQuest/);assert.match(head,/twitter:card" content="summary_large_image/);
  assert.match(head,/content="index,follow,max-image-preview:large"/);assert.doesNotMatch(head,/noindex|keywords|course=|courseId=|token=|preview\.vercel/);
  assert.match(renderMetadata(route,false),/content="noindex,nofollow"/);
 }
 assert.equal(titles.size,3);
});
test('indexability is explicit and preview/custom environments cannot be overridden to production',()=>{
 for(const env of [{},{VERCEL_ENV:'preview'},{VERCEL_ENV:'development'},{VERCEL_TARGET_ENV:'staging'},{VERCEL_ENV:'preview',BRANCHQUEST_DEPLOYMENT_ENV:'production'},{VERCEL_ENV:'preview',VERCEL_TARGET_ENV:'production'},{VERCEL_ENV:'production',VERCEL_TARGET_ENV:'staging'}])assert.equal(indexableBuild(env),false);
 for(const env of [{VERCEL_ENV:'production'},{VERCEL_ENV:'production',VERCEL_TARGET_ENV:'production'},{BRANCHQUEST_DEPLOYMENT_ENV:'production'}])assert.equal(indexableBuild(env),true);
});
test('sitemap exposes exactly the three existing public pages and robots allows their assets to be crawled',()=>{
 assert.deepEqual([...renderSitemap().matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]),['https://branchquest.app/','https://branchquest.app/about','https://branchquest.app/feedback']);
 assert.match(ROBOTS_TXT,/User-agent: \*\nAllow: \//);assert.match(ROBOTS_TXT,/Sitemap: https:\/\/branchquest\.app\/sitemap\.xml/);assert.doesNotMatch(ROBOTS_TXT,/Disallow: \//);
});
test('pre-rendered public content is visible semantic Hebrew HTML with honest project context',()=>{
 for(const route of ['tree','about','feedback'] as const){
  const html=renderToStaticMarkup(createElement(StaticPublicPage,{route}));
  assert.equal((html.match(/<h1[ >]/g)??[]).length,1);assert.match(html,/<main/);assert.match(html,/BranchQuest/);
  assert.match(html,/is not affiliated with or endorsed by the Technion/);assert.doesNotMatch(html,/display:none|idk seems|aggregateRating|reviewCount/);
 }
 const about=renderToStaticMarkup(createElement(StaticPublicPage,{route:'about'}));assert.match(about,/Technion course tree/);assert.match(about,/דרישות קדם/);assert.match(about,/קטלוג/);
});
test('clean About routing, legacy aliases and privacy filtering preserve supported page identities',()=>{
 assert.equal(appRoute({pathname:'/about',hash:''}),'about');assert.equal(appRoute({pathname:'/about/',hash:''}),'about');assert.equal(appRoute({pathname:'/',hash:'#/about'}),'about');assert.equal(appRoute({pathname:'/feedback',hash:''}),'feedback');
 assert.equal(redactAnalyticsEvent({type:'pageview',url:'https://branchquest.app/about?email=private@example.com&token=secret#private'})?.url,'https://branchquest.app/about');
 assert.equal(feedbackPageURL('https://branchquest.app/about?course=02340114&token=secret'),'https://branchquest.app/about?course=02340114');
});
test('Vercel retains strong CSP with one exact JSON-LD hash and no duplicated domain redirect rules',()=>{
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 const csp=config.headers[0].headers.find((h:{key:string})=>h.key==='Content-Security-Policy').value;
 const hash=createHash('sha256').update(WEBSITE_JSON_LD).digest('base64');assert.ok(csp.includes(`'sha256-${hash}'`));assert.doesNotMatch(csp,/script-src [^;]*'unsafe-inline'/);
 const guard=config.headers.find((rule:{missing?:unknown})=>rule.missing);assert.deepEqual(guard.missing,[{type:'host',value:'^branchquest\\.app$'}]);assert.match(guard.headers[0].value,/noindex/);
 assert.equal(config.redirects,undefined); // live Vercel domain redirects were already verified
 assert.ok(config.rewrites.some((r:{source:string;destination:string})=>r.source==='/about'&&r.destination==='/about/index.html'));
 assert.ok(config.rewrites.some((r:{source:string;destination:string})=>r.source==='/feedback'&&r.destination==='/feedback/index.html'));
});
