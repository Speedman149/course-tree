import {createHmac,randomUUID} from 'node:crypto';
import {isIP} from 'node:net';
import {FEEDBACK_CATEGORIES,feedbackPageURL,validCourseNumber,validateFeedback,type FeedbackErrors} from '../src/lib/feedback.js';
import {RedisFeedbackStore,type FeedbackStore} from './feedback-store.js';
export const FEEDBACK_SENDER='BranchQuest <feedback@branchquest.app>';
export const MAX_FEEDBACK_BYTES=32768;
export type FeedbackEnvironment=Record<string,string|undefined>;
interface Options {env?:FeedbackEnvironment;http?:typeof fetch;store?:FeedbackStore;log?:(code:string)=>void}
const json=(status:number,body:unknown,extra:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow',...extra}});
const fail=(status:number,code:string,extra:Record<string,string>={})=>json(status,{ok:false,errors:[{code}]},extra);
const digest=(secret:string,purpose:string,value:string)=>createHmac('sha256',secret).update(purpose+'\0'+value).digest('hex');
const emailAddress=(value:string)=>value.length<=254&&/^[^\s@<>(),;:\[\]\\"\x00-\x1f\x7f]+@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,63}$/.test(value)&&value.split('@').length===2&&!value.split('@')[1].includes('..');
/** Normalize IPv6 to /64, including equivalent spellings; IPv4-mapped IPv6 uses its IPv4 key. */
export function feedbackIpKey(value:string):string|null {
 if(value.includes('%'))return null;
 if(isIP(value)===4)return value;
 if(isIP(value)!==6)return null;
 const canonical=new URL(`http://[${value}]/`).hostname.slice(1,-1);
 const [left,right]=canonical.split('::');const a=left?left.split(':'):[],b=right?right.split(':'):[];
 const parts=right===undefined?a:[...a,...Array(8-a.length-b.length).fill('0'),...b];
 const blocks=parts.map(v=>parseInt(v,16));
 if(blocks.slice(0,5).every(v=>v===0)&&blocks[5]===65535)return [blocks[6]>>8,blocks[6]&255,blocks[7]>>8,blocks[7]&255].join('.');
 return blocks.slice(0,4).map(v=>v.toString(16).padStart(4,'0')).join(':')+'/64';
}
export function feedbackOrigins(env:FeedbackEnvironment,requestURL:string):Set<string>{
 const origins=new Set(['https://branchquest.app']);
 if(env.VERCEL_ENV!=='production')for(const host of [env.VERCEL_URL,env.VERCEL_BRANCH_URL])if(host&&/^[a-z0-9][a-z0-9.-]*\.vercel\.app$/.test(host))origins.add('https://'+host);
 const url=new URL(requestURL);
 if(!env.VERCEL&&env.NODE_ENV!=='production'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))origins.add(url.origin);
 if(env.VERCEL_ENV==='development'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))origins.add(url.origin);
 return origins;
}
async function readBody(request:Request):Promise<unknown>{
 const length=request.headers.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>MAX_FEEDBACK_BYTES))throw new Error('BODY_TOO_LARGE');
 const reader=request.body?.getReader();if(!reader)throw new Error('BAD_REQUEST');
 let bytes=0;const chunks:Uint8Array[]=[];let timer:ReturnType<typeof setTimeout>|undefined;
 const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('BODY_TIMEOUT')),3000);});
 try{
  while(true){const {done,value}=await Promise.race([reader.read(),deadline]);if(done)break;bytes+=value.byteLength;if(bytes>MAX_FEEDBACK_BYTES)throw new Error('BODY_TOO_LARGE');chunks.push(value);}
  const body=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));
 }finally{clearTimeout(timer);void reader.cancel().catch(()=>{});}
}
const limits:Record<string,number>={category:40,description:5000,course_number:8,email:254,category_label:80,page_url:2048,source_page_url:2048,source_route:20,submitted_at:40,user_agent:500,starting_course_id:8,relevant_course_id:8,app_version:80,build_id:40,_gotcha:300,submission_id:36};
function validateBody(raw:unknown,origins:Set<string>){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const source=raw as Record<string,unknown>;
 for(const key of Object.keys(source))if(!Object.hasOwn(limits,key)||typeof source[key]!=='string'||(source[key] as string).length>limits[key])return null;
 const field=(key:string)=>typeof source[key]==='string'?(source[key] as string).trim():'';
 const values={category:field('category'),description:field('description'),course_number:field('course_number'),email:field('email')};
 const errors=validateFeedback(values);if(values.email&&!emailAddress(values.email))errors.email='invalid';
 for(const name of ['starting_course_id','relevant_course_id'])if(field(name)&&!validCourseNumber(field(name)))return null;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(field('submission_id')))return null;
 if(field('source_route')&&!['tree','feedback','about'].includes(field('source_route')))return null;
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(field('submitted_at'))||!Number.isFinite(Date.parse(field('submitted_at'))))return null;
 if(field('build_id')&&!/^[0-9a-f]{7,40}$/i.test(field('build_id')))return null;
 const url=(key:string)=>{const clean=feedbackPageURL(field(key));try{return origins.has(new URL(clean).origin)?clean:'';}catch{return '';}};
 const context={page_url:url('page_url'),source_page_url:url('source_page_url'),source_route:field('source_route'),submitted_at:field('submitted_at'),user_agent:field('user_agent'),starting_course_id:field('starting_course_id'),relevant_course_id:field('relevant_course_id'),app_version:field('app_version'),build_id:field('build_id')};
 return {values,errors,context,id:field('submission_id'),honeypot:field('_gotcha')};
}
function fieldErrors(errors:FeedbackErrors){return Object.keys(errors).map(field=>({field,code:'VALIDATION_ERROR'}));}
export function createFeedbackHandler(options:Options={}){
 return async function feedback(request:Request):Promise<Response>{
  const env=options.env??process.env,http=options.http??fetch,log=options.log??((code:string)=>console.warn('[feedback]',code));
  if(request.method!=='POST')return fail(405,'METHOD_NOT_ALLOWED',{Allow:'POST'});
  const origins=feedbackOrigins(env,request.url),origin=request.headers.get('origin');
  if(!origin||!origins.has(origin)||request.headers.get('sec-fetch-site')==='cross-site')return fail(403,'FORBIDDEN');
  if(request.headers.get('x-branchquest-feedback')!=='1'||!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type')??''))return fail(415,'UNSUPPORTED_MEDIA_TYPE');
  let raw:unknown;try{raw=await readBody(request);}catch(error){return fail(error instanceof Error&&error.message==='BODY_TOO_LARGE'?413:400,'BAD_REQUEST');}
  const data=validateBody(raw,origins);if(!data)return fail(400,'BAD_REQUEST');
  if(Object.keys(data.errors).length)return json(422,{ok:false,errors:fieldErrors(data.errors)});
  // Quietly discard the existing hidden spam trap; never contact the mail provider.
  if(data.honeypot)return json(200,{ok:true});
  const key=env.RESEND_API_KEY,to=env.FEEDBACK_TO_EMAIL?.trim(),redisURL=env.UPSTASH_REDIS_REST_URL??env.KV_REST_API_URL,redisToken=env.UPSTASH_REDIS_REST_TOKEN??env.KV_REST_API_TOKEN;
  let validRedis=false;try{const url=new URL(redisURL??'');validRedis=url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash;}catch{/* Fail closed. */}
  if(!key||key.length>500||!to||!emailAddress(to)||!redisURL||!redisToken||!validRedis){log('configuration_unavailable');return fail(503,'UNAVAILABLE');}
  let ip:string|null=null;
  if(env.VERCEL&&env.VERCEL_ENV!=='development')ip=feedbackIpKey(request.headers.get('x-vercel-forwarded-for')??'');
  else if(['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname))ip='local-development';
  if(!ip){log('trusted_ip_unavailable');return fail(503,'UNAVAILABLE');}
  const category=FEEDBACK_CATEGORIES.find(c=>c.value===data.values.category)!;
  const text=[`BranchQuest — ${category.label}`,'',data.values.description,'',
   `מספר קורס: ${data.values.course_number||'לא צוין'}`,`אימייל לפנייה חוזרת: ${data.values.email||'משוב אנונימי'}`,
   '', 'פרטים טכניים שנמסרו על ידי הדפדפן:',...Object.entries(data.context).map(([name,value])=>`${name}: ${value||'לא זמין'}`)].join('\n');
  const email={from:FEEDBACK_SENDER,to:[to],subject:`BranchQuest — ${category.label}`,text,...(data.values.email?{reply_to:data.values.email}:{})};
  const fingerprint=digest(redisToken,'payload',JSON.stringify(email));
  const scope=env.VERCEL_ENV==='production'?'production':env.VERCEL?'preview':'development';
  const prefix=`{branchquest-feedback-${digest(redisToken,'scope',scope+'|'+(env.VERCEL_PROJECT_ID??'')).slice(0,16)}}`;
  const submissionKey=prefix+':submission:'+digest(redisToken,'submission',data.id),ipHash=digest(redisToken,'ip',ip);
  const keys=[submissionKey,prefix+':burst:'+ipHash,prefix+':ten-minutes:'+ipHash,prefix+':day:'+ipHash,prefix+':global-day',prefix+':global-attempts'];
  const token=randomUUID(),store=options.store??new RedisFeedbackStore(redisURL,redisToken,http);
  let admitted;
  try{admitted=await store.admit(keys,fingerprint,token,scope==='production'?50:10);}catch{log('protection_unavailable');return fail(503,'UNAVAILABLE');}
  if(admitted.status==='duplicate')return json(200,{ok:true});
  if(admitted.status==='limited')return fail(429,'RATE_LIMITED',{'Retry-After':String(Math.max(1,admitted.retryAfter))});
  if(admitted.status==='busy')return fail(409,'IN_PROGRESS',{'Retry-After':'2'});
  if(admitted.status==='conflict')return fail(409,'IDEMPOTENCY_CONFLICT');
  if(admitted.status!=='admitted')return fail(503,'UNAVAILABLE');
  try{
   const response=await http('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
    headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':'branchquest-feedback/'+digest(redisToken,'resend',prefix+'|'+data.id)},body:JSON.stringify(email)});
   if(!response.ok)throw new Error('delivery_unavailable');
   const body=await response.json() as {id?:unknown};if(!body||typeof body.id!=='string'||!body.id.length||body.id.length>200)throw new Error('delivery_unavailable');
   await store.finish(submissionKey,token,'sent');
   return json(200,{ok:true});
  }catch{
   // An ambiguous delivery must retain the same Resend idempotency key on retry.
   try{await store.finish(submissionKey,token,'retry');}catch{/* The lease expires; Redis remains authoritative. */}
   log('delivery_or_confirmation_unavailable');return fail(503,'UNAVAILABLE');
  }
 };
}
export const handleFeedback=createFeedbackHandler();
