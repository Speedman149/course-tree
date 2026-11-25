import test from 'node:test';
import assert from 'node:assert/strict';
import {createConnection} from 'node:net';
import {randomUUID} from 'node:crypto';
import {createFeedbackHandler} from '../server/feedback.ts';
import {RedisFeedbackStore,ADMIT_FEEDBACK,FINISH_FEEDBACK} from '../server/feedback-store.ts';
const port=Number(process.env.FEEDBACK_REDIS_TEST_PORT??16389);
/** Minimal test-only RESP client talks to a real isolated Redis; no mocked Lua or production fallback. */
function command(args){return new Promise((resolve,reject)=>{
 const socket=createConnection({host:'127.0.0.1',port});let buffer=Buffer.alloc(0);
 const parse=(offset=0)=>{
  const end=buffer.indexOf('\r\n',offset);if(end<0)return;
  const type=String.fromCharCode(buffer[offset]),line=buffer.toString('utf8',offset+1,end);let next=end+2;
  if(type==='-')throw new Error(line);
  if(type==='+'||type===':')return {value:type===':'?Number(line):line,next};
  if(type==='$'){const length=Number(line);if(length<0)return {value:null,next};if(buffer.length<next+length+2)return;return {value:buffer.toString('utf8',next,next+length),next:next+length+2};}
  if(type==='*'){const result=[];for(let i=0;i<Number(line);i++){const item=parse(next);if(!item)return;result.push(item.value);next=item.next;}return {value:result,next};}
  throw new Error('Unknown RESP type');
 };
 socket.setTimeout(4000,()=>socket.destroy(new Error('Local Redis test timed out')));
 socket.on('error',reject);socket.on('connect',()=>{const pieces=[Buffer.from('*'+args.length+'\r\n')];for(const value of args){const v=Buffer.from(String(value));pieces.push(Buffer.from('$'+v.length+'\r\n'),v,Buffer.from('\r\n'));}socket.write(Buffer.concat(pieces));});
 socket.on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]);try{const result=parse();if(result){socket.end();resolve(result.value);}}catch(error){socket.destroy();reject(error);}});
});}
const payload=()=>({category:'bug',description:'בדיקת שליחה מאובטחת באמצעות מאגר משותף',submitted_at:'2026-11-25T12:00:00.000Z',submission_id:randomUUID(),email:'student@example.test',_gotcha:''});
function setup(){
 const env={VERCEL:'1',VERCEL_ENV:'production',VERCEL_PROJECT_ID:'redis-test-'+randomUUID(),RESEND_API_KEY:'re_fake',FEEDBACK_TO_EMAIL:'owner@example.test',UPSTASH_REDIS_REST_URL:'https://redis.example.test',UPSTASH_REDIS_REST_TOKEN:'test-only-secret'};
 const calls=[],keys=[],mailById=new Map();let offline=false,ambiguous=false,failConfirmation=false,providerDown=false;
 const http=async(url,init)=>{
  if(String(url)===env.UPSTASH_REDIS_REST_URL){
   if(offline)throw new Error('Simulated store outage');
   const args=JSON.parse(String(init.body));if(args[1]===ADMIT_FEEDBACK)keys.push(args.slice(3,9));
   const result=await command(args);
   if(args[1]===FINISH_FEEDBACK&&args.at(-1)==='sent'&&failConfirmation){failConfirmation=false;throw new Error('Lost Redis success response');}
   return Response.json({result});
  }
  assert.equal(String(url),'https://api.resend.com/emails');calls.push(init);
  if(providerDown)throw new Error('Provider unavailable');
  const key=init.headers['Idempotency-Key'];const previous=mailById.get(key);
  if(previous)assert.equal(previous.body,init.body);else mailById.set(key,{body:init.body,id:randomUUID()});
  if(ambiguous){ambiguous=false;throw new Error('Delivery accepted but response lost');}
  return Response.json({id:mailById.get(key).id});
 };
 const handle=()=>createFeedbackHandler({env,http,log:()=>{}});
 const req=(data=payload(),ip='203.0.113.1',headers={})=>new Request('https://branchquest.app/api/feedback',{method:'POST',headers:{Origin:'https://branchquest.app','Content-Type':'application/json','X-BranchQuest-Feedback':'1','X-Vercel-Forwarded-For':ip,...headers},body:JSON.stringify(data)});
 return {env,http,handle,req,calls,keys,mailById,setProviderDown:v=>{providerDown=v;},setOffline:v=>{offline=v;},setAmbiguous:v=>{ambiguous=v;},setFailConfirmation:v=>{failConfirmation=v;}};
}
test('real Redis is available for atomic integration tests',async()=>assert.equal(await command(['PING']),'PONG'));
test('32 concurrent requests across independent instances cause exactly one delivery',async()=>{
 const s=setup(),data=payload();const results=await Promise.all(Array.from({length:32},()=>s.handle()(s.req(data))));assert.equal(s.mailById.size,1);assert.equal(s.calls.length,1);assert.ok(results.some(r=>r.status===200));assert.ok(results.every(r=>[200,409,429].includes(r.status)));
});
test('same ID with altered content cannot produce a second message',async()=>{
 const s=setup(),data=payload();assert.equal((await s.handle()(s.req(data))).status,200);assert.equal((await s.handle()(s.req({...data,description:'תוכן שונה עם אותו מזהה שליחה'}))).status,409);assert.equal(s.calls.length,1);
});
test('five unique messages per ten minutes; retries do not consume additional quota',async()=>{
 const s=setup(),data=payload();assert.equal((await s.handle()(s.req(data))).status,200);for(let i=0;i<4;i++)assert.equal((await s.handle()(s.req())).status,200);
 const r=await s.handle()(s.req());assert.equal(r.status,429);assert.ok(Number(r.headers.get('Retry-After'))>0);assert.equal((await s.handle()(s.req(data))).status,200);assert.equal(s.calls.length,5);
});
test('daily IP quota survives ten-minute window expiry and untrusted forwarded addresses',async()=>{
 const s=setup();for(let i=0;i<10;i++){if(i===5)await command(['DEL',s.keys[0][2]]);assert.equal((await s.handle()(s.req(payload(),'203.0.113.1',{'X-Forwarded-For':'198.51.100.'+(i+1)}))).status,200);}
 await command(['DEL',s.keys[0][2]]);assert.equal((await s.handle()(s.req())).status,429);assert.equal(s.calls.length,10);
});
test('site-wide daily cap limits rotating IPs across serverless instances',async()=>{
 const s=setup();for(let i=1;i<=50;i++)assert.equal((await s.handle()(s.req(payload(),'203.0.113.'+i))).status,200);
 assert.equal((await s.handle()(s.req(payload(),'203.0.113.51'))).status,429);assert.equal(s.mailById.size,50);
});
test('an ambiguous provider response retries with identical bytes and delivers only once',async()=>{
 const s=setup(),data=payload();s.setAmbiguous(true);assert.equal((await s.handle()(s.req(data))).status,503);assert.equal((await s.handle()(s.req(data))).status,200);assert.equal(s.calls.length,2);assert.equal(s.mailById.size,1);assert.equal(s.calls[0].body,s.calls[1].body);
});
test('lost success confirmation remains safe and becomes an acknowledged duplicate',async()=>{
 const s=setup(),data=payload();s.setFailConfirmation(true);assert.equal((await s.handle()(s.req(data))).status,503);assert.equal((await s.handle()(s.req(data))).status,200);assert.equal(s.calls.length,1);assert.equal(s.mailById.size,1);
});
test('store outage fails closed, and records contain hashes/counters/status only with bounded TTLs',async()=>{
 const s=setup();assert.equal((await s.handle()(s.req())).status,200);
 const record=await command(['HGETALL',s.keys[0][0]]);assert.doesNotMatch(JSON.stringify(record),/student@example|owner@example|בדיקת|203\.0\.113/);
 for(const key of s.keys[0]){const ttl=await command(['TTL',key]);assert.ok(ttl>0&&ttl<=86400);assert.doesNotMatch(key,/203\.0\.113|student@example/);}
 s.setOffline(true);assert.equal((await s.handle()(s.req())).status,503);assert.equal(s.calls.length,1);
});
test('expired lease can recover but an old worker cannot finalize another lease',async()=>{
 const s=setup(),store=new RedisFeedbackStore(s.env.UPSTASH_REDIS_REST_URL,s.env.UPSTASH_REDIS_REST_TOKEN,s.http);
 const prefix='{lease-test-'+randomUUID()+'}',keys=['id','burst','ten','day','global','global-attempts'].map(v=>prefix+':'+v);
 assert.equal((await store.admit(keys,'fingerprint','old',50)).status,'admitted');assert.equal((await store.admit(keys,'fingerprint','new',50)).status,'busy');await command(['HSET',keys[0],'lease_until','0']);assert.equal((await store.admit(keys,'fingerprint','new',50)).status,'admitted');await assert.rejects(store.finish(keys[0],'old','sent'));await store.finish(keys[0],'new','sent');assert.equal((await store.admit(keys,'fingerprint','third',50)).status,'duplicate');
});

test('global attempt budget also caps failed retries with rotating IPs',async()=>{
 const s=setup(),data=payload();s.setProviderDown(true);
 for(let i=0;i<200;i++)assert.equal((await s.handle()(s.req(data,'198.51.100.'+i))).status,503);
 const response=await s.handle()(s.req(data,'198.51.100.201'));assert.equal(response.status,429);assert.equal(s.calls.length,200);assert.ok(Number(response.headers.get('Retry-After'))>0);
});
