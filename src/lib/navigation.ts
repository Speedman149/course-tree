export type AppRoute = 'tree'|'about'|'feedback';
export function appRoute(location: Pick<Location,'pathname'|'hash'>): AppRoute {
  if(location.pathname.replace(/\/$/,'')==='/feedback'||location.hash==='#/feedback')return 'feedback';
  return location.hash==='#/about'?'about':'tree';
}
/** Same-origin SPA navigation; hash-based About links remain supported. */
export function navigateApp(path:string,state:Record<string,unknown>={}){
  const target=new URL(path,window.location.href);
  if(target.origin!==window.location.origin)return;
  window.history.pushState(state,'',target);
  window.dispatchEvent(new PopStateEvent('popstate'));
}