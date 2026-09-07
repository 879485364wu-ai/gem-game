import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { createOnlineDispatcher, createNodeServer } from '../server.mjs';
import { initialDemo, applyTurn, applyPlannedTurn, applyNpcActions, publicDemo, seal, unseal } from '../lib/story-api.mjs';

const origin='https://demo.example';
const env={PUBLIC_ORIGIN:origin,QILUO_API_KEY:'test-only',QILUO_STATE_SECRET:randomBytes(32).toString('hex'),TEST_ACCESS_CODE:'test-access-only',MINIMAX_API_KEY:'voice-test-only',CHEN_VOICE_ID:'test-chen',ZHAO_VOICE_ID:'test-zhao'};
const request=(route,body,cookie='',headers={})=>new Request(origin+route,{method:body?'POST':'GET',headers:{host:'demo.example',origin,cookie,'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
const responseJSON=content=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}],usage:{prompt_tokens:100,completion_tokens:30}});
const act=(s,steps)=>applyPlannedTurn(s,'执行指定行动',steps).state;

test('Independent actions change position, inventory and time without a chat target',()=>{
 let s=initialDemo('chen');
 s=act(s,[{kind:'move',place:'lobby'},{kind:'take',item:'umbrella'},{kind:'use',item:'umbrella'},{kind:'move',place:'street'}]);
 assert.equal(s.place,'street'); assert.equal(s.positions.chen,'street');assert.equal(s.positions.zhao,'hall');
 assert.equal(s.world.items.umbrella,'chen');assert.ok(s.world.flags.includes('umbrella-open'));assert.ok(!s.world.flags.includes('wet'));
 const before=s.world.minutes;s=act(s,[{kind:'wait',minutes:5}]);assert.equal(s.world.minutes,before+5);
 assert.equal(publicDemo(s).present.length,0);assert.equal(s.messages.at(-1).speaker,'scene');
 const event=s.events.find(e=>e.kind==='take');assert.ok(!s.knowledge.zhao.some(k=>k.eventId===event.id));
 s=act(s,[{kind:'give',item:'umbrella',target:'zhao'},{kind:'move',place:'hall'}]);assert.equal(s.place,'street');assert.equal(s.world.items.umbrella,'chen');assert.match(s.messages.at(-1).text,/尚未完成/);
});

test('A asks B to find C: actual invitation, arrival, active question and knowledge boundaries',()=>{
 let s=applyTurn(initialDemo('zhao'),{action:'say',target:'zhuo',text:'帮我找一下沈宗年，让他过来。'}).state;
 const cause=s.events.findLast(e=>e.kind==='speech');assert.ok(!s.knowledge.shen.some(k=>k.eventId===cause.id));
 applyNpcActions(s,[{kind:'invite',actor:'zhuo',target:'shen',accepted:true,invitation:'赵声阁请你过去一趟。',motive:'朋友托付；沈愿意过去听赵说事',source_event_ids:[cause.id]},
 {kind:'say',actor:'shen',target:'zhao',narrative:'沈宗年收好手机，在窗边停住。',dialogue:'找我什么事？',motive:'收到邀请，询问来意',source_event_ids:[]}]);
 assert.equal(s.positions.shen,'hall');assert.equal(s.positions.zhuo,'hall');
 assert.equal(s.messages.at(-1).speaker,'shen');assert.match(s.messages.at(-1).text,/找我什么事/);
 const invite=s.events.find(e=>e.kind==='invitation');assert.ok(s.knowledge.shen.some(k=>k.eventId===invite.id&&k.certainty==='reported'));
 assert.ok(!s.knowledge.shen.some(k=>k.eventId===cause.id),'invitation does not disclose entire earlier conversation');
 const count=s.events.filter(e=>e.kind==='invitation').length;
 applyNpcActions(s,[{kind:'invite',actor:'zhuo',target:'shen',accepted:true,motive:'重复处理同一托付',source_event_ids:[cause.id]}]);
 assert.equal(s.events.filter(e=>e.kind==='invitation').length,count);
 s=applyTurn(s,{action:'say',target:'zhuo',text:'陈挽最近都在忙什么？'}).state;
 const heard=s.events.findLast(e=>e.kind==='speech');assert.ok(s.knowledge.shen.some(k=>k.eventId===heard.id));
 applyNpcActions(s,[{kind:'say',actor:'shen',target:'zhao',dialogue:'怎么突然打听起他来了？',motive:'听见赵打听陈，想确认来意',source_event_ids:[heard.id]}]);
 assert.match(s.messages.at(-1).text,/打听/);
});

test('C cannot react to private or off-scene speech, and AI cannot move the player',()=>{
 let s=applyTurn(initialDemo('zhao'),{action:'say',target:'zhuo',text:'悄悄问你，陈挽最近都在忙什么？'}).state;
 const event=s.events.findLast(e=>e.kind==='speech');assert.deepEqual(event.witnesses,['zhao','zhuo']);
 assert.throws(()=>applyNpcActions(s,[{kind:'say',actor:'shen',target:'zhao',dialogue:'你在打听他？',motive:'不该知道',source_event_ids:[event.id]}]),/尚未知晓/);
 assert.throws(()=>applyNpcActions(s,[{kind:'move',actor:'zhao',place:'street',motive:'替玩家决定',source_event_ids:[]}]),/人物行动/);
});

test('Legacy saved progress migrates without losing role or prior events',async()=>{
 const s=initialDemo('chen');delete s.world;s.turn=8;
 const token=await seal(s,env.QILUO_STATE_SECRET),restored=await unseal(token,env.QILUO_STATE_SECRET);
 assert.equal(restored.role,'chen');assert.equal(restored.turn,8);assert.equal(restored.world.items.phone,'chen');assert.equal(publicDemo(restored).clock,'21:08');
});

test('Private affairs stay private; physical care still changes the recipient',()=>{
 let s=act(initialDemo('chen'),[{kind:'move',place:'lobby'},{kind:'arrange'}]);
 const done=s.events.find(e=>e.kind==='arrange');assert.ok(!s.knowledge.zhao.some(k=>k.eventId===done.id));assert.equal(publicDemo(s).people.find(p=>p.id==='zhao').attitude.trust,0);
 s=act(s,[{kind:'move',place:'hall'},{kind:'take',item:'water'},{kind:'give',item:'water',target:'zhao'}]);
 assert.equal(s.world.items.water,'zhao');assert.equal(publicDemo(s).people.find(p=>p.id==='zhao').attitude.warmth,1);
 const count=s.changes.length;s=act(s,[{kind:'give',item:'water',target:'zhao'}]);assert.equal(s.changes.length,count);
});

test('Online auth, paused voice zero provider calls, API action flow and idempotency',async()=>{
 const dispatch=createOnlineDispatcher(env),actual=globalThis.fetch;let providerCalls=0;
 globalThis.fetch=async(url,options)=>{
   assert.equal(url,'https://api.deepseek.com/chat/completions','no MiniMax request while paused');providerCalls++;
   const body=JSON.parse(options.body),sys=body.messages[0].content;
   if(sys.includes('行动理解器'))return responseJSON({steps:[{kind:'talk',target:'zhuo',text:'帮我把沈宗年找过来。'}]});
   const state=JSON.parse(sys.slice(sys.indexOf('当前后台状态：')+'当前后台状态：'.length));
   const e=state.npcs.find(p=>p.id==='zhuo').known_events.findLast(e=>e.kind==='speech');
   return responseJSON({actions:[{kind:'invite',actor:'zhuo',target:'shen',motive:'受朋友托付，沈愿意过去',source_event_ids:[e.eventId],accepted:true,invitation:'赵声阁请你过去一趟。'}, {kind:'say',actor:'shen',target:'zhao',motive:'收到邀请',source_event_ids:[],dialogue:'找我什么事？'}]});
 };
 try{
  assert.equal((await dispatch(request('/api/qiluo/status'))).status,401);
  assert.equal((await dispatch(request('/api/access',{code:env.TEST_ACCESS_CODE},'',{origin:'https://elsewhere.example'}))).status,403);
  const login=await dispatch(request('/api/access',{code:env.TEST_ACCESS_CODE}));assert.equal(login.status,200);
  assert.match(login.headers.get('set-cookie'),/HttpOnly.*SameSite=Strict.*Secure/);const cookie=login.headers.get('set-cookie').split(';')[0];
  const call=async(route,body)=>{const r=await dispatch(request(route,body,cookie));const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data};
  const status=await call('/api/voice/status');assert.equal(status.paused,true);assert.equal(status.chen,false);assert.equal(status.zhao,false);
  for(const route of ['/voice-chen.mp3','/voice-zhao.mp3','/api/voice'])assert.equal((await dispatch(request(route,route==='/api/voice'?{token:'old',messageId:'old'}:undefined,cookie))).status,503);
  assert.equal(providerCalls,0);
  for(const route of ['/server.mjs','/lib/story-api.mjs','/.env','/render.yaml'])assert.equal((await dispatch(request(route,undefined,cookie))).status,404);
  const html=await dispatch(request('/',undefined,cookie)).then(r=>r.text());assert.ok(html.includes('自由行动'));assert.ok(!html.includes('试听陈挽音色'));assert.ok(!html.includes(env.TEST_ACCESS_CODE));
  let s=await call('/api/qiluo/session',{role:'zhao'});
  const body={token:s.token,requestId:crypto.randomUUID(),action:'act',text:'我请卓智轩找沈宗年过来。'};
  s=await call('/api/qiluo/turn',body);assert.equal(s.view.people.find(p=>p.id==='shen').place,'hall');assert.equal(s.view.messages.at(-1).speaker,'shen');assert.equal(providerCalls,2);
  const retry=await call('/api/qiluo/turn',body);assert.equal(retry.token,s.token);assert.equal(providerCalls,2);
  const server=createNodeServer(env),incoming=Readable.from([Buffer.from(JSON.stringify({role:'chen'}))]);
  Object.assign(incoming,{method:'POST',url:'/api/qiluo/session',headers:{host:'demo.example',origin,cookie,'content-type':'application/json'}});
  const wire=await new Promise(resolve=>{let status;server.emit('request',incoming,{writeHead(code){status=code},end(body){resolve({status,body})}})});
  assert.equal(wire.status,200);assert.equal(JSON.parse(wire.body.toString()).view.role,'chen');
 }finally{globalThis.fetch=actual}
});

test('Director repairs an accepted invitation that stops at arrival',async()=>{
 const dispatch=createOnlineDispatcher(env),actual=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,options)=>{
  calls++;assert.equal(url,'https://api.deepseek.com/chat/completions');const body=JSON.parse(options.body),sys=body.messages[0].content;
  const state=JSON.parse(sys.slice(sys.indexOf('当前后台状态：')+'当前后台状态：'.length));
  const cause=state.npcs.find(p=>p.id==='zhuo').known_events.findLast(e=>e.kind==='speech');
  const invite={kind:'invite',actor:'zhuo',target:'shen',accepted:true,invitation:'赵声阁找你。',motive:'朋友托付与应邀',source_event_ids:[cause.eventId]};
  return responseJSON({actions:calls===1?[invite]:[invite,{kind:'say',actor:'shen',target:'zhao',dialogue:'找我什么事？',motive:'询问来意',source_event_ids:[]}]});
 };
 try {
  const login=await dispatch(request('/api/access',{code:env.TEST_ACCESS_CODE})),cookie=login.headers.get('set-cookie').split(';')[0];
  const s=await dispatch(request('/api/qiluo/session',{role:'zhao'},cookie)).then(r=>r.json());
  const r=await dispatch(request('/api/qiluo/turn',{token:s.token,requestId:crypto.randomUUID(),action:'say',target:'zhuo',text:'帮我找一下沈宗年。'},cookie));
  const next=await r.json();assert.equal(r.status,200,JSON.stringify(next));assert.equal(calls,2);assert.equal(next.view.people.find(p=>p.id==='shen').place,'hall');assert.match(next.view.messages.at(-1).text,/什么事/);
  assert.equal(next.view.events.filter(e=>e.kind==='invitation').length,1,'repair must not execute invite twice');
 }finally{globalThis.fetch=actual}
});

test('Observed curiosity triggers a real question once; a gesture alone is repaired',async()=>{
 const dispatch=createOnlineDispatcher(env),actual=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,options)=>{
  calls++;assert.equal(url,'https://api.deepseek.com/chat/completions');const body=JSON.parse(options.body),sys=body.messages[0].content;
  const state=JSON.parse(sys.slice(sys.indexOf('当前后台状态：')+'当前后台状态：'.length));const task=state.followup_tasks[0];assert.equal(task.actor,'shen');
  return responseJSON({actions:[calls===1?{kind:'react',actor:'shen',narrative:'沈看了一眼，没有开口。',motive:'留意赵的关心',source_event_ids:[task.source_event_id]}:{kind:'say',actor:'shen',target:'zhao',dialogue:'怎么突然打听起陈挽了？',motive:'想了解关心的缘由',source_event_ids:[task.source_event_id]}]});
 };
 try {
  const login=await dispatch(request('/api/access',{code:env.TEST_ACCESS_CODE})),cookie=login.headers.get('set-cookie').split(';')[0];
  const state=initialDemo('zhao');state.positions.shen='hall';
  const r=await dispatch(request('/api/qiluo/turn',{token:await seal(state,env.QILUO_STATE_SECRET),requestId:crypto.randomUUID(),action:'say',target:'zhuo',text:'陈挽最近在忙什么？'},cookie));
  const next=await r.json();assert.equal(r.status,200,JSON.stringify(next));assert.equal(calls,2);assert.match(next.view.messages.at(-1).text,/怎么.*陈挽/);assert.ok(next.view.flags.includes('shen-asked-about-chen'));
 }finally{globalThis.fetch=actual}
});
