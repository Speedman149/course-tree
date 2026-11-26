import {THEME_BOOTSTRAP} from '../src/lib/theme-bootstrap';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import ApplicationRoot from '../src/ApplicationRoot';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import type {Plugin} from 'vite';
import {StaticPublicPage} from '../src/components/PublicContent';
import {PUBLIC_PAGES, renderMetadata, renderSitemap, ROBOTS_TXT, ROBOTS_NOINDEX} from '../src/lib/seo';
import {appRoute, type AppRoute} from '../src/lib/navigation';

const head = (route: AppRoute, indexable: boolean) => `<!--seo:head:start-->\n    ${renderMetadata(route,indexable)}\n    <!--seo:head:end-->`;
const body = (route: AppRoute | 'not-found') => `<!--seo:content:start-->${route==='not-found'?renderToString(createElement(StaticPublicPage,{route})):renderToString(createElement(ApplicationRoot,{initialRoute:route}),{identifierPrefix:'branchquest-'})}<!--seo:content:end-->`;
const headPattern = /<!--seo:head:start-->[\s\S]*?<!--seo:head:end-->/;
const bodyPattern = /<!--seo:content:start-->[\s\S]*?<!--seo:content:end-->/;

/** Build public HTML from the existing Vite bundle; no server or new runtime dependency. */
export function seoPlugin(indexable: boolean): Plugin {
  let outDir = '';
  let building = false;
  return {
    name: 'branchquest-public-pages',
    configResolved(config) {outDir=resolve(config.root,config.build.outDir);building=config.command==='build';},
    transformIndexHtml: {order:'pre', handler(html, context) {
      const route = appRoute({pathname: (context.originalUrl ?? context.path).split('?')[0],hash:''});
      return html.replace('<!--theme:init-->',`<script id="branchquest-theme">${THEME_BOOTSTRAP}</script>`).replace(headPattern,head(route,indexable)).replace(bodyPattern,body(route)).replace(/data-initial-route="[^"]*"/,`data-initial-route="${route}"`);
    }},
    async closeBundle() {
      if (!building) return;
      const template = await readFile(resolve(outDir,'index.html'),'utf8');
      if (!headPattern.test(template) || !bodyPattern.test(template)) throw new Error('SEO template markers are missing');
      for (const [route,page] of Object.entries(PUBLIC_PAGES)) {
        const file = resolve(outDir,page.path === '/' ? 'index.html' : page.path.slice(1) + '/index.html');
        await mkdir(dirname(file),{recursive:true});
        await writeFile(file,template.replace(headPattern,head(route as AppRoute,indexable)).replace(bodyPattern,body(route as AppRoute)).replace(/data-initial-route="[^"]*"/,`data-initial-route="${route}"`));
      }
      // A genuine static 404 stays a 404; never boot the tree and turn it into a soft 404.
      const missing = template.replace(headPattern,'<title>העמוד לא נמצא – BranchQuest</title>\n<meta name="robots" content="'+ROBOTS_NOINDEX+'" />').replace(bodyPattern,body('not-found')).replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*rel="modulepreload"[^>]*>/g,'');
      await writeFile(resolve(outDir,'404.html'),missing);
      await writeFile(resolve(outDir,'sitemap.xml'),renderSitemap());
      await writeFile(resolve(outDir,'robots.txt'),ROBOTS_TXT);
    },
  };
}
