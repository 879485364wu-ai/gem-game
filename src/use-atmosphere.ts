import { useEffect, useRef, useState } from 'react';
import { audioContext, unlockAudio } from './audio-runtime';
export function useAtmosphere(place:string|undefined, speaking:boolean){
  const [enabled,setEnabled]=useState(false);
  const [volume,setVolume]=useState(0.35);
  const node=useRef<{gain:GainNode;filter:BiquadFilterNode;noise:AudioBufferSourceNode;lfo:OscillatorNode;lfoGain:GainNode}|null>(null);
  function ensure(){
    if(node.current)return;
    const ctx=audioContext(),buffer=ctx.createBuffer(1,ctx.sampleRate*12,ctx.sampleRate),data=buffer.getChannelData(0);
    let previous=0;for(let i=0;i<data.length;i++){previous=(previous+0.025*(Math.random()*2-1))/1.025;data[i]=previous*3.5}
    const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    noise.buffer=buffer;noise.loop=true;filter.type='lowpass';filter.frequency.value=place==='terrace'?1200:650;gain.gain.value=0;
    const lfo=ctx.createOscillator(),lfoGain=ctx.createGain();lfo.frequency.value=0.12;lfoGain.gain.value=90;
    lfo.connect(lfoGain);lfoGain.connect(filter.frequency);noise.connect(filter);filter.connect(gain);gain.connect(ctx.destination);
    noise.start();lfo.start();node.current={gain,filter,noise,lfo,lfoGain};
  }
  function begin(){unlockAudio();try{ensure();setEnabled(true)}catch{}}
  function toggle(){if(enabled)setEnabled(false);else begin()}
  useEffect(()=>{
    if(!node.current)return;const ctx=audioContext(),{gain,filter}=node.current;
    gain.gain.setTargetAtTime(enabled?volume*(speaking?0.05:0.14):0,ctx.currentTime,0.5);
    filter.frequency.setTargetAtTime(place==='terrace'?1200:650,ctx.currentTime,1.4);
  },[enabled,volume,place,speaking]);
  useEffect(()=>()=>{const n=node.current;if(n){n.noise.stop();n.lfo.stop();n.noise.disconnect();n.filter.disconnect();n.gain.disconnect();n.lfo.disconnect();n.lfoGain.disconnect()}},[]);
  return {enabled,volume,setVolume,begin,toggle};
}
