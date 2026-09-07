import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { initialChapter,chapterTurn,chapterView,chapterChoices,chapterKnown,chapterNpcReply,chapterNpcContext,sealChapter,unsealChapter,handleDemoRequest } from '../lib/story-api.mjs';
const secret=randomBytes(32).toString('hex');
const step=(s,id)=>chapterTurn(s,[{kind:'choice',id}]).state;
const go=(s)=>step(s,'continue');
const toPhase=(role,phase)=>{let s=initialChapter(role);while(s.phase!==phase)s=go(s);return s};

test('Both perspectives play from return to restaurant departure without any model call',()=>{
  for(const role of ['chen','zhao']){
    let s=initialChapter(role);const phases=[s.phase];
    while(s.phase!=='ended'){s=go(s);phases.push(s.phase)}
    assert.deepEqual(phases,['landing','arrival','dinner','dessert','meeting','farewell','ended']);
    assert.equal(s.modelCalls,0);assert.ok(s.ending.title);assert.equal(s.positions.zhao,'departed');
    assert.equal(chapterView(s).choices.length,0);assert.throws(()=>go(s),/已经结束/);
    assert.ok(!s.messages.some(m=>/陈秉信|陈宅|老宅|精神病院/.test(m.text)));
  }
});

test('Chen route: preparations -> real tea delivery -> introduction -> storm-aware plan -> handover ending',()=>{
  let s=step(initialChapter('chen'),'airport-watch');s=step(s,'airport-zhuo');s=go(s);s=step(s,'prepare');s=go(s);s=step(s,'quiet-tea');s=go(s);
  s=step(s,'tea');const order=s.events.find(e=>e.kind==='dessert-order'),delivery=s.events.find(e=>e.kind==='dessert-delivered');
  assert.equal(delivery.cause,order.id);assert.ok(chapterKnown(s,'manager').some(e=>e.id===order.id));assert.ok(!chapterKnown(s,'zhao').some(e=>e.id===order.id));
  s=step(s,'watch-cup');s=go(s);s=step(s,'introduce');s=step(s,'bridge');s=go(s);s=step(s,'cars');s=step(s,'umbrella');s=step(s,'join');s=go(s);
  assert.equal(s.ending.title,'多走的一步');assert.equal(s.positions.chen,'departed');assert.ok(s.flags.includes('transport-checked'));assert.ok(s.ending.threads.some(t=>t.includes('谭')));
  assert.equal(s.modelCalls,0);assert.ok(s.traces.some(t=>t.observer==='tan'&&t.actor==='chen'));
});

test('Declining an introduction really preserves distance, and the source-like ending remains possible',()=>{
  let s=toPhase('chen','meeting');s=step(s,'stay-seated');assert.ok(!chapterChoices(s).some(c=>c.id==='introduce'));
  s=go(s);s=step(s,'decline');assert.ok(!chapterChoices(s).some(c=>c.id==='join'));s=go(s);
  assert.ok(!s.flags.includes('introduced'));assert.equal(s.ending.title,'灯仍亮着');assert.equal(s.positions.chen,'hall');
  assert.ok(s.ending.threads.some(t=>t.includes('没有正式引见')));
});

test('Zhao connects attribution with a name only after actually asking, with friends responding causally',()=>{
  let s=go(initialChapter('zhao'));s=step(s,'ask-host');s=go(s);s=step(s,'taste');s=step(s,'ask-chen');
  assert.ok(s.messages.some(m=>m.speaker==='shen'&&m.text.includes('怎么问起他')));
  s=go(s);s=chapterTurn(s,[{kind:'wait'}]).state;s=step(s,'ask-tea');s=go(s);s=step(s,'introduce');s=step(s,'ask-circle');s=go(s);s=step(s,'thanks');s=go(s);
  assert.equal(s.ending.title,'名字与细节');assert.ok(s.flags.includes('vouched'));assert.ok(s.flags.includes('thanked'));
  assert.ok(!s.messages.some(m=>/单方面|暗恋|跟在|跟踪|四房/.test(m.text)));
});

test('Silence lets the kitchen solve its problem and eventually advances the chapter',()=>{
  let s=toPhase('chen','dessert');s=chapterTurn(s,[{kind:'wait'}]).state;
  assert.ok(s.flags.includes('red-bean'));assert.ok(s.flags.includes('dessert-served'));
  s=chapterTurn(s,[{kind:'wait'}]).state;s=chapterTurn(s,[{kind:'wait'}]).state;
  assert.equal(s.phase,'meeting');assert.ok(!s.traces.some(t=>t.actor==='chen'&&t.reason.includes('后厨')));
});

test('Airport observation and friends private exchange do not leak to Zhao views or prompts',()=>{
  let s=step(initialChapter('chen'),'airport-watch');s=step(s,'airport-zhuo');s=go(s);s=go(s);
  const secretIds=s.events.filter(e=>e.kind==='airport-confirmed'||/机场去了|他自己回来的/.test(e.text)).map(e=>e.id);
  assert.ok(secretIds.length>=2);assert.ok(secretIds.every(id=>!chapterKnown(s,'zhao').some(e=>e.id===id)));
  const result=chapterTurn(s,[{kind:'say',target:'zhao',text:'赵先生，菜还合口吗？',private:true}]);s=result.state;
  const ctx=JSON.stringify(chapterNpcContext(s,'zhao',result.cause));assert.ok(!ctx.includes('跟上一程'));assert.ok(!ctx.includes('机场去了'));assert.ok(!ctx.includes('机场-confirmed'));
  const zhaoView=chapterView({...s,role:'zhao',place:s.positions.zhao,messages:[]});assert.ok(zhaoView.events.every(e=>!secretIds.includes(e.id)));
});

test('Summoning NPCs delivers only the invitation; a later private question does not trigger Shen',()=>{
  let s=toPhase('zhao','dinner');s.positions.shen='terrace';
  const request=chapterTurn(s,[{kind:'say',target:'zhuo',private:true,text:'这只是我们之间的小事。'}]);s=request.state;const privateId=request.cause.id;
  s=chapterTurn(s,[{kind:'summon',via:'zhuo',target:'shen'}]).state;
  assert.equal(s.positions.shen,'hall');assert.equal(s.positions.zhuo,'hall');assert.match(s.messages.at(-1).text,/找我什么事/);
  assert.ok(!chapterKnown(s,'shen').some(e=>e.id===privateId));
  const privateAsk=chapterTurn(s,[{kind:'say',target:'zhuo',text:'陈挽最近都在忙什么？',private:true}]);s=privateAsk.state;
  chapterNpcReply(s,'zhuo','卓智轩压低声音。\n“我也未必事事知道。”',[privateAsk.cause.id],privateAsk.cause);
  assert.ok(!s.flags.includes('shen-question'));
  const publicAsk=chapterTurn(s,[{kind:'say',target:'zhuo',text:'陈挽最近都在忙什么？',private:false}]);s=publicAsk.state;
  chapterNpcReply(s,'zhuo','卓智轩放下杯子。\n“最近忙什么，你可以问他。”',[publicAsk.cause.id],publicAsk.cause);
  assert.ok(s.flags.includes('shen-question'));assert.match(s.messages.at(-1).text,/忽然问起陈挽/);
});

test('Unavailable choices, remote dialogue and fabricated knowledge fail without changing original state',()=>{
  let s=toPhase('chen','arrival');const before=JSON.stringify(s);
  assert.throws(()=>step(s,'tea'),/当前时刻/);assert.throws(()=>chapterTurn(s,[{kind:'say',target:'zhao',text:'你好'}]),/先走到/);assert.equal(JSON.stringify(s),before);
  s=step(s,'prepare');assert.throws(()=>step(s,'prepare'),/不能再做/);
  assert.throws(()=>chapterNpcReply(s,'manager','不该知道',['fictional-id'],s.events.at(-1)),/尚未知道/);
  assert.throws(()=>chapterTurn(s,[{kind:'summon',via:'manager',target:'chen'}]),/只能找/);
});

test('Chapter tokens restore phase/choices and cannot be confused with legacy tokens or tampered with',async()=>{
  const s=step(toPhase('chen','dessert'),'tea'),token=await sealChapter(s,secret),restored=await unsealChapter(token,secret);
  assert.deepEqual(chapterView(restored),chapterView(s));assert.ok(!chapterChoices(restored).some(c=>c.id==='red-bean'));
  await assert.rejects(unsealChapter(token,secret+'different'),/无法读取/);
});

test('Chapter API choices use no external provider, are retry-idempotent, and stay playable at the model limit',async()=>{
  const actual=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('Scripted chapter choices must not call a provider')};
  try{
    const env={QILUO_API_KEY:'test-only',QILUO_STATE_SECRET:secret};
    const call=async(path,body)=>handleDemoRequest(new Request('https://demo.example/api/qiluo/chapter/'+path,{method:'POST',headers:{origin:'https://demo.example','Content-Type':'application/json'},body:JSON.stringify(body)}),env);
    let r=await call('session',{role:'zhao'}),current=await r.json();assert.equal(r.status,200);
    const input={token:current.token,action:'choice',id:'continue',requestId:crypto.randomUUID()};
    const [a,b]=await Promise.all([call('turn',input).then(r=>r.json()),call('turn',input).then(r=>r.json())]);assert.equal(a.token,b.token);assert.equal(a.view.phase,'arrival');
    let s=await unsealChapter(a.token,secret);s.modelCalls=30;current.token=await sealChapter(s,secret);
    r=await call('turn',{token:current.token,action:'choice',id:'continue',requestId:crypto.randomUUID()});assert.equal(r.status,200);
    r=await call('turn',{token:current.token,action:'free',text:'看雨',requestId:crypto.randomUUID()});assert.equal(r.status,400);
  }finally{globalThis.fetch=actual}
});

test('Free chapter API interprets movement and preserves recipient knowledge through its provider protocol',async()=>{
  const actual=globalThis.fetch;let calls=0;
  globalThis.fetch=async(url,options)=>{
    assert.equal(url,'https://api.deepseek.com/chat/completions');calls++;
    const body=JSON.parse(options.body),system=body.messages[0].content;
    const content=system.includes('行动理解器')?{steps:[{kind:'move',place:'terrace'},{kind:'activity',text:'在廊边停下，看着雨落在栏杆外。'}]}:{narrative:'赵声阁把茶盅放回桌上。',dialogue:'合口，不必忙了。',used_event_ids:[]};
    assert.ok(!system.includes('机场去了'));assert.ok(!system.includes('跟在黑色迈巴赫'));
    return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}],usage:{prompt_tokens:20,completion_tokens:15}});
  };
  try{
    const env={QILUO_API_KEY:'test-only',QILUO_STATE_SECRET:secret};
    const call=async(s,input)=>{const r=await handleDemoRequest(new Request('https://demo.example/api/qiluo/chapter/turn',{method:'POST',headers:{origin:'https://demo.example','Content-Type':'application/json'},body:JSON.stringify({token:await sealChapter(s,secret),requestId:crypto.randomUUID(),...input})}),env);const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d};
    let d=await call(toPhase('zhao','dinner'),{action:'free',text:'走到避风廊看雨'});assert.equal(d.view.place,'terrace');assert.equal(d.view.phase,'dinner');assert.equal(calls,1);
    d=await call(toPhase('chen','dinner'),{action:'say',target:'zhao',private:true,text:'赵先生，茶还合口吗？'});assert.equal(d.view.messages.at(-1).speaker,'zhao');assert.equal(calls,2);
    const s=toPhase('chen','dinner');s.turn=100;assert.equal(step(s,'continue').phase,'dessert','the chapter remains completable when the ordinary step budget is exhausted');
  }finally{globalThis.fetch=actual}
});
