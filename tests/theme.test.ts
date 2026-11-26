import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {THEME_BOOTSTRAP,THEME_STORAGE_KEY} from '../src/lib/theme-bootstrap';
import {facultyPalette,facultyColor,facultyDisplayColor,NEUTRAL_FACULTY_COLOR} from '../src/lib/faculty-colors';
function harness({saved=null,dark=false,blocked=false,media=true,legacy=false}:{saved?:string|null;dark?:boolean;blocked?:boolean;media?:boolean;legacy?:boolean}={}){
 const attrs=new Map<string,string>(),meta=new Map<string,string>(),values=new Map<string,string>(),writes:string[]=[];
 const events=new Map<string,(e:any)=>void>(),clicks=new Map<string,(e:any)=>void>();let changed=()=>{};
 if(saved!==null)values.set(THEME_STORAGE_KEY,saved);
 class Target{disabled=false;closest(){return this;}}
 const query:any={matches:dark};query[legacy?'addListener':'addEventListener']=legacy?(cb:()=>void)=>changed=cb:(_:string,cb:()=>void)=>changed=cb;
 const window:any={localStorage:{getItem:(key:string)=>{if(blocked)throw Error('blocked');return values.get(key)??null;},setItem:(key:string,value:string)=>{if(blocked)throw Error('blocked');writes.push(key);values.set(key,value);}},addEventListener:(type:string,cb:(e:any)=>void)=>events.set(type,cb)};
 if(media)window.matchMedia=()=>query;
 runInNewContext(THEME_BOOTSTRAP,{window,document:{documentElement:{setAttribute:(k:string,v:string)=>attrs.set(k,v),getAttribute:(k:string)=>attrs.get(k)},querySelector:()=>({setAttribute:(k:string,v:string)=>meta.set(k,v)}),addEventListener:(t:string,cb:(e:any)=>void)=>clicks.set(t,cb)},Element:Target});
 return {theme:()=>attrs.get('data-theme'),meta,values,writes,toggle:()=>clicks.get('click')!({target:new Target()}),system:(dark:boolean)=>{query.matches=dark;changed();},storage:(key:string|null,newValue:string|null)=>events.get('storage')!({key,newValue})};
}
test('first paint follows the system without persisting an implicit preference',()=>{
 for(const dark of [false,true]){const h=harness({dark});assert.equal(h.theme(),dark?'dark':'light');assert.equal(h.meta.get('content'),dark?'#171922':'#7160d3');assert.deepEqual(h.writes,[]);h.system(!dark);assert.equal(h.theme(),dark?'light':'dark');}
});
test('valid explicit preferences override system changes; malformed values never become a theme',()=>{
 for(const saved of ['light','dark']){const h=harness({saved,dark:saved!=='dark'});assert.equal(h.theme(),saved);h.system(saved!=='dark');assert.equal(h.theme(),saved);}
 for(const saved of ['system','DARK','null','__proto__','dark; color:red'])assert.equal(harness({saved,dark:true}).theme(),'dark');
});
test('native theme clicks persist only the independent theme key and update immediately',()=>{
 const h=harness();h.toggle();assert.equal(h.theme(),'dark');assert.equal(h.values.get(THEME_STORAGE_KEY),'dark');h.system(false);assert.equal(h.theme(),'dark');h.toggle();assert.equal(h.theme(),'light');assert.deepEqual(h.writes,[THEME_STORAGE_KEY,THEME_STORAGE_KEY]);assert.ok(!h.values.has('course-tree.progress'));
});
test('cross-tab theme changes synchronize while graph progress changes are ignored',()=>{
 const h=harness({saved:'light',dark:true});h.storage('course-tree.progress',null);assert.equal(h.theme(),'light');h.storage(THEME_STORAGE_KEY,'dark');assert.equal(h.theme(),'dark');h.storage(THEME_STORAGE_KEY,null);assert.equal(h.theme(),'dark');h.system(false);assert.equal(h.theme(),'light');h.storage(null,null);assert.equal(h.theme(),'light');
});
test('blocked storage, unavailable media queries and the legacy media listener remain usable',()=>{
 const h=harness({blocked:true,dark:true});assert.equal(h.theme(),'dark');h.toggle();assert.equal(h.theme(),'light');h.system(true);assert.equal(h.theme(),'light');assert.deepEqual(h.writes,[]);
 assert.equal(harness({media:false}).theme(),'light');const old=harness({legacy:true});old.system(true);assert.equal(old.theme(),'dark');
});
test('early theme code is hash-allowlisted without permitting arbitrary inline JavaScript',()=>{
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));const csp=config.headers.flatMap((r:any)=>r.headers).find((h:any)=>h.key==='Content-Security-Policy').value;
 assert.ok(csp.includes("'sha256-"+createHash('sha256').update(THEME_BOOTSTRAP).digest('base64')+"'"));assert.doesNotMatch(csp,/script-src[^;]*unsafe-inline/);assert.doesNotMatch(THEME_BOOTSTRAP,/<\/script/i);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.ok(html.indexOf('<!--theme:init-->')<html.indexOf('rel="stylesheet"'));assert.doesNotMatch(THEME_BOOTSTRAP,/course-tree\.progress/);
});
const css=readFileSync(new URL('../src/theme.css',import.meta.url),'utf8');
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const luminance=(c:number[])=>c.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast=(a:number[],b:number[])=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const value=(key:string)=>css.match(new RegExp('--'+key+':(#[0-9a-f]{6})(?:;|})','i'))![1];
const oklab=(hex:string)=>{const [r,g,b]=rgb(hex).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4),l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),z=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);return[.2104542553*l+.793617785*m-.0040720468*z,1.9779984951*l-2.428592205*m+.4505937099*z,.0259040371*l+.7827717662*m-.808675766*z];};
const distance=(a:string,b:string)=>Math.hypot(...oklab(a).map((v,i)=>v-oklab(b)[i]));
test('the twelve dark faculty colors are distinct, readable on tinted cards and separate from marked red',()=>{
 const colors=facultyPalette.map(f=>value('faculty-'+f.id));assert.equal(new Set(colors).size,12);
 for(let i=0;i<colors.length;i++){for(const other of colors.slice(i+1))assert.ok(distance(colors[i],other)>=.04,'perceptual faculty separation');assert.ok(distance(colors[i],value('theme-mark-accent'))>=.1,'faculty colors stay separate from marked red');}
 for(const hex of colors){const c=rgb(hex),base=rgb(value('surface-panel')),tint=base.map((v,i)=>v*.94+c[i]*.06);assert.ok(contrast(c,tint)>=4.5,hex+' faculty label contrast');assert.notEqual(hex,value('theme-mark-accent'));}
 assert.equal(facultyColor('cs'),'#7651B5');assert.equal(facultyDisplayColor('cs'),'var(--faculty-cs,#7651B5)');assert.equal(facultyDisplayColor('bad);color:red'),'var(--faculty-neutral,'+NEUTRAL_FACULTY_COLOR+')');
});
test('dark normal text, filled controls and graph indicators meet independent contrast budgets',()=>{
 for(const surface of ['surface-page','surface-panel','surface-subtle','surface-raised','surface-accent','surface-selected','surface-hover','surface-neutral'])for(const text of ['text-primary','text-secondary','text-muted'])assert.ok(contrast(rgb(value(surface)),rgb(value(text)))>=4.5,text+' on '+surface);
 for(const fill of ['accent-fill','accent-fill-hover','success-fill','danger-fill'])assert.ok(contrast(rgb('#ffffff'),rgb(value(fill)))>=4.5,fill);
 for(const edge of ['graph-edge-forward','graph-edge-backward']){const matches=[...css.matchAll(new RegExp('--'+edge+':(#[0-9a-f]{6})','gi'))];assert.ok(contrast(rgb(matches.at(-1)![1]),rgb(value('surface-page')))>=3);}
});
