import { useEffect, useRef, useState } from 'react';
import { audioContext, unlockAudio } from './audio-runtime';
import { spokenDialogue } from '../lib/dialogue.mjs';
type VoiceMessage = { id:string; speaker:string; source?:string; text:string; speech?:string; action?:string };
export function useRoleVoice(story?:'chapter-one'){
  const [ready,setReady]=useState({chen:false,zhao:false});
  const [active,setActive]=useState('');
  const [loading,setLoading]=useState('');
  const [error,setError]=useState('');
  const player=useRef<AudioBufferSourceNode|null>(null);
  const controller=useRef<AbortController|null>(null);
  const generation=useRef(0);
  const cache=useRef(new Map<string,AudioBuffer>());
  function stop(){generation.current++;controller.current?.abort();controller.current=null;try{player.current?.stop()}catch{}player.current=null;setActive('');setLoading('')}
  useEffect(()=>{
    fetch('/api/voice/status').then(r=>r.json()).then(d=>setReady({chen:Boolean(d.chen),zhao:Boolean(d.zhao)})).catch(()=>{});
    return()=>{generation.current++;controller.current?.abort();try{player.current?.stop()}catch{}cache.current.clear()};
  },[]);
  async function fetchAudio(key:string,url:string,ticket:number,body?:unknown){
    const existing=cache.current.get(key);if(existing)return existing;
    const ac=new AbortController();controller.current=ac;
    const timer=setTimeout(()=>ac.abort(),60000);
    try{
      const r=await fetch(url,{signal:ac.signal,...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
      if(!r.ok){let reason='语音暂时不可用。';try{reason=(await r.json()).error||reason}catch{}throw Error(reason)}
      const bytes=await r.arrayBuffer();if(ticket!==generation.current)return null;
      const audio=await audioContext().decodeAudioData(bytes);if(ticket!==generation.current)return null;
      if(cache.current.size>=16)cache.current.delete(cache.current.keys().next().value!);
      cache.current.set(key,audio);return audio;
    }finally{clearTimeout(timer)}
  }
  async function play(key:string,audio:AudioBuffer,ticket:number){
    if(ticket!==generation.current)return;
    const ctx=audioContext();
    if(ctx.state!=='running')throw Error('轻点这句旁边的播放按钮，即可开启声音。');
    const source=ctx.createBufferSource();source.buffer=audio;source.connect(ctx.destination);player.current=source;
    setLoading('');setActive(key);
    await new Promise<void>(resolve=>{source.onended=()=>{source.disconnect();if(ticket===generation.current){setActive('');player.current=null}resolve()};source.start()});
  }
  function report(e:unknown,ticket:number){if(ticket===generation.current){setLoading('');setActive('');setError(e instanceof Error&&e.name!=='AbortError'?e.message:'语音等待超时，点击这句旁边的播放按钮可重试。')}}
  async function preview(role:'chen'|'zhao'){
    unlockAudio();const key='sample-'+role;if(active===key){stop();return}stop();setError('');setLoading(key);const ticket=generation.current;
    try{const audio=await fetchAudio(key,'/voice-'+role+'.mp3',ticket);if(audio)await play(key,audio,ticket)}catch(e){report(e,ticket)}
  }
  async function run(token:string,messages:VoiceMessage[]){
    stop();setError('');const ticket=generation.current;
    for(const m of messages){
      if(ticket!==generation.current)return;
      if(!spokenDialogue(m)||!ready[m.speaker as 'chen'|'zhao'])continue;
      setLoading(m.id);
      try{const audio=await fetchAudio(m.speaker+':'+m.id,'/api/voice',ticket,{token,messageId:m.id,...(story?{story}:{})});if(audio)await play(m.id,audio,ticket)}catch(e){report(e,ticket)}
    }
    if(ticket===generation.current)setLoading('');
  }
  function message(token:string,m:VoiceMessage){unlockAudio();if(active===m.id||loading===m.id){stop();return}void run(token,[m])}
  return {ready,active,loading,error,stop,preview,message,enqueue:run,unlock:unlockAudio};
}
