'use client';

import { useAtmosphere } from './use-atmosphere';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, Clock3, Eye, History, Info, LoaderCircle, MapPin, MessageCircle, RotateCcw, Save, Send, Sparkles, Users, Volume2, VolumeX, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PEOPLE, PLACES, attitudeText, counterpart, type ActionId, type DemoView, type Person, type Place, type Role, type Item } from '@/lib/qiluo-demo';

type Session = { token: string; view: DemoView };
const CURRENT = 'wefans-qiluo-online-v2';
const BOOKMARK = 'wefans-qiluo-online-bookmark-v2';
function Avatar({ person, small = false }: { person: Person; small?: boolean }) {
  return <span className={`qd-avatar ${small ? 'qd-avatar-small' : ''}`} style={{ '--person-color': PEOPLE[person].color } as React.CSSProperties}>{PEOPLE[person].initial}</span>;
}
function fromStore(key: string): Session | null { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v?.token && v?.view ? v : null; } catch { return null; } }

export default function QiluoDemo() {
  const [session, setSession] = useState<Session | null>(null);
  const [saved, setSaved] = useState<Session | null>(null);
  const [bookmark, setBookmark] = useState<Session | null>(null);
  const [previous, setPrevious] = useState<Session | null>(null);
  const [target, setTarget] = useState<Person>('zhao');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [connected, setConnected] = useState<boolean | null>(null);
  const [panel, setPanel] = useState<'people' | 'memory'>('people');
  const [mobilePanel, setMobilePanel] = useState(false);
  const [info, setInfo] = useState(false);
  const [restart, setRestart] = useState(false);
  const [mode,setMode]=useState<'act'|'say'>('act');
  const [autoSaved, setAutoSaved] = useState(true);
  const bottom = useRef<HTMLDivElement>(null);
  const compose = useRef<HTMLTextAreaElement>(null);
  const view = session?.view;
  const atmosphere = useAtmosphere(view?.place, false);
  const npc = view?.people.find(p => p.id === target);
  useEffect(() => {
    setSaved(fromStore(CURRENT)); setBookmark(fromStore(BOOKMARK));
    fetch('/api/qiluo/status').then(r => r.json()).then(d => setConnected(Boolean((d as { configured?: boolean }).configured))).catch(() => setConnected(false));
  }, []);
  useEffect(() => { if (!busy) { setLoadingSeconds(0); return; } const t = setInterval(() => setLoadingSeconds(s => s + 1), 1000); return () => clearInterval(t); }, [busy]);
  useEffect(() => { if (view?.turn) bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [view?.turn, busy]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(t); }, [notice]);
  function persist(next: Session) {
    setSession(next); setSaved(next);
    try { localStorage.setItem(CURRENT, JSON.stringify(next)); setAutoSaved(true); }
    catch { setAutoSaved(false); setNotice('本机存储空间不足，当前体验仍可继续。'); }
    if (!next.view.present.includes(target)) setTarget(next.view.present[0] || counterpart(next.view.role));
    if(!next.view.present.length)setMode('act');
  }
  async function call(path: string, body: unknown) {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(100000) });
    const data = await r.json() as Session & { error?: string }; if (!r.ok) throw new Error(data.error || '暂时未能连接，请重试。'); return data;
  }
  async function open(data: { role: Role } | { token: string }) {
    if (busyRef.current) return; busyRef.current = true; setBusy(true); setError('');
    try {
      const next = await call('/api/qiluo/session', data);
      setPrevious(null);
      persist(next); setTarget(next.view.present[0]||counterpart(next.view.role)); setMode('act'); setRestart(false); setText(''); setConnected(true);
    } catch (e) { setError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : '连接有点慢，请再试一次。'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function turn(action: ActionId, options: { place?: Place; text?: string; item?:Item } = {}) {
    if (!session || busyRef.current) return;
    const typed=action==='say'||action==='act';
    if (typed && !(options.text || text).trim()) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const next = await call('/api/qiluo/turn', { token: session.token, requestId: crypto.randomUUID(), action, ...(action!=='act'?{target}:{}), ...(typed ? { text: (options.text || text).trim() } : {}), ...(options.place ? { place: options.place } : {}), ...(options.item?{item:options.item}:{}) });
      setPrevious(session); persist(next); if (typed) setText('');
    } catch (e) { setError(e instanceof Error && !/Abort|Timeout/i.test(e.name) ? e.message : '回应等待超时，进度没有改变。可以重试。'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  function saveBookmark() {
    if (!session) return;
    try { localStorage.setItem(BOOKMARK, JSON.stringify(session)); setBookmark(session); setNotice('已保存这一刻，可以随时回来。'); }
    catch { setNotice('本机空间不足，暂时无法保存。'); }
  }
  const roleCards = (inDialog = false) => <div className={`qd-role-grid ${inDialog ? 'qd-role-grid-dialog' : ''}`}>{(['chen', 'zhao'] as Role[]).map(role => <button className={`qd-role qd-role-${role}`} key={role} disabled={busy || connected === false} onClick={() => open({ role })}>
    <div className="qd-role-head"><Avatar person={role} /><span className="qd-role-tag">代入角色</span></div>
    <h2>{PEOPLE[role].name}</h2><span className="qd-role-label">{PEOPLE[role].label}</span><p>{PEOPLE[role].introduction}</p>
    <span className="qd-role-enter">以他的视角，走进这一晚 <ArrowRight size={18} /></span>
  </button>)}</div>;
  const relations = view && <>
    <div className="qd-panel-switch"><button className={panel === 'people' ? 'active' : ''} onClick={() => setPanel('people')}><Users size={16} />人物</button><button className={panel === 'memory' ? 'active' : ''} onClick={() => setPanel('memory')}><History size={16} />这一晚</button></div>
    {panel === 'people' ? <div className="qd-people-list">{view.people.map(p => <article key={p.id} className="qd-person-card">
      <button className="qd-person-title" disabled={busy || !view.present.includes(p.id)} onClick={() => { setTarget(p.id); setMode("say"); setMobilePanel(false); }}><Avatar person={p.id} small /><span><b>{PEOPLE[p.id].name}</b><small>{PLACES[p.place]}</small></span>{view.present.includes(p.id) ? <MessageCircle size={16} /> : <MapPin size={15} />}</button>
      <p className="qd-attitude">{attitudeText(p.attitude)}</p>
      <details><summary><Eye size={14} /> 他知道了什么 <ChevronDown size={14} /></summary><div className="qd-knowledge">{p.known.length ? p.known.slice(-5).map(k => <p key={k.eventId}><span>{k.certainty === 'seen' ? '亲自在场' : k.certainty === 'reported' ? '尚待核实' : '消息已核实'}</span>{k.text}<small>{k.via}</small></p>) : <p>还不知道场外发生的新事情。</p>}</div></details>
      <details><summary>关系的方向 <ChevronDown size={14} /></summary><div className="qd-direction">{p.id !== 'chen' && <p>对陈挽：{attitudeText(p.towardChen)}</p>}{p.id !== 'zhao' && <p>对赵声阁：{attitudeText(p.towardZhao)}</p>}</div></details>
    </article>)}</div> : <div className="qd-event-list">{view.changes.length === 0 && <p className="qd-empty-note">从一句话、一个行动开始。发生过的事，会留在这里。</p>}{[...view.changes].reverse().map(c => <article key={c.id}><span>{PEOPLE[c.observer].name} → {PEOPLE[c.actor].name}</span><p>{c.reason}</p><small>{c.via}</small><b>{attitudeText(c.after)}</b></article>)}<div className="qd-causal-events">{[...view.events].filter(e=>e.witnesses.includes(view.role)||e.kind==='invitation').slice(-16).reverse().map(e=><article key={e.id}><span>{PEOPLE[e.actor].name} · 第{e.turn}步</span><p>{e.text}</p>{e.motive&&<small>行动缘由：{e.motive}</small>}</article>)}</div><div className="qd-moment-actions"><button disabled={busy || !previous} onClick={() => previous && open({ token: previous.token })}><RotateCcw size={15} />回到上一步</button><button disabled={busy || !bookmark} onClick={() => bookmark && open({ token: bookmark.token })}><BookOpen size={15} />读取保存的一刻</button></div></div>}
    <p className="qd-observer-note">这里展示人物的见闻与态度，方便观察这段体验里的因果。</p>
  </>;

  return <div className="qd-app">
    <header className="qd-header"><a href="/" className="qd-brand" aria-label="WeFans 首页"><img src={window.__QILUO_ASSETS__["/wefans-logo.png"]} alt="WeFans" /></a><span className="qd-header-line" /><span className="qd-book-title">奇洛李维斯的回信</span><div className="qd-header-right"><span className="qd-online-label">在线测试</span><button onClick={() => setInfo(true)} aria-label="体验说明"><Info size={18} /><span>体验说明</span></button></div></header>
    {!view ? <main className="qd-start"><div className="qd-start-image"><img src={window.__QILUO_ASSETS__["/qiluo-harbour.png"]} alt="海湾与依山而建的城市" /></div><div className="qd-start-content"><div className="qd-kicker"><span /> 自由体验 · 接风宴间隙</div><h1>这一晚，<br />你想成为谁？</h1><p className="qd-start-intro">雨声未歇，宴席暂散。<br />从一句话、一个行动开始，走近他。</p>{roleCards()}<p className="qd-voice-note">第一章已支持角色语音 · 这一晚，可以说话，也可以行动</p>
      {saved && <button className="qd-resume" disabled={busy} onClick={() => open({ token: saved.token })}><History size={18} /><span>继续上次的这一晚 <small>{PEOPLE[saved.view.role].name} · 第{saved.view.turn}步</small></span><ArrowRight size={18} /></button>}
      <div className="qd-start-footer"><span>{busy ? <><LoaderCircle size={15} className="qd-spin" />正在走进故事…</> : connected === null ? '正在确认连接…' : connected ? '自由行动 · 人物主动回应 · 本机保存' : '连接暂时不可用，请稍后刷新'}</span><small>原著世界 · 改编体验</small></div>
      {error && <p className="qd-error" role="alert">{error}</p>}
    </div></main> : <main className="qd-play">
      <div className="qd-play-top"><button onClick={() => setRestart(true)} disabled={busy}><ArrowLeft size={17} />切换角色</button><span><Avatar person={view.role} small />你是 <b>{PEOPLE[view.role].name}</b></span><div><button title="将当前进度保存在这台设备" onClick={saveBookmark} disabled={busy}><Save size={16} /><span>保存这一刻</span></button><button className="qd-mobile-open" onClick={() => setMobilePanel(true)}><Users size={18} />人物与记忆</button></div></div>
      <div className="qd-play-grid"><section className="qd-story">
        <div className="qd-scene-banner"><img src={window.__QILUO_ASSETS__["/qiluo-harbour.png"]} alt="雨夜海湾的意境图" /><div><span className="qd-kicker">奇洛 · 自由体验</span><h1>雨声中的片刻</h1><p><MapPin size={14} />{PLACES[view.place]}<span>{view.clock} · {view.weather === "rain" ? "雨未停" : "雨渐小"}</span></p></div><span className="qd-chapter-mark">01</span></div>
        <div className="qd-ambience"><button type="button" onClick={atmosphere.toggle} aria-pressed={atmosphere.enabled}>{atmosphere.enabled ? <Volume2 size={15}/> : <VolumeX size={15}/>}雨夜氛围 {atmosphere.enabled ? "开" : "关"}</button><label>环境音量<input aria-label="环境音量" type="range" min="0" max="1" step="0.05" value={atmosphere.volume} onChange={e => atmosphere.setVolume(Number(e.target.value))}/></label><span>{view.place === "terrace" || view.place === "street" ? "檐下雨声近了些" : "雨声隔在窗外"}</span></div><div className="qd-locations" aria-label="场景位置">{(Object.keys(PLACES) as Place[]).map(p => <button key={p} aria-pressed={view.place === p} className={view.place === p ? 'active' : ''} disabled={busy || view.place === p} onClick={() => turn('move', { place: p })}><MapPin size={15} />{PLACES[p]}{p !== view.place && <ArrowRight size={14} />}</button>)}</div>
        <div className="qd-transcript" role="log" aria-label="剧情对话" aria-live="polite" aria-relevant="additions"><div className="qd-story-date"><span />这一晚，由此开始<span /></div>{view.messages.map(m => <article key={m.id} className={`qd-message ${m.speaker === view.role ? 'qd-message-player' : ''} ${m.speaker === 'scene' ? 'qd-message-scene' : ''}`}>
          {m.speaker !== 'scene' && <div className="qd-message-name"><Avatar person={m.speaker} small /><b>{PEOPLE[m.speaker].name}</b>{m.speaker === view.role ? <small>{m.source === 'action' || m.action === 'act' ? '你的行动' : '你的话'}</small> : <small>{m.source === 'opening' ? '故事开场' : '他的行动与回应'}</small>}</div>}
          <div className="qd-message-body">{m.text.split('\n').filter(Boolean).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
        </article>)}{busy && <div className="qd-waiting"><span className="qd-wait-dots"><i /><i /><i /></span><span>{loadingSeconds > 20 ? '正在整理人物的行动，请稍等片刻…' : '故事正在向前…'}<small>{loadingSeconds > 0 ? `${loadingSeconds} 秒` : ''}</small></span></div>}<div ref={bottom} /></div>
        <div className="qd-world-state"><p><Clock3 size={15}/><b>{view.clock}</b><span>{view.scene}</span></p><div><b>随身物品</b>{view.inventory.length ? view.inventory.map(item=><button key={item.id} disabled={busy} onClick={()=>turn('use',{item:item.id})} title="使用这件物品">{item.name}<ChevronRight size={13}/></button>) : <span>暂时没有物品</span>}</div>{view.flags.includes('transport-checked') && <small><Check size={13}/>候车安排已核实 · 可向不在场的人转述</small>}</div>
        <div className="qd-compose"><div className="qd-input-modes"><button type="button" className={mode==='act'?'active':''} aria-pressed={mode==='act'} onClick={()=>setMode('act')}><Sparkles size={16}/>自由行动</button><button type="button" className={mode==='say'?'active':''} aria-pressed={mode==='say'} disabled={!view.present.length} onClick={()=>setMode('say')}><MessageCircle size={16}/>与人交谈</button><span>角色语音已暂停</span></div>
          {mode==='say' ? <div className="qd-compose-to"><span>和谁说话</span><div>{view.present.map(p=><button className={target===p?'active':''} key={p} disabled={busy} onClick={()=>setTarget(p)}><Avatar person={p} small/>{PEOPLE[p].name}</button>)}</div></div> : <p className="qd-action-hint">直接写想做的事，也可以托人办事。例：“请卓智轩把沈宗年叫过来。”</p>}
          <form onSubmit={e => { e.preventDefault(); turn(mode); }}><label className="sr-only" htmlFor="qiluo-input">{mode==='act'?'你想做什么':`对${PEOPLE[target].name}说的话`}</label><textarea id="qiluo-input" ref={compose} value={text} maxLength={800} disabled={busy || view.modelCalls>=30} rows={3} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();turn(mode)}}} placeholder={mode==='act'?'你想做什么？例如：我离开宴会厅，去门厅取伞。':`对${PEOPLE[target].name}说些什么…`}/><button className="qd-send" disabled={busy||!text.trim()||view.modelCalls>=30} aria-label="推进故事">{busy?<LoaderCircle size={20} className="qd-spin"/>:<Send size={20}/>}</button></form>
          <div className="qd-compose-meta"><span>Enter 发送 · Shift + Enter 换行</span><span>{text.length}/800</span></div>
          {error && <p className="qd-error" role="alert">{error}</p>}
          <div className="qd-quick-actions"><button disabled={busy} onClick={()=>turn('look')}><Eye size={15}/>看看四周</button><button disabled={busy} onClick={()=>turn('wait')}><Clock3 size={15}/>安静等五分钟</button>{view.nearbyItems.map(item=><button disabled={busy} key={item.id} onClick={()=>turn('take',{item:item.id})}>拿起{item.name}</button>)}{view.place==='lobby'&&!view.flags.includes('transport-checked')&&<button disabled={busy} onClick={()=>turn('arrange')}>核对候车安排</button>}</div>
          {mode==='say' && <details className="qd-actions"><summary><Sparkles size={15}/>与他互动<ChevronDown size={15}/></summary><div>{npc?.actions.map(a=><button key={a.id} title={a.description} disabled={busy||view.modelCalls>=30} onClick={()=>turn(a.id)}><span>{a.label}</span><ArrowRight size={15}/></button>)}</div></details>}
          <div className="qd-compose-bottom"><span><Check size={13}/>{autoSaved?'本机自动保存':'本机保存不可用'} · 第{view.turn}步 · {view.modelCalls}/30 次自由推演</span></div>
          {view.modelCalls >= 30 && <div className="qd-limit"><p>自由推演次数已用完，仍可查看、移动和使用物品。也可以保存后重新开始。</p><button onClick={() => setRestart(true)}>开启新的这一晚 <ArrowRight size={16} /></button></div>}
        </div>
      </section><aside className="qd-aside">{relations}</aside></div>
    </main>}
    {notice && <div className="qd-toast" role="status"><Check size={16} />{notice}</div>}
    <Dialog open={info} onOpenChange={setInfo}><DialogContent className="qd-dialog"><DialogHeader><DialogTitle>走进这一晚</DialogTitle><DialogDescription>《奇洛李维斯的回信》基础体验</DialogDescription></DialogHeader><div className="qd-help"><p>代入陈挽或赵声阁。默认“自由行动”可以直接写行动和说话，不必先选聊天对象；也可以切到“与人交谈”明确向谁说话。</p><p><b>试试托人办事：</b>对卓智轩说“帮我把沈宗年叫过来” → 卓实际去传话 → 沈收到邀请、过来并询问。只有在场或收到消息的人会参与。</p><p><b>也可以自己走走：</b>去门厅取伞 → 撑伞到街边 → 安静等一会儿 → 回到宴会厅。位置、时间、物品和见闻会保留。</p><p>NPC 可以根据来由移动、传话、主动追问，也会有自己的顾虑。不会因为你写了结果就直接改变身份、感情或让不在场的人知道秘密。</p><p>当前片段开放宴会厅、露台、走廊、门厅和门外街边。更远的路线尚未开放。右侧可以查看人物的位置、见闻和行动余波。</p><p>角色语音已暂停，环境声默认关闭，可手动开启。旧进度仍可继续；进度在本机保存7天，每段最多60步、30次自由推演。</p></div></DialogContent></Dialog>
    <Dialog open={restart} onOpenChange={setRestart}><DialogContent className="qd-dialog qd-role-dialog"><DialogHeader><DialogTitle>开启新的这一晚</DialogTitle><DialogDescription>选择代入的主角。新体验会替换自动进度；“保存的一刻”会保留。</DialogDescription></DialogHeader>{roleCards(true)}{error && <p className="qd-error" role="alert">{error}</p>}</DialogContent></Dialog>
    <Dialog open={mobilePanel} onOpenChange={setMobilePanel}><DialogContent className="qd-dialog qd-people-dialog"><DialogHeader><DialogTitle>人物与这一晚</DialogTitle><DialogDescription>不同的见闻，留下不同的余波。</DialogDescription></DialogHeader>{relations}</DialogContent></Dialog>
  </div>;
}
