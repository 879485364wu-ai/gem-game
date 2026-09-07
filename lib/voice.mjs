import { createHash } from 'node:crypto';
import { unseal } from './story-api.mjs';
import { spokenDialogue } from './dialogue.mjs';

export function voiceStatus(env) {
  return { chen: Boolean(env.MINIMAX_API_KEY && env.CHEN_VOICE_ID), zhao: Boolean(env.MINIMAX_API_KEY && env.ZHAO_VOICE_ID), provider:'MiniMax', samples:true };
}
const previews={
  chen:'我是陈挽。你不用急着回答，我会在这里等你。今晚风有些凉，要不要先进去坐一会儿？',
  zhao:'我是赵声阁。既然来了，就坐下。有什么事慢慢说，我听着。今晚的安排，你也可以自己决定。'
};
export function createVoiceHandler(env) {
  const cache = new Map();
  async function synthesize(voiceId,dialogue) {
    if(!env.MINIMAX_API_KEY || !voiceId) return Response.json({error:'这位角色的专属音色尚未配置，文字对话可以继续。'},{status:503});
    const text=dialogue.slice(0,900);
    const model=env.MINIMAX_TTS_MODEL || 'speech-2.8-hd';
    const key=createHash('sha256').update(JSON.stringify([voiceId,model,text])).digest('hex');
    for(const [k,v] of cache) if(Date.now()-v.at>20*60000) cache.delete(k);
    let record=cache.get(key);
    if(!record) {
      if(cache.size>=60) cache.delete(cache.keys().next().value);
      const promise=(async()=>{
        const result=await fetch('https://api.minimax.cn/v1/t2a_v2',{method:'POST',redirect:'error',signal:AbortSignal.timeout(45000),headers:{Authorization:`Bearer ${env.MINIMAX_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model,text,stream:false,output_format:'hex',language_boost:'Chinese',voice_setting:{voice_id:voiceId,speed:0.95,vol:1,pitch:0},audio_setting:{sample_rate:32000,bitrate:128000,format:'mp3',channel:1}})});
        if(!result.ok) throw new Error('语音服务暂时无法回应。');
        const data=await result.json();
        const audio=data.data?.audio;
        if(data.base_resp?.status_code!==0 || typeof audio!=='string' || !/^(?:[a-fA-F0-9]{2})+$/.test(audio) || audio.length>12*1024*1024) throw new Error('语音未能生成，请稍后重试。');
        return Buffer.from(audio,'hex');
      })();
      record={at:Date.now(),promise};cache.set(key,record);
    }
    try {return new Response(await record.promise,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'private, no-store'}})}
    catch {cache.delete(key);return Response.json({error:'专属语音暂时未能生成，文字进度已保留。'},{status:502})}
  }
  const handler=async function voice(request) {
    let body;
    try { body=await request.json(); } catch { return Response.json({error:'语音请求无法读取。'},{status:400}); }
    if(typeof body.token!=='string' || body.token.length>500000 || typeof body.messageId!=='string' || body.messageId.length>100 || Object.keys(body).some(k=>!['token','messageId'].includes(k))) return Response.json({error:'语音请求无效。'},{status:400});
    let state;
    try {state=await unseal(body.token,env.QILUO_STATE_SECRET)} catch{return Response.json({error:'请重新进入体验。'},{status:400})}
    const message=state.messages.find(m=>m.id===body.messageId);
    const dialogue=spokenDialogue(message);
    if(!dialogue) return Response.json({error:'这一条没有可合成的主角对白。'},{status:400});
    const voiceId=message.speaker==='chen'?env.CHEN_VOICE_ID:env.ZHAO_VOICE_ID;
    return synthesize(voiceId,dialogue);
  };
  handler.preview=role=>synthesize(role==='chen'?env.CHEN_VOICE_ID:env.ZHAO_VOICE_ID,previews[role]);
  return handler;
}
