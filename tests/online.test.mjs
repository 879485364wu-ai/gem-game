import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {Readable} from 'node:stream';
import {createOnlineDispatcher, createNodeServer} from '../server.mjs';

const origin='https://demo.example';
const env={PUBLIC_ORIGIN:origin,QILUO_API_KEY:'test-only',QILUO_STATE_SECRET:randomBytes(32).toString('hex'),TEST_ACCESS_CODE:'test-access-only',MINIMAX_API_KEY:'voice-test-only',CHEN_VOICE_ID:'test-chen',ZHAO_VOICE_ID:'test-zhao'};
const request=(route,body,cookie='',headers={})=>new Request(origin+route,{method:body?'POST':'GET',headers:{host:'demo.example',origin,cookie,'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});

test('Online gate, Node request adapter, causal state and role-bound voice',async()=>{
  const dispatch=createOnlineDispatcher(env);
  const actualFetch=globalThis.fetch;
  let speechCalls=0; const utterances=[];
  globalThis.fetch=async(url,options)=>{
    if(String(url).startsWith('http://127.0.0.1:'))return actualFetch(url,options);
    if(url==='https://api.deepseek.com/chat/completions'){
      const b=JSON.parse(options.body);const sys=b.messages[0].content;const state=JSON.parse(sys.slice(sys.indexOf('后台状态：')+'后台状态：'.length));
      return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({speaker_id:state.speaker_id,narrative:'这段是旁白，不应朗读。',dialogue:'谢谢，坐一会儿吧。',used_event_ids:[]})}}],usage:{prompt_tokens:100,completion_tokens:20}});
    }
    assert.equal(url,'https://api.minimax.cn/v1/t2a_v2');const b=JSON.parse(options.body);utterances.push({text:b.text,voice:b.voice_setting.voice_id});assert.ok(['test-chen','test-zhao'].includes(b.voice_setting.voice_id));speechCalls++;
    return Response.json({base_resp:{status_code:0},data:{audio:Buffer.from('ID3-test-audio').toString('hex')}});
  };
  let server;
  try{
    assert.equal((await dispatch(request('/api/qiluo/status'))).status,401);
    assert.equal((await dispatch(request('/voice-chen.mp3'))).status,401);
    assert.equal((await dispatch(request('/api/access',{code:env.TEST_ACCESS_CODE},'',{origin:'https://elsewhere.example'}))).status,403);
    assert.equal((await dispatch(request('/api/access',{code:'wrong'}))).status,401);
    const login=await dispatch(request('/api/access',{code:env.TEST_ACCESS_CODE}));assert.equal(login.status,200);
    assert.match(login.headers.get('set-cookie'),/HttpOnly.*SameSite=Strict.*Secure/);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    const call=async(route,body)=>{const r=await dispatch(request(route,body,cookie));const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data};
    for(const route of ['/server.mjs','/lib/story-api.mjs','/.env','/render.yaml'])assert.equal((await dispatch(request(route,undefined,cookie))).status,404);
    const changed=createOnlineDispatcher({...env,TEST_ACCESS_CODE:'a-new-access-code'});assert.equal((await changed(request('/api/qiluo/status',undefined,cookie))).status,401);
    const status=await call('/api/qiluo/status');assert.deepEqual([status.voices.chen,status.voices.zhao],[true,true]);
    const html=await dispatch(request('/',undefined,cookie)).then(r=>r.text());assert.ok(!html.includes(env.QILUO_STATE_SECRET));assert.ok(!html.includes(env.TEST_ACCESS_CODE));assert.ok(html.includes('音色试听'));
    assert.equal((await dispatch(request('/voice-zhao.mp3',undefined,cookie))).headers.get('content-type'),'audio/mpeg');
    let s=await call('/api/qiluo/session',{role:'chen'});
    const turn=async(action,target,place)=>{s=await call('/api/qiluo/turn',{token:s.token,requestId:crypto.randomUUID(),action,...(target?{target}:{}),...(place?{place}:{})})};
    await turn('water','zhao');const id=s.view.messages.at(-1).id;
    assert.equal((await dispatch(request('/api/voice',{token:s.token,messageId:id,text:'越权文本'},cookie))).status,400);
    for(let i=0;i<2;i++){const r=await dispatch(request('/api/voice',{token:s.token,messageId:id},cookie));assert.equal(r.status,200);assert.equal(await r.text(),'ID3-test-audio')}
    assert.equal(speechCalls,2); assert.deepEqual(utterances[1],{text:'谢谢，坐一会儿吧。',voice:'test-zhao'});
    const opening=await dispatch(request('/api/voice',{token:s.token,messageId:'opening-person'},cookie)); assert.equal(opening.status,200);assert.deepEqual(utterances.at(-1),{text:'今晚的安排，辛苦了。',voice:'test-zhao'});
    s=await call('/api/qiluo/turn',{token:s.token,requestId:crypto.randomUUID(),action:'say',target:'zhao',text:'（把杯子放下）“雨还没停，先坐一会儿吧。”'});
    const player=s.view.messages.findLast(m=>m.source==='player');assert.equal((await dispatch(request('/api/voice',{token:s.token,messageId:player.id},cookie))).status,200);assert.deepEqual(utterances.at(-1),{text:'雨还没停，先坐一会儿吧。',voice:'test-chen'});
    assert.equal((await dispatch(request('/api/voice',{token:s.token,messageId:'opening'},cookie))).status,400);
    await turn('promise','zhao');await turn('fulfill','zhao');assert.equal(s.view.people.find(p=>p.id==='shen').known.length,0);
    await turn('move',undefined,'terrace');await turn('share','shen');assert.equal(s.view.people.find(p=>p.id==='shen').attitude.trust,0);await turn('verify','shen');assert.equal(s.view.people.find(p=>p.id==='shen').attitude.trust,2);
    assert.equal((await dispatch(request('/api/voice',{token:s.token,messageId:s.view.messages.at(-1).id},cookie))).status,400);
    const missing=createOnlineDispatcher({...env,CHEN_VOICE_ID:'',ZHAO_VOICE_ID:''});
    s=await call('/api/qiluo/session',{role:'zhao'});await turn('water','chen');
    assert.equal((await missing(request('/api/voice',{token:s.token,messageId:s.view.messages.at(-1).id},cookie))).status,503);
    assert.equal((await dispatch(request('/api/voice',{token:s.token,messageId:s.view.messages.at(-1).id},cookie))).status,200);
    server=createNodeServer(env);
    const incoming=Readable.from([Buffer.from(JSON.stringify({role:'chen'}))]);
    Object.assign(incoming,{method:'POST',url:'/api/qiluo/session',headers:{host:'demo.example',origin,cookie,'content-type':'application/json'}});
    const wire=await new Promise(resolve=>{let status;const outgoing={writeHead(code){status=code},end(body){resolve({status,body})}};server.emit('request',incoming,outgoing)});
    assert.equal(wire.status,200);assert.equal(JSON.parse(wire.body.toString()).view.role,'chen');
  }finally{globalThis.fetch=actualFetch}
});
