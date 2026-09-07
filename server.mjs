import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHmac, timingSafeEqual, randomBytes, createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { handleDemoRequest } from './lib/story-api.mjs';
import { createVoiceHandler, voiceStatus } from './lib/voice.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const common={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
const json=(data,status=200)=>Response.json(data,{status,headers:common});
function equal(a,b){const x=createHash('sha256').update(a).digest(),y=createHash('sha256').update(b).digest();return timingSafeEqual(x,y)}
function loginPage(){return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WeFans · 进入测试</title><style>body{background:#eaf0f5;color:#163950;font:16px/1.8 system-ui;margin:0}main{max-width:460px;margin:12vh auto;padding:36px;background:white;border-radius:20px}h1{font-size:28px}input{box-sizing:border-box;width:100%;padding:14px;font-size:16px;border:1px solid #bacad6;border-radius:8px}button{border:0;border-radius:8px;background:#183c56;color:white;padding:14px 22px;margin-top:18px;font-size:16px;cursor:pointer}small{color:#6b8191}#error{color:#a3332d}@media(max-width:540px){main{margin:24px;padding:24px}}</style><main><small>WEFANS · 奇洛 · 在线体验</small><h1>这一晚，等你走进。</h1><p>输入邀请人给你的测试口令，即可开始真实 AI 对话。</p><form><label for="code">测试口令</label><input id="code" type="password" required autocomplete="current-password"><button>进入体验 →</button><p id="error" role="alert"></p></form><small>测试者无需填写模型 API Key。</small></main><script>document.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=document.querySelector('button'),p=document.getElementById('error');b.disabled=true;p.textContent='';try{const r=await fetch('/api/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:document.getElementById('code').value})});const d=await r.json();if(!r.ok)throw Error(d.error);location.href='/'}catch(err){p.textContent=err.message;b.disabled=false}};</script></html>`}
export function createOnlineDispatcher(env,{folder=root,now=Date.now}={}) {
  const origin=new URL(env.PUBLIC_ORIGIN||env.RENDER_EXTERNAL_URL||'http://127.0.0.1:8765').origin;
  if(!env.QILUO_API_KEY || !env.QILUO_STATE_SECRET || env.QILUO_STATE_SECRET.length<32 || !env.TEST_ACCESS_CODE || env.TEST_ACCESS_CODE.length<8) throw new Error('请在部署环境中设置 QILUO_API_KEY、至少32字符的 QILUO_STATE_SECRET 和至少8字符的 TEST_ACCESS_CODE。');
  const voice=createVoiceHandler(env),limits=new Map();
  function limited(key,max,period){for(const [k,v] of limits)if(now()>v.end)limits.delete(k);let value=limits.get(key);if(!value){if(limits.size>1000)return true;value={end:now()+period,n:0};limits.set(key,value)}value.n++;return value.n>max}
  const sign=value=>createHmac('sha256',env.QILUO_STATE_SECRET).update(value+'|'+env.TEST_ACCESS_CODE).digest('base64url');
  function sessionCookie(){const value=randomBytes(16).toString('hex')+'.'+(now()+7*86400000);return value+'.'+sign(value)}
  function authenticated(req){const token=(req.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('qiluo_access='))?.slice(13);if(!token)return null;const [id,expires,sig,extra]=token.split('.');if(extra || !/^[a-f0-9]{32}$/.test(id) || !/^\d+$/.test(expires) || Number(expires)<now() || !sig || !equal(sign(id+'.'+expires),sig))return null;return id}
  return async function dispatch(req){
    const url=new URL(req.url);
    if(url.pathname==='/healthz' && req.method==='GET')return json({ok:true});
    if(url.origin!==origin || req.headers.get('host')!==url.host)return json({error:'请使用正确的体验网址。'},403);
    if(req.method==='POST' && (req.headers.get('origin')!==origin || !req.headers.get('content-type')?.startsWith('application/json')))return json({error:'请从体验页面操作。'},403);
    if(req.method==='POST' && url.pathname==='/api/access'){
      if(limited('login',30,60000))return json({error:'尝试过于频繁，请一分钟后重试。'},429);
      let data;try{data=await req.json()}catch{return json({error:'口令无法读取。'},400)}
      if(typeof data.code!=='string'||data.code.length>200||!equal(data.code,env.TEST_ACCESS_CODE))return json({error:'测试口令不正确。'},401);
      const cookie='qiluo_access='+sessionCookie()+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800'+(origin.startsWith('https:')?'; Secure':'');
      return Response.json({ok:true},{headers:{...common,'Set-Cookie':cookie}});
    }
    const id=authenticated(req);
    if(!id){if(req.method==='GET' && ['/', '/login'].includes(url.pathname))return new Response(loginPage(),{headers:{...common,'Content-Type':'text/html; charset=utf-8'}});return json({error:'请刷新页面，输入测试口令后继续。'},401)}
    if(url.pathname==='/api/qiluo/status' && req.method==='GET')return json({configured:true,mode:'live',maxModelTurns:30,voices:voiceStatus(env)});
    if(url.pathname==='/api/voice/status' && req.method==='GET')return json(voiceStatus(env));
    if(req.method==='GET' && ['/voice-chen.mp3','/voice-zhao.mp3'].includes(url.pathname)){
      if(limited('voice:'+id,80,3600000)||limited('all-requests',600,60000))return json({error:'语音试听过于频繁，请稍后再试。'},429);
      const response=await voice.preview(url.pathname==='/voice-chen.mp3'?'chen':'zhao');
      return new Response(response.body,{status:response.status,headers:{...common,...Object.fromEntries(response.headers)}});
    }
    if(req.method==='POST' && (url.pathname.startsWith('/api/qiluo/') || url.pathname==='/api/voice')){
      if(limited('request:'+id,80,60000)||limited('all-requests',600,60000))return json({error:'操作太快，请稍后再试。'},429);
      if(url.pathname==='/api/voice' && limited('voice:'+id,80,3600000))return json({error:'本小时语音试听次数已用完，文字仍可继续。'},429);
      const response=url.pathname==='/api/voice'?await voice(req):await handleDemoRequest(req,env);
      return new Response(response.body,{status:response.status,headers:{...common,...Object.fromEntries(response.headers)}});
    }
    if(!['GET','HEAD'].includes(req.method))return json({error:'页面不存在。'},404);
    const files={'/':['index.html','text/html; charset=utf-8'],'/index.html':['index.html','text/html; charset=utf-8']};
    const file=files[url.pathname];if(!file)return json({error:'页面不存在。'},404);
    try{return new Response(req.method==='HEAD'?null:await readFile(path.join(folder,'public',file[0])),{headers:{...common,'Content-Type':file[1]}})}catch{return json({error:'资源暂时不可用。'},404)}
  };
}
export function createNodeServer(env) {
  const dispatch=createOnlineDispatcher(env);
  const origin=new URL(env.PUBLIC_ORIGIN||env.RENDER_EXTERNAL_URL||'http://127.0.0.1:8765').origin;
  return http.createServer(async(req,res)=>{try{let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>600000){res.writeHead(413,common);res.end('请求过长');return}chunks.push(chunk)}const request=new Request(new URL(req.url,origin),{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});const response=await dispatch(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch{res.writeHead(500,common);res.end('服务暂时不可用，请刷新重试。')}});
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{const port=Number(process.env.PORT||10000);const server=createNodeServer(process.env);server.requestTimeout=70000;server.on('error',()=>{console.error('服务启动失败，请检查部署设置。');process.exitCode=1});server.listen(port,'0.0.0.0',()=>console.log('WeFans 在线体验已启动，端口 '+port));}
  catch(e){console.error(e.message);process.exitCode=1}
}
