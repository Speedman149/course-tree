export type AppRoute = 'tree'|'about'|'feedback';
export function appRoute(location: Pick<Location,'pathname'|'hash'>): AppRoute {
  if(location.pathname.replace(/\/$/,'')==='/feedback'||location.hash==='#/feedback')return 'feedback';
  return location.pathname.replace(/\/$/,'')==='/about'||location.hash==='#/about'?'about':'tree';
}
/** Same-origin SPA navigation; hash-based About links remain supported. */
export function navigateApp(path:string,state:Record<string,unknown>={}){
  if(typeof path!=='string'||path.length>8192)return;
  try {
    const target=new URL(path,window.location.href);
    if(!['http:','https:'].includes(target.protocol)||target.origin!==window.location.origin)return;
    window.history.pushState(state,'',target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  } catch {
    // Invalid URLs and unavailable history leave the current route intact.
  }
}
/** Upgrade old fragment links without a reload, retaining query parameters and history state. */
export function upgradeLegacyRoute() {
  if (window.location.pathname !== '/' || !['#/about','#/feedback'].includes(window.location.hash)) return;
  const target = new URL(window.location.href);
  target.pathname = target.hash === '#/about' ? '/about' : '/feedback';
  target.hash = '';
  window.history.replaceState(window.history.state,'',target);
}
