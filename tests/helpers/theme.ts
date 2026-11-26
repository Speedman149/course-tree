import type {Page} from '@playwright/test';
/** Independent rendered-color audit: composites actual CSS backgrounds and measures visible text. */
export async function auditDark(page:Page,scope='body'){
 // Audit the settled presentation, including an ancestor overlay's fade, rather than an entry frame.
 await page.locator(scope).evaluate(async root=>{
  const motion=new Set(root.getAnimations({subtree:true}));let ancestor=root.parentElement;
  while(ancestor){for(const animation of ancestor.getAnimations())motion.add(animation);ancestor=ancestor.parentElement;}
  await Promise.all([...motion].filter(a=>a.playState==='running'&&Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>undefined)));
 });
 return page.locator(scope).evaluate(root=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d',{willReadFrequently:true})!,cache=new Map<string,number[]>();
  const rgba=(color:string)=>{if(cache.has(color))return cache.get(color)!;ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);const a=[...ctx.getImageData(0,0,1,1).data];a[3]/=255;cache.set(color,a);return a;};
  const lum=(c:number[])=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const composite=(fg:number[],bg:number[])=>bg.map((v,i)=>i===3?1:fg[i]*fg[3]+v*(1-fg[3]));
  const failures:{selector:string;text:string;ratio:number;color:string;background:number[]}[]=[],bright:string[]=[];
  for(const el of [root,...root.querySelectorAll('*')]){
   if(!(el instanceof HTMLElement))continue;const s=getComputedStyle(el),r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
   if(r.width<=1||r.height<=1||x<0||x>innerWidth||y<0||y>innerHeight||s.visibility==='hidden'||s.display==='none')continue;
   const top=document.elementFromPoint(x,y);if(top&&!el.contains(top)&&top!==el)continue;
   const ancestors:Element[]=[];let a:Element|null=el,disabled=false;
   while(a){ancestors.unshift(a);if(a.hasAttribute('disabled')||a.getAttribute('aria-disabled')==='true'||Number(getComputedStyle(a).opacity)<.7)disabled=true;a=a.parentElement;}
   if(disabled)continue;
   const bg=ancestors.reduce((b,a)=>composite(rgba(getComputedStyle(a).backgroundColor),b),[255,255,255,1]);
   const own=rgba(s.backgroundColor);if(own[3]>.9&&lum(own)>.65&&r.width*r.height>600)bright.push(el.className||el.tagName);
   const text=[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim();if(!text)continue;
   const fg=composite(rgba(s.color),bg),l1=lum(fg),l2=lum(bg),ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05),large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&parseFloat(s.fontWeight)>=700);
   if(ratio<(large?3:4.5)-.02)failures.push({selector:el.tagName+'.'+el.className,text:text.slice(0,90),ratio:Number(ratio.toFixed(2)),color:s.color,background:bg});
  }
  return {failures,bright:[...new Set(bright)]};
 });
}
