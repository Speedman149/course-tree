import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createFeedbackHandler,feedbackIpKey,feedbackOrigins,MAX_FEEDBACK_BYTES,FEEDBACK_SENDER,type FeedbackEnvironment} from '../server/feedback';
import {RedisFeedbackStore,ADMIT_FEEDBACK,FINISH_FEEDBACK,type FeedbackStore,type Admission} from '../server/feedback-store';
import {submitFeedback,FeedbackSubmissionError} from '../src/lib/feedback';
const env:FeedbackEnvironment={VERCEL:'1',VERCEL_ENV:'production',VERCEL_PROJECT_ID:'test-project',RESEND_API_KEY:'re_server-only-key',FEEDBACK_TO_EMAIL:'private-recipient@example.test',UPSTASH_REDIS_REST_URL:'https://redis.example.test',UPSTASH_REDIS_REST_TOKEN:'server-only-redis-token'};
const body=()=>({category:'bug',description:'תיאור מפורט של תקלה במפת הקורסים',submitted_at:'2026-11-25T12:00:00.000Z',submission_id:randomUUID(),_gotcha:'',page_url:'https://branchquest.app/feedback?email=private&course=02340114#secret',source_page_url:'https://branchquest.app/?course=02340247&token=secret',source_route:'tree',user_agent:'Test browser',app_version:'1.0.0',build_id:'abcdef1'});
function request(data:unknown=body(),headers:Record<string,string>={},url='https://branchquest.app/api/feedback'){
 return new Request(url,{method:'POST',headers:{Origin:new URL(url).origin,'Content-Type':'application/json','X-BranchQuest-Feedback':'1','X-Vercel-Forwarded-For':'203.0.113.7',...headers},body:JSON.stringify(data)});
}
function fixture(options:{env?:FeedbackEnvironment;admission?:Admission;providerStatus?:number;providerBody?:unknown;rejectMail?:boolean;rejectStore?:boolean;rejectFinish?:boolean}={}){
 const calls:{url:string;init:RequestInit}[]=[],keys:string[][]=[],logs:string[]=[],finishes:string[]=[];
 const store:FeedbackStore={async admit(k){keys.push(k);if(options.rejectStore)throw new Error('private store outage');return options.admission??{status:'admitted',retryAfter:0};},async finish(_k,_t,status){finishes.push(status);if(options.rejectFinish)throw new Error('private confirmation outage');}};
 const http=(async(url,init)=>{calls.push({url:String(url),init:init!});if(options.rejectMail)throw new Error('private delivery details');return Response.json(options.providerBody??{id:randomUUID()},{status:options.providerStatus??200});}) as typeof fetch;
 return {handle:createFeedbackHandler({env:options.env??env,http,store,log:code=>logs.push(code)}),calls,keys,logs,finishes};
}
test('native Vercel function sends one fixed-recipient plaintext email with sanitized context',async()=>{
 const f=fixture(),r=await f.handle(request());assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true});assert.equal(f.calls.length,1);
 const {url,init}=f.calls[0],mail=JSON.parse(String(init.body));assert.equal(url,'https://api.resend.com/emails');assert.equal(mail.from,FEEDBACK_SENDER);assert.deepEqual(mail.to,[env.FEEDBACK_TO_EMAIL]);assert.equal(mail.reply_to,undefined);assert.equal(mail.html,undefined);assert.match(mail.subject,/BranchQuest/);assert.match(mail.text,/תיאור מפורט/);assert.doesNotMatch(mail.text,/email=private|token=secret|#secret/);assert.match(mail.text,/course=02340247/);assert.equal((init.headers as Record<string,string>).Authorization,'Bearer '+env.RESEND_API_KEY);assert.match((init.headers as Record<string,string>)['Idempotency-Key'],/^branchquest-feedback\/[a-f0-9]{64}$/);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.deepEqual(f.finishes,['sent']);
});
test('an optional single address is Reply-To, never a recipient or sender',async()=>{
 const f=fixture();assert.equal((await f.handle(request({...body(),email:'student@example.com'}))).status,200);const mail=JSON.parse(String(f.calls[0].init.body));assert.equal(mail.reply_to,'student@example.com');assert.deepEqual(mail.to,[env.FEEDBACK_TO_EMAIL]);assert.equal(mail.from,FEEDBACK_SENDER);
});
for(const field of ['to','from','cc','bcc','reply_to','headers','html','attachments','_subject','__proto__'])test('relay/header field is rejected: '+field,async()=>{
 const f=fixture(),data=JSON.parse(JSON.stringify(body()).slice(0,-1)+','+JSON.stringify(field)+':"attacker@example.com"}');assert.equal((await f.handle(request(data))).status,400);assert.equal(f.calls.length,0);assert.equal(f.keys.length,0);
});
for(const email of ['a@example.com\r\nBcc:someone@example.com','x@example.com,y@example.com','Name <a@example.com>','a@example.com;z@example.com','a@example..com','a'.repeat(255)+'@x.com'])test('unsafe optional email cannot inject headers: '+JSON.stringify(email),async()=>{
 const f=fixture(),response=await f.handle(request({...body(),email}));assert.ok([400,422].includes(response.status));assert.equal(f.calls.length,0);
});
for(const data of [null,[],{...body(),description:5},{...body(),category:{}},{...body(),description:'x'.repeat(5001)},{...body(),submission_id:'not-a-uuid'},{...body(),source_route:'admin'},{...body(),submitted_at:'bad'},{...body(),build_id:'<script>'}])test('server rejects malformed independent input '+JSON.stringify(data).slice(0,60),async()=>{
 const f=fixture();assert.equal((await f.handle(request(data))).status,400);assert.equal(f.calls.length,0);
});
test('server repeats category, length, optional number and email validation independently',async()=>{
 const f=fixture(),response=await f.handle(request({...body(),category:'other',description:'short',course_number:'ABCD',email:'bad'}));assert.equal(response.status,422);assert.deepEqual((await response.json()).errors.map((e:{field:string})=>e.field).sort(),['category','course_number','description','email']);assert.equal(f.calls.length,0);
 const g=fixture();assert.equal((await g.handle(request({...body(),description:'א'.repeat(5000)}))).status,200);
});
test('body limits apply to advertised and streamed sizes; malformed JSON and UTF-8 fail safely',async()=>{
 for(const [raw,headers,status] of [['{}',{'Content-Length':String(MAX_FEEDBACK_BYTES+1)},413],['x'.repeat(MAX_FEEDBACK_BYTES+1),{},413],['{bad',{},400]] as const){
  const f=fixture(),req=request();const r=new Request(req.url,{method:'POST',headers:{...Object.fromEntries(req.headers),...headers},body:raw});assert.equal((await f.handle(r)).status,status);assert.equal(f.calls.length,0);
 }
 const req=request(),f=fixture();assert.equal((await f.handle(new Request(req.url,{method:'POST',headers:req.headers,body:new Uint8Array([0xc3,0x28])}))).status,400);
});
test('methods, content type, missing origin, foreign origins and cross-site browser posts are denied',async()=>{
 const f=fixture();assert.equal((await f.handle(new Request('https://branchquest.app/api/feedback'))).status,405);
 for(const headers of [{Origin:''},{Origin:'https://evil.example'},{Origin:'https://branchquest.app.evil.example'},{'Sec-Fetch-Site':'cross-site'},{'Content-Type':'text/plain'},{'X-BranchQuest-Feedback':''}])assert.ok([403,415].includes((await f.handle(request(body(),headers))).status));
 assert.equal(f.calls.length,0);
});
test('preview origins are exact environment-owned hosts and localhost is development-only',()=>{
 assert.deepEqual([...feedbackOrigins(env,'https://branchquest.app/api/feedback')],['https://branchquest.app']);
 const previews=feedbackOrigins({...env,VERCEL_ENV:'preview',VERCEL_URL:'owned-abc.vercel.app',VERCEL_BRANCH_URL:'owned-git-test.vercel.app'},'https://owned-abc.vercel.app/api/feedback');assert.ok(previews.has('https://owned-abc.vercel.app'));assert.ok(!previews.has('https://attacker.vercel.app'));
 assert.ok(feedbackOrigins({},'http://localhost:5173/api/feedback').has('http://localhost:5173'));assert.ok(!feedbackOrigins(env,'http://localhost:5173/api/feedback').has('http://localhost:5173'));
});
test('honeypot reports are quietly dropped without provider or store access',async()=>{const f=fixture();assert.equal((await f.handle(request({...body(),_gotcha:'spam'}))).status,200);assert.equal(f.calls.length,0);assert.equal(f.keys.length,0);});
for(const missing of ['RESEND_API_KEY','FEEDBACK_TO_EMAIL','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'])test('missing configuration fails closed without leaking '+missing,async()=>{
 const f=fixture({env:{...env,[missing]:undefined}}),r=await f.handle(request());assert.equal(r.status,503);assert.equal(f.calls.length,0);assert.equal(f.keys.length,0);assert.doesNotMatch(await r.text(),/re_server|private-recipient|redis-token/);
});
test('invalid configuration and absent trusted Vercel IP cannot bypass protection',async()=>{
 for(const overrides of [{FEEDBACK_TO_EMAIL:'a@b.com,c@d.com'},{UPSTASH_REDIS_REST_URL:'http://redis.example.test'},{UPSTASH_REDIS_REST_URL:'https://user:pass@redis.example.test'}])assert.equal((await fixture({env:{...env,...overrides}}).handle(request())).status,503);
 const f=fixture();assert.equal((await f.handle(request(body(),{'X-Vercel-Forwarded-For':'','X-Forwarded-For':'203.0.113.1'}))).status,503);assert.equal(f.calls.length,0);
});
test('IPv6 spellings and /64 address rotation share one protected identity',()=>{
 assert.equal(feedbackIpKey('2001:db8:1234:5678::1'),feedbackIpKey('2001:0db8:1234:5678:ffff:ffff:ffff:ffff'));
 assert.equal(feedbackIpKey('::ffff:192.0.2.1'),'192.0.2.1');assert.equal(feedbackIpKey('192.0.2.1'),'192.0.2.1');for(const value of ['spoof','203.0.113.1, 198.51.100.1','fe80::1%eth0'])assert.equal(feedbackIpKey(value),null);
});
for(const [status,httpStatus] of [['limited',429],['duplicate',200],['busy',409],['conflict',409],['unavailable',503]] as const)test('shared store admission '+status+' prevents another provider call',async()=>{
 const f=fixture({admission:{status,retryAfter:42}}),r=await f.handle(request());assert.equal(r.status,httpStatus);assert.equal(f.calls.length,0);if(status==='limited')assert.equal(r.headers.get('Retry-After'),'42');
});
test('store outage fails closed and IP keys contain no original address or feedback',async()=>{
 const f=fixture({rejectStore:true}),r=await f.handle(request());assert.equal(r.status,503);assert.equal(f.calls.length,0);assert.doesNotMatch(JSON.stringify(f.keys),/203\.0\.113\.7|תיאור|@/);assert.deepEqual(f.logs,['protection_unavailable']);
});
for(const options of [{providerStatus:429},{providerStatus:401},{providerStatus:500},{providerBody:{}},{rejectMail:true},{rejectFinish:true}])test('delivery/confirmation failure retains retry safety '+JSON.stringify(options),async()=>{
 const f=fixture(options),r=await f.handle(request());assert.equal(r.status,503);assert.ok(f.finishes.includes('retry'));assert.doesNotMatch(await r.text(),/private|re_server/);
});
test('same submission retries have the identical provider body and idempotency key across instances',async()=>{
 const a=fixture({rejectMail:true}),b=fixture(),data=body();await a.handle(request(data));await b.handle(request(data));assert.equal(a.calls[0].init.body,b.calls[0].init.body);assert.deepEqual(a.calls[0].init.headers,b.calls[0].init.headers);
});
test('Redis REST transport performs one atomic admission EVAL and conditional completion, with bounded network timeouts',async()=>{
 const calls:unknown[][]=[];const http=(async(_url,init)=>{const command=JSON.parse(String(init!.body));calls.push(command);assert.equal(init!.redirect,'error');assert.ok(init!.signal);return Response.json({result:command[1]===ADMIT_FEEDBACK?['admitted',0]:1});}) as typeof fetch;
 const store=new RedisFeedbackStore('https://redis.example.test','secret',http);assert.deepEqual(await store.admit(['id','burst','ten','day','global','global-attempts'],'fingerprint','token',50),{status:'admitted',retryAfter:0});await store.finish('id','token','sent');assert.equal(calls[0][1],ADMIT_FEEDBACK);assert.equal(calls[0][2],'6');assert.equal(calls[1][1],FINISH_FEEDBACK);
});
for(const result of [null,{},['admitted'],['invented',0],['limited',-1]])test('invalid shared-store response is never treated as permission '+JSON.stringify(result),async()=>{
 const store=new RedisFeedbackStore('https://redis.example.test','secret',(async()=>Response.json({result})) as typeof fetch);await assert.rejects(store.admit(['a','b','c','d','e'],'f','t',50));
});
test('browser accepts only explicit success and maps safe bounded errors without server HTML',async()=>{
 const sent:RequestInit[]=[];await submitFeedback({submission_id:randomUUID()},(async(url,init)=>{assert.equal(url,'/api/feedback');sent.push(init!);return Response.json({ok:true});}) as typeof fetch);assert.equal(sent[0].credentials,'same-origin');assert.equal(sent[0].redirect,'error');
 for(const payload of [{},{next:'https://evil.example'},null,{ok:'true'}])await assert.rejects(submitFeedback({},(async()=>Response.json(payload)) as typeof fetch),FeedbackSubmissionError);
 await assert.rejects(submitFeedback({},(async()=>Response.json({errors:[null,{code:'<script>',field:'constructor',message:'<script>attack</script>'}]},{status:422})) as typeof fetch),error=>error instanceof FeedbackSubmissionError&&!JSON.stringify(error.errors).includes('<script>'));
});
