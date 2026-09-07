import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { initialChapter,chapterTurn,sealChapter } from '../lib/story-api.mjs';
import { spokenDialogue } from '../lib/dialogue.mjs';
import { createVoiceHandler,voiceStatus } from '../lib/voice.mjs';
const env={MINIMAX_API_KEY:'test-only',CHEN_VOICE_ID:'test-chen',ZHAO_VOICE_ID:'test-zhao',QILUO_STATE_SECRET:randomBytes(32).toString('hex')};
function introduction(){let s=initialChapter('chen');while(s.phase!=='meeting')s=chapterTurn(s,[{kind:'choice',id:'continue'}]).state;return chapterTurn(s,[{kind:'choice',id:'introduce'}]).state}

test('Chapter voices use signed dialogue, correct cloned IDs and cached audio; reject NPC, prose and injected text',async()=>{
  const actual=globalThis.fetch,calls=[];
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.minimax.cn/v1/t2a_v2');const d=JSON.parse(options.body);calls.push(d);return Response.json({base_resp:{status_code:0},data:{audio:'4944330000'}})};
  try{
    const s=introduction(),token=await sealChapter(s,env.QILUO_STATE_SECRET),voice=createVoiceHandler(env);
    const call=(m,extra={})=>voice(new Request('https://demo.example/api/voice',{method:'POST',body:JSON.stringify({token,messageId:m.id,story:'chapter-one',...extra})}));
    const characters=s.messages.filter(m=>m.turn===s.turn&&m.speech);assert.deepEqual(characters.map(m=>m.speaker),['chen','zhao']);
    for(const m of characters){const r=await call(m);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'audio/mpeg');assert.equal((await call(m)).status,200)}
    assert.equal(calls.length,2);assert.deepEqual(calls.map(d=>d.voice_setting.voice_id),['test-chen','test-zhao']);
    assert.deepEqual(calls.map(d=>d.text),characters.map(m=>m.speech));assert.ok(calls.every(d=>!d.text.includes('举杯')));
    assert.equal((await call(s.messages.find(m=>m.speaker==='zhuo'))).status,400);
    assert.equal((await call(s.messages.find(m=>m.speaker==='scene'))).status,400);
    assert.equal((await call(characters[0],{text:'客户端不能指定朗读内容'})).status,400);
    assert.equal((await call(characters[0],{token:'invalid-token'})).status,400);
    assert.equal(calls.length,2);assert.equal(voiceStatus(env).paused,false);
  }finally{globalThis.fetch=actual}
});

test('Speech extraction leaves action-only turns silent and keeps raw player lines separate from narrative',()=>{
  let s=initialChapter('chen');while(s.phase!=='dinner')s=chapterTurn(s,[{kind:'choice',id:'continue'}]).state;
  s=chapterTurn(s,[{kind:'activity',text:'陈挽整理了一下衣袖。'}]).state;assert.equal(spokenDialogue(s.messages.at(-1)),'');
  s=chapterTurn(s,[{kind:'say',target:'zhao',private:true,text:'（轻声）赵先生，茶还合口吗？'}]).state;
  assert.equal(spokenDialogue(s.messages.at(-1)),'赵先生，茶还合口吗？');
  assert.equal(spokenDialogue({speaker:'shen',speech:'这句不应合成'}),'');
});
