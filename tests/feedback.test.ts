import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FEEDBACK_ENDPOINT,FEEDBACK_CATEGORIES,validateFeedback,feedbackPayload,feedbackPageURL,feedbackHistoryOrigin,feedbackErrorMessage,type FeedbackValues} from '../src/lib/feedback';
import {appRoute} from '../src/lib/navigation';
const valid:FeedbackValues={category:'bug',description:'תיאור מפורט של תקלה במפת הקורסים',course_number:'',email:''};
test('anonymous feedback needs a real category and meaningful bounded description',()=>{
 assert.deepEqual(validateFeedback(valid),{});
 assert.ok(validateFeedback({...valid,category:''}).category);assert.ok(validateFeedback({...valid,category:'other'}).category);
 for(const description of ['', '       ', 'short', 'x'.repeat(5001)])assert.ok(validateFeedback({...valid,description}).description);
 assert.deepEqual(validateFeedback({...valid,description:'x'.repeat(5000)}),{});assert.equal(FEEDBACK_CATEGORIES.length,4);
});
test('optional course and email fields validate without inventing course identifiers',()=>{
 for(const course_number of ['234114','02340114','044102','44102'])assert.equal(validateFeedback({...valid,course_number}).course_number,undefined);
 for(const course_number of ['text','1234','123456789','234-114'])assert.ok(validateFeedback({...valid,course_number}).course_number);
 for(const email of ['no-address','a@@b.com','a@b','a b@example.com','x'.repeat(255)+'@example.com'])assert.ok(validateFeedback({...valid,email}).email);
 assert.deepEqual(validateFeedback({...valid,email:' student@example.com '}),{});
});
test('URL context strips arbitrary queries and fragments and keeps only app/course context',()=>{
 assert.equal(feedbackPageURL('https://example.com/?course=02340114&email=private@example.com&token=secret#/about'),'https://example.com/?course=02340114#/about');
 assert.equal(feedbackPageURL('https://example.com/feedback?courseId=00440102&user=private#secret'),'https://example.com/feedback?courseId=00440102');
 assert.equal(feedbackPageURL('https://example.com/private/person'),'https://example.com/');
 assert.equal(feedbackPageURL('javascript:alert(1)'),'');assert.equal(feedbackPageURL('bad url'),'');
});
test('payload targets the configured form and contains concise context but no graph state',()=>{
 assert.equal(FEEDBACK_ENDPOINT,'https://formspree.io/f/xrpqqyge');
 const payload=feedbackPayload({...valid,course_number:'234114',description:'  '+valid.description+'  '},{origin:{pageUrl:'https://example.com/?course=02340247&token=secret',route:'tree',startingCourseId:'02340247',relevantCourseId:'234114'},pageUrl:'https://example.com/feedback?email=private@example.com',userAgent:'Browser',appVersion:'1.0.0',buildId:'abc1234',timestamp:'2026-11-17T12:00:00.000Z',honeypot:''});
 assert.equal(payload.description,valid.description);assert.equal(payload.course_number,'234114');assert.equal(payload.starting_course_id,'02340247');assert.equal(payload.relevant_course_id,'234114');assert.equal(payload.email,undefined);assert.equal(payload.category_label,'דיווח על תקלה');assert.equal(payload.build_id,'abc1234');assert.equal(payload._gotcha,'');
 assert.ok(!JSON.stringify(payload).includes('secret'));assert.ok(!JSON.stringify(payload).includes('private@example'));assert.ok(!JSON.stringify(payload).includes('expandedForward'));assert.ok(!JSON.stringify(payload).includes('markedCourseIds'));
});
test('server errors have Hebrew retry messages and never include untrusted server HTML',()=>{
 assert.match(feedbackErrorMessage([{code:'UNSPECIFIED',message:'Too many requests'}]),/כמה דקות/);
 assert.match(feedbackErrorMessage([{code:'INACTIVE',message:'disabled'}]),/אינה זמינה/);
 const text=feedbackErrorMessage([{code:'UNSPECIFIED',message:'<script>alert(1)</script>'}]);assert.ok(!text.includes('<script>'));assert.match(text,/נשמר/);
});
test('direct feedback and existing About routing stay independent',()=>{
 assert.equal(appRoute({pathname:'/feedback',hash:''}),'feedback');assert.equal(appRoute({pathname:'/feedback/',hash:''}),'feedback');assert.equal(appRoute({pathname:'/',hash:'#/feedback'}),'feedback');assert.equal(appRoute({pathname:'/',hash:'#/about'}),'about');assert.equal(appRoute({pathname:'/',hash:'#/'}),'tree');
});
test('Vercel serves page-specific public documents and leaves assets/data routes untouched',()=>{
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.deepEqual(config.rewrites,[{source:'/about',destination:'/about/index.html'},{source:'/about/',destination:'/about/index.html'},{source:'/feedback',destination:'/feedback/index.html'},{source:'/feedback/',destination:'/feedback/index.html'}]);
});

test('history report context is validated independently of graph progress',()=>{
 for(const state of [null,{}, {feedbackOrigin:42}, {feedbackOrigin:{pageUrl:5,route:'tree'}}, {feedbackOrigin:{pageUrl:'https://example.com',route:'bad'}}])assert.equal(feedbackHistoryOrigin(state),null);
 assert.deepEqual(feedbackHistoryOrigin({feedbackOrigin:{pageUrl:'https://example.com/?token=secret',route:'tree',startingCourseId:'02340114',relevantCourseId:'00440102'}}),{pageUrl:'https://example.com/',route:'tree',startingCourseId:'02340114',relevantCourseId:'00440102'});
});
