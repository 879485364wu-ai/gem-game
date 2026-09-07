'use client';

import { useRoleVoice } from './use-role-voice';
import { useAtmosphere } from './use-atmosphere';
import { spokenDialogue } from '../lib/dialogue.mjs';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, Clock3, Eye, History, Info, LoaderCircle, MapPin, MessageCircle, RotateCcw, Save, Send, Sparkles, Users, Volume2, VolumeX, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PEOPLE, PLACES, attitudeText, counterpart, type ActionId, type DemoView, type Person, type Place, type Role } from '@/lib/qiluo-demo';

type Session = { token: string; view: DemoView };
const CURRENT = 'wefans-qiluo-online-v2';
const BOOKMARK = 'wefans-qiluo-online-bookmark-v2';
function Avatar({ person, small = false }: { person: Person; small?: boolean }) {
  return <span className={`qd-avatar ${small ? 'qd-avatar-small' : ''}`} style={{ '--person-color': PEOPLE[person].color } as React.CSSProperties}>{PEOPLE[person].initial}</span>;
}
function fromStore(key: string): Session | null { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v?.token && v?.view ? v : null; } catch { return null; } }

export default function QiluoDemo() {
  const roleVoice = useRoleVoice();
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
  const [voice, setVoice] = useState(true);
  const [canSpeak, setCanSpeak] = useState(false);
  const [autoSaved, setAutoSaved] = useState(true);
  const bottom = useRef<HTMLDivElement>(null);
  const compose = useRef<HTMLTextAreaElement>(null);
  const view = session?.view;
  const atmosphere = useAtmosphere(view?.place, Boolean(roleVoice.active));
  const npc = view?.people.find(p => p.id === target);
  useEffect(() => {
    setSaved(fromStore(CURRENT)); setBookmark(fromStore(BOOKMARK));
    setCanSpeak(true);
    fetch('/api/qiluo/status').then(r => r.json()).then(d => setConnected(Boolean((d as { configured?: boolean }).configured))).catch(() => setConnected(false));
    return () => roleVoice.stop();
  }, []);
  useEffect(() => { if (!busy) { setLoadingSeconds(0); return; } const t = setInterval(() => setLoadingSeconds(s => s + 1), 1000); return () => clearInterval(t); }, [busy]);
  useEffect(() => { if (view?.turn) bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [view?.turn, busy]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(t); }, [notice]);
  function stopVoice() { roleVoice.stop(); }
  function speak(m: DemoView['messages'][number] | undefined, token: string) {
    if (!m || !['chen','zhao'].includes(m.speaker) || !roleVoice.ready[m.speaker as Role]) return;
    void roleVoice.message(token, m);
  }
  function persist(next: Session) {
    setSession(next); setSaved(next);
    try { localStorage.setItem(CURRENT, JSON.stringify(next)); setAutoSaved(true); }
    catch { setAutoSaved(false); setNotice('本机存储空间不足，当前体验仍可继续。'); }
    if (!next.view.present.includes(target)) setTarget(next.view.present[0] || counterpart(next.view.role));
  }
  async function call(path: string, body: unknown) {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
    const data = await r.json() as Session & { error?: string }; if (!r.ok) throw new Error(data.error || '暂时未能连接，请重试。'); return data;
  }
  async function open(data: { role: Role } | { token: string }) {
    if (busyRef.current) return; roleVoice.unlock(); atmosphere.begin(); busyRef.current = true; setBusy(true); setError(''); stopVoice();
    try {
      const next = await call('/api/qiluo/session', data);
      setPrevious(null);
      if (voice) void roleVoice.enqueue(next.token, next.view.messages.filter(m => m.source === 'opening'));
      persist(next); setTarget(next.view.present[0]); setRestart(false); setText(''); setConnected(true);
    } catch (e) { setError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : '连接有点慢，请再试一次。'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function turn(action: ActionId, options: { place?: Place; text?: string } = {}) {
    if (!session || busyRef.current) return;
    if (action === 'say' && !(options.text || text).trim()) return;
    roleVoice.unlock(); busyRef.current = true; setBusy(true); setError(''); stopVoice();
    try {
      const next = await call('/api/qiluo/turn', { token: session.token, requestId: crypto.randomUUID(), action, target, ...(action === 'say' ? { text: (options.text || text).trim() } : {}), ...(options.place ? { place: options.place } : {}) });
      setPrevious(session); persist(next); if (action === 'say') setText('');
      if (voice && action !== 'move') void roleVoice.enqueue(next.token, next.view.messages.filter(m => m.turn === next.view.turn));
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
      <button className="qd-person-title" disabled={busy || !view.present.includes(p.id)} onClick={() => { setTarget(p.id); setMobilePanel(false); }}><Avatar person={p.id} small /><span><b>{PEOPLE[p.id].name}</b><small>{PLACES[p.place]}</small></span>{view.present.includes(p.id) ? <MessageCircle size={16} /> : <MapPin size={15} />}</button>
      <p className="qd-attitude">{attitudeText(p.attitude)}</p>
      <details><summary><Eye size={14} /> 他知道了什么 <ChevronDown size={14} /></summary><div className="qd-knowledge">{p.known.length ? p.known.slice(-5).map(k => <p key={k.eventId}><span>{k.certainty === 'seen' ? '亲自在场' : k.certainty === 'reported' ? '尚待核实' : '消息已核实'}</span>{k.text}<small>{k.via}</small></p>) : <p>还不知道场外发生的新事情。</p>}</div></details>
      <details><summary>关系的方向 <ChevronDown size={14} /></summary><div className="qd-direction">{p.id !== 'chen' && <p>对陈挽：{attitudeText(p.towardChen)}</p>}{p.id !== 'zhao' && <p>对赵声阁：{attitudeText(p.towardZhao)}</p>}</div></details>
    </article>)}</div> : <div className="qd-event-list">{view.changes.length === 0 && <p className="qd-empty-note">从一句话、一个行动开始。发生过的事，会留在这里。</p>}{[...view.changes].reverse().map(c => <article key={c.id}><span>{PEOPLE[c.observer].name} → {PEOPLE[c.actor].name}</span><p>{c.reason}</p><small>{c.via}</small><b>{attitudeText(c.after)}</b></article>)}<div className="qd-moment-actions"><button disabled={busy || !previous} onClick={() => previous && open({ token: previous.token })}><RotateCcw size={15} />回到上一步</button><button disabled={busy || !bookmark} onClick={() => bookmark && open({ token: bookmark.token })}><BookOpen size={15} />读取保存的一刻</button></div></div>}
    <p className="qd-observer-note">这里展示人物的见闻与态度，方便观察这段体验里的因果。</p>
  </>;

  return <div className="qd-app">
    <header className="qd-header"><a href="/" className="qd-brand" aria-label="WeFans 首页"><img src={window.__QILUO_ASSETS__["/wefans-logo.png"]} alt="WeFans" /></a><span className="qd-header-line" /><span className="qd-book-title">奇洛李维斯的回信</span><div className="qd-header-right"><span className="qd-online-label">在线测试</span><button onClick={() => setInfo(true)} aria-label="体验说明"><Info size={18} /><span>体验说明</span></button></div></header>
    {!view ? <main className="qd-start"><div className="qd-start-image"><img src={window.__QILUO_ASSETS__["/qiluo-harbour.png"]} alt="海湾与依山而建的城市" /></div><div className="qd-start-content"><div className="qd-kicker"><span /> 自由体验 · 接风宴间隙</div><h1>这一晚，<br />你想成为谁？</h1><p className="qd-start-intro">雨声未歇，宴席暂散。<br />从一句话、一个行动开始，走近他。</p>{roleCards()}<div className="qd-voice-previews">{(["chen","zhao"] as Role[]).map(role => <button type="button" key={role} onClick={() => roleVoice.preview(role)}><Volume2 size={16}/>{roleVoice.loading === "sample-"+role ? "生成中 · " : roleVoice.active === "sample-"+role ? "停止" : "试听"}{PEOPLE[role].name}音色</button>)}</div><p className="qd-voice-note">音色试听 · 专属动态对白音色{roleVoice.ready.chen && roleVoice.ready.zhao ? "已接通" : "待接通"}</p>
      {saved && <button className="qd-resume" disabled={busy} onClick={() => open({ token: saved.token })}><History size={18} /><span>继续上次的这一晚 <small>{PEOPLE[saved.view.role].name} · 第{saved.view.modelCalls}次交谈</small></span><ArrowRight size={18} /></button>}
      <div className="qd-start-footer"><span>{busy ? <><LoaderCircle size={15} className="qd-spin" />正在走进故事…</> : connected === null ? '正在确认连接…' : connected ? '可自由交谈 · 行动留下余波 · 本机保存' : '连接暂时不可用，请稍后刷新'}</span><small>原著世界 · 改编体验</small></div>
      {error && <p className="qd-error" role="alert">{error}</p>}
    </div></main> : <main className="qd-play">
      <div className="qd-play-top"><button onClick={() => setRestart(true)} disabled={busy}><ArrowLeft size={17} />切换角色</button><span><Avatar person={view.role} small />你是 <b>{PEOPLE[view.role].name}</b></span><div><button title="将当前进度保存在这台设备" onClick={saveBookmark} disabled={busy}><Save size={16} /><span>保存这一刻</span></button><button className="qd-mobile-open" onClick={() => setMobilePanel(true)}><Users size={18} />人物与记忆</button></div></div>
      <div className="qd-play-grid"><section className="qd-story">
        <div className="qd-scene-banner"><img src={window.__QILUO_ASSETS__["/qiluo-harbour.png"]} alt="雨夜海湾的意境图" /><div><span className="qd-kicker">奇洛 · 自由体验</span><h1>雨声中的片刻</h1><p><MapPin size={14} />{PLACES[view.place]}<span>晚宴间隙</span></p></div><span className="qd-chapter-mark">01</span></div>
        <div className="qd-ambience"><button type="button" onClick={atmosphere.toggle} aria-pressed={atmosphere.enabled}>{atmosphere.enabled ? <Volume2 size={15}/> : <VolumeX size={15}/>}雨夜氛围 {atmosphere.enabled ? "开" : "关"}</button><label>环境音量<input aria-label="环境音量" type="range" min="0" max="1" step="0.05" value={atmosphere.volume} onChange={e => atmosphere.setVolume(Number(e.target.value))}/></label><span>{roleVoice.active ? "他开口时，雨声渐轻" : view.place === "terrace" ? "檐下雨声近了些" : "雨声隔在窗外"}</span></div><div className="qd-locations" aria-label="场景位置">{(['hall', 'terrace'] as Place[]).map(p => <button key={p} aria-pressed={view.place === p} className={view.place === p ? 'active' : ''} disabled={busy || view.place === p} onClick={() => turn('move', { place: p })}><MapPin size={15} />{PLACES[p]}{p !== view.place && <ArrowRight size={14} />}</button>)}</div>
        <div className="qd-transcript" role="log" aria-label="剧情对话" aria-live="polite" aria-relevant="additions"><div className="qd-story-date"><span />这一晚，由此开始<span /></div>{view.messages.map(m => <article key={m.id} className={`qd-message ${m.speaker === view.role ? 'qd-message-player' : ''} ${m.speaker === 'scene' ? 'qd-message-scene' : ''}`}>
          {m.speaker !== 'scene' && <div className="qd-message-name"><Avatar person={m.speaker} small /><b>{PEOPLE[m.speaker].name}</b>{m.speaker === view.role ? <small>{m.source === 'action' ? '你的行动' : '你的回应'}</small> : <small>{m.source === 'opening' ? '故事开场' : '回应'}</small>}{canSpeak && spokenDialogue(m) && <button title={roleVoice.ready[m.speaker as Role] ? '播放角色对白' : '专属音色尚未配置'} disabled={!roleVoice.ready[m.speaker as Role]} onClick={() => speak(m,session!.token)} aria-label={`朗读${PEOPLE[m.speaker].name}的回应`}><Volume2 size={14} />{roleVoice.loading === m.id ? "生成中" : roleVoice.active === m.id ? "停止" : ""}</button>}</div>}
          <div className="qd-message-body">{m.text.split('\n').filter(Boolean).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
        </article>)}{busy && <div className="qd-waiting"><span className="qd-wait-dots"><i /><i /><i /></span><span>{loadingSeconds > 20 ? '回应还在路上，请稍等片刻…' : `${PEOPLE[target].name}正在回应…`}<small>{loadingSeconds > 0 ? `${loadingSeconds} 秒` : ''}</small></span></div>}<div ref={bottom} /></div>
        <div className="qd-compose"><div className="qd-compose-to"><span>低声与谁交谈</span><div>{view.present.map(p => <button className={target === p ? 'active' : ''} aria-pressed={target === p} key={p} disabled={busy} onClick={() => { setTarget(p); setText(''); }}><Avatar person={p} small />{PEOPLE[p].name}</button>)}</div></div>
          {view.modelCalls === 0 && <div className="qd-suggestion"><button disabled={busy} onClick={() => turn('say', { text: view.role === 'chen' ? '今晚难得能安静一会儿。您要不要在窗边坐坐？' : '刚才一直看你在忙，现在还有什么没处理完？' })}>从一句问候开始 <ChevronRight size={15} /></button></div>}
          <form onSubmit={e => { e.preventDefault(); turn('say'); }}><label className="sr-only" htmlFor="qiluo-input">对{PEOPLE[target].name}说的话</label><textarea id="qiluo-input" ref={compose} value={text} maxLength={800} disabled={busy || view.modelCalls >= 30} rows={2} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); turn('say'); } }} placeholder={`对${PEOPLE[target].name}说些什么…`} /><button className="qd-send" disabled={busy || !text.trim() || view.modelCalls >= 30} aria-label="发送回应">{busy ? <LoaderCircle size={20} className="qd-spin" /> : <Send size={20} />}</button></form>
          <div className="qd-compose-meta"><span>Enter 发送 · Shift + Enter 换行</span><span>{text.length}/800</span></div>
          {error && <p className="qd-error" role="alert">{error}</p>}
          <details className="qd-actions" open><summary><Sparkles size={15} />也可以做一个行动<ChevronDown size={15} /></summary><div>{npc?.actions.map(a => <button key={a.id} title={a.description} disabled={busy || view.modelCalls >= 30} onClick={() => turn(a.id)}><span>{a.label}</span><ArrowRight size={15} /></button>)}{!npc?.actions.length && <p>此刻可以继续交谈，或去另一处走走。</p>}</div></details>
          <div className="qd-voice-feedback">{(roleVoice.active || roleVoice.loading) && <button onClick={stopVoice}><VolumeX size={14}/>停止语音</button>}<small>角色语音 · AI 合成{!roleVoice.ready.chen || !roleVoice.ready.zhao ? " · 部分音色待接通" : ""}</small>{roleVoice.error && <p role="alert">{roleVoice.error}</p>}</div><div className="qd-compose-bottom"><span><Check size={13} />{autoSaved ? '本机自动保存' : '本机保存不可用'} · {view.modelCalls}/30 次交谈</span>{canSpeak && <button disabled={!roleVoice.ready.chen && !roleVoice.ready.zhao} onClick={() => { roleVoice.unlock(); setVoice(!voice); if (voice) stopVoice(); }} aria-pressed={voice}>{voice ? <Volume2 size={14} /> : <VolumeX size={14} />}自动角色语音{voice ? '开启' : '关闭'}</button>}</div>
          {view.modelCalls >= 30 && <div className="qd-limit"><p>这一段先停在这里。保存这一刻，或换一位主角再走一遍。</p><button onClick={() => setRestart(true)}>开启新的这一晚 <ArrowRight size={16} /></button></div>}
        </div>
      </section><aside className="qd-aside">{relations}</aside></div>
    </main>}
    {!view && roleVoice.error && <p className="qd-error" role="alert">{roleVoice.error}</p>}
    {notice && <div className="qd-toast" role="status"><Check size={16} />{notice}</div>}
    <Dialog open={info} onOpenChange={setInfo}><DialogContent className="qd-dialog"><DialogHeader><DialogTitle>走进这一晚</DialogTitle><DialogDescription>《奇洛李维斯的回信》基础体验</DialogDescription></DialogHeader><div className="qd-help"><p>代入陈挽或赵声阁，选择同一场景里的人物，自由交谈，也可以点选一个具体行动。</p><p><b>试试一条有因果的走法：</b>在宴会厅答应核对安排 → 把事情做完 → 去露台问沈宗年的看法 → 告诉他刚才的事 → 请在场的人确认，再问一次。</p><p>人物只知道自己看到或收到的消息。右侧“人物”可以查看见闻，“这一晚”记录行动带来的关系变化。</p><p>当前是独立改编体验，点选行动有确定的事件规则；自由输入中的重大行动是尝试。对话会真实生成，仍可能出现不贴合人物的表达。</p><p>进度保存在这台设备，7天内可以继续；每段最多30次交谈。陈挽与赵声阁的开场、输入对白和新回复均使用各自专属音色，依次播放，属于 AI 合成。括号中的动作与旁白不朗读。雨夜环境声可单独关闭或调节。选择页的音色试听由服务器以复刻音色合成新台词。尚未配置的音色会显示待接通。</p></div></DialogContent></Dialog>
    <Dialog open={restart} onOpenChange={setRestart}><DialogContent className="qd-dialog qd-role-dialog"><DialogHeader><DialogTitle>开启新的这一晚</DialogTitle><DialogDescription>选择代入的主角。新体验会替换自动进度；“保存的一刻”会保留。</DialogDescription></DialogHeader>{roleCards(true)}{error && <p className="qd-error" role="alert">{error}</p>}</DialogContent></Dialog>
    <Dialog open={mobilePanel} onOpenChange={setMobilePanel}><DialogContent className="qd-dialog qd-people-dialog"><DialogHeader><DialogTitle>人物与这一晚</DialogTitle><DialogDescription>不同的见闻，留下不同的余波。</DialogDescription></DialogHeader>{relations}</DialogContent></Dialog>
  </div>;
}
