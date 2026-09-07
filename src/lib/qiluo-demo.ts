export type Role = 'chen' | 'zhao';
export type Person = Role | 'zhuo' | 'shen';
export type Place = 'hall' | 'terrace';
export type Attitude = { trust: number; warmth: number; caution: number };
export type Event = { id: string; kind: string; actor: Person; target: Person; text: string; witnesses: Person[]; turn: number };
export type Knowledge = { eventId: string; via: string; certainty: 'seen' | 'reported' | 'verified' };
export type Message = { id: string; speaker: Person | 'scene'; text: string; action?: string; target?: Person; source: 'opening' | 'action' | 'model' | 'player'; turn: number; reply?: { speaker_id: Person; narrative: string; dialogue: string; used_event_ids: string[] } };
export type Change = { id: string; observer: Person; actor: Person; reason: string; via: string; before: Attitude; after: Attitude; eventId: string };
export type DemoState = {
  version: 1; id: string; created: number; role: Role; place: Place; turn: number; modelCalls: number;
  positions: Record<Person, Place>; events: Event[]; knowledge: Record<Person, Knowledge[]>;
  attitudes: Record<string, Attitude>; messages: Message[]; changes: Change[];
  commitment: null | { target: Person; status: 'open' | 'broken' | 'done' | 'repaired'; witnesses: Person[] };
  usage: { input: number; output: number };
};
export type ActionId = 'say' | 'water' | 'promise' | 'fulfill' | 'withdraw' | 'repair' | 'share' | 'verify' | 'move';
export type TurnInput = { target?: Person; action: ActionId; text?: string; place?: Place; eventId?: string };
export const PEOPLE: Record<Person, { name: string; initial: string; label: string; color: string; introduction: string }> = {
  chen: { name: '陈挽', initial: '挽', label: '温润 · 从容 · 心有所向', color: '#8cbed2', introduction: '把一切安排得妥帖，是你熟悉的事。至于那个人，你还有很多话没有说。' },
  zhao: { name: '赵声阁', initial: '声', label: '内敛 · 敏锐 · 不动声色', color: '#cbb078', introduction: '难得片刻清静。今晚的许多细节都恰到好处，你开始留意那个忙碌的身影。' },
  zhuo: { name: '卓智轩', initial: '卓', label: '陈挽的多年老同学', color: '#a99bc4', introduction: '直率热闹，关心朋友；知道分寸，也有自己的判断。' },
  shen: { name: '沈宗年', initial: '沈', label: '赵声阁的朋友', color: '#8dabaa', introduction: '寡言而敏锐，正在露台廊边接电话。' },
};
export const PLACES: Record<Place, string> = { hall: '宴会厅 · 窗边', terrace: '露台 · 廊边' };
export function counterpart(role: Role): Role { return role === 'chen' ? 'zhao' : 'chen'; }
export function attitude(s: DemoState, observer: Person, actor: Person): Attitude {
  return { ...(s.attitudes[`${observer}:${actor}`] || { trust: 0, warmth: 0, caution: 0 }) };
}
export function initialDemo(role: Role): DemoState {
  const other = counterpart(role);
  return { version: 1, id: crypto.randomUUID(), created: Date.now(), role, place: 'hall', turn: 0, modelCalls: 0,
    positions: { chen: 'hall', zhao: 'hall', zhuo: 'hall', shen: 'terrace' }, events: [],
    knowledge: { chen: [], zhao: [], zhuo: [], shen: [] }, attitudes: {}, changes: [], commitment: null,
    usage: { input: 0, output: 0 }, messages: [
      { id: 'opening', speaker: 'scene', text: '接风宴暂歇，窗外的雨还没有停。乐声隔着半掩的门传来，杯盏间的喧闹终于淡了。卓智轩停在窗边，沈宗年去了露台廊边接电话。', source: 'opening', turn: 0 },
      { id: 'opening-person', speaker: other, text: role === 'chen' ? '赵声阁把杯子放回桌上，抬眼看向你。\n“今晚的安排，辛苦了。”' : '陈挽确认好桌边的酒水，才转过身来。视线落到你脸上时，他的语气放轻了一点。\n“赵先生，要不要在这边坐一会儿？”', source: 'opening', turn: 0 },
    ] };
}
export function present(s: DemoState): Person[] {
  return (Object.keys(PEOPLE) as Person[]).filter(p => p !== s.role && s.positions[p] === s.place);
}
function learn(s: DemoState, person: Person, event: Event, via: string, certainty: Knowledge['certainty']) {
  const entry = s.knowledge[person].find(k => k.eventId === event.id);
  if (entry) { if (entry.certainty === 'reported' && certainty !== 'reported') Object.assign(entry, { via, certainty }); }
  else s.knowledge[person].push({ eventId: event.id, via, certainty });
}
function updateAttitude(s: DemoState, observer: Person, e: Event, via: string, reason: string, delta: Partial<Attitude>) {
  if (observer === e.actor || observer === s.role) return;
  const before = attitude(s, observer, e.actor);
  const after = Object.fromEntries(Object.entries(before).map(([key, value]) => [key, Math.max(-8, Math.min(8, value + (delta[key as keyof Attitude] || 0)))])) as Attitude;
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  s.attitudes[`${observer}:${e.actor}`] = after;
  s.changes.push({ id: crypto.randomUUID(), observer, actor: e.actor, before, after, reason, via, eventId: e.id });
}
function eventEffect(s: DemoState, observer: Person, event: Event, via: string) {
  // Each event affects a directional relationship once; a repeated report is not a second action.
  if (s.changes.some(c => c.observer === observer && c.eventId === event.id)) return;
  if (event.kind === 'water' && observer === event.target)
    updateAttitude(s, observer, event, via, '收到一份具体的照顾', { warmth: 1 });
  if (event.kind === 'fulfill')
    updateAttitude(s, observer, event, via, '答应的安排有了实际结果', { trust: observer === 'shen' ? 2 : 1, warmth: observer === 'zhuo' ? 1 : 0 });
  if (event.kind === 'withdraw' && s.commitment?.witnesses.includes(observer))
    updateAttitude(s, observer, event, via, '听过承诺，也知道这次没有兑现', { trust: -2, caution: 1 });
  if (event.kind === 'repair')
    updateAttitude(s, observer, event, via, '看到补救，但之前的失约仍然发生过', { trust: 1 });
}
function addEvent(s: DemoState, kind: string, target: Person, text: string) {
  const witnesses = [s.role, ...present(s)];
  const event: Event = { id: crypto.randomUUID(), actor: s.role, target, text, kind, witnesses, turn: s.turn };
  s.events.push(event);
  for (const p of witnesses) { learn(s, p, event, '亲自在场', 'seen'); eventEffect(s, p, event, '亲自在场'); }
  return event;
}
export function actions(s: DemoState, target: Person) {
  const out: { id: ActionId; label: string; description: string }[] = [];
  if (!present(s).includes(target)) return out;
  if (!s.events.some(e => e.kind === 'water' && e.actor === s.role && e.target === target))
    out.push({ id: 'water', label: '递一杯温水', description: '一个小小的照顾' });
  if (s.place === 'hall' && !s.commitment)
    out.push({ id: 'promise', label: '答应核对离场安排', description: '许下一个具体的承诺' });
  if (s.place === 'hall' && s.commitment?.status === 'open') {
    out.push({ id: 'fulfill', label: '核对好安排，再回来', description: '把答应的事情做完' });
    out.push({ id: 'withdraw', label: '坦言暂时无法完成', description: '承认这次没有兑现' });
  }
  if (s.place === 'hall' && s.commitment?.status === 'broken') out.push({ id: 'repair', label: '重新安排，做出补救', description: '用实际行动回应失约' });
  if (shareable(s, target).length) out.push({ id: 'share', label: '告诉他刚才的事', description: '消息从这里传到另一处' });
  if (s.knowledge[target].some(k => k.certainty === 'reported' && s.events.some(e => e.id === k.eventId && e.witnesses.some(w => w !== s.role && w !== target))))
    out.push({ id: 'verify', label: '请在场的人确认', description: '拨通电话，让消息得到核实' });
  return out;
}
export function shareable(s: DemoState, target: Person) {
  return s.events.filter(e => ['fulfill', 'withdraw', 'repair'].includes(e.kind) && s.knowledge[s.role].some(k => k.eventId === e.id) && !s.knowledge[target].some(k => k.eventId === e.id));
}
export function applyTurn(original: DemoState, input: TurnInput): { state: DemoState; target: Person | null; actionText: string } {
  if (original.turn >= 60) throw new Error('这段体验已到尾声。可以保存这一刻，重新开始另一种选择。');
  const s: DemoState = structuredClone(original); s.turn += 1;
  if (input.action === 'move') {
    if (!input.place || input.place === s.place) throw new Error('你已经在这里了。');
    s.place = input.place; s.positions[s.role] = input.place;
    const actionText = input.place === 'terrace' ? `${PEOPLE[s.role].name}走到露台廊边。沈宗年结束了电话，将手机收起来。宴会厅里的私下交谈没有传到这里。` : `${PEOPLE[s.role].name}回到宴会厅窗边。赵声阁、陈挽和卓智轩仍各自在场；露台上的交谈并没有被其他人听见。`;
    s.messages.push({ id: crypto.randomUUID(), speaker: 'scene', text: actionText, source: 'action', turn: s.turn });
    return { state: s, target: null, actionText };
  }
  const target = input.target;
  if (!target || target === s.role || !present(s).includes(target)) throw new Error('请先选择同一场景里的一位人物。');
  let actionText = '';
  if (input.action === 'say') {
    actionText = input.text?.trim() || '';
    if (!actionText || actionText.length > 800) throw new Error('请输入1—800字。');
    // Free text is an utterance or an action attempt, never an arbitrary state overwrite.
  } else {
    if (!actions(original, target).some(a => a.id === input.action)) throw new Error('这一步现在无法进行，请按当前场景继续。');
    const who = PEOPLE[s.role].name;
    if (input.action === 'water') { actionText = `${who}从桌边倒了一杯温水，递到${PEOPLE[target].name}手边。`; addEvent(s, 'water', target, actionText); }
    if (input.action === 'promise') {
      actionText = `${who}对${PEOPLE[target].name}说：“我来核对今晚的离场安排，稍后回来告诉你。”`;
      s.commitment = { target, status: 'open', witnesses: [s.role, ...present(s)] }; addEvent(s, 'promise', target, actionText);
    }
    if (input.action === 'fulfill') {
      actionText = `${who}离开片刻，与餐厅工作人员核对了离场车辆和候车位置，随后回到窗边，把已确认的安排告诉在场的人。`;
      s.commitment!.status = 'done'; addEvent(s, 'fulfill', target, actionText);
    }
    if (input.action === 'withdraw') {
      actionText = `${who}回到窗边，坦言刚才答应核对的安排还没有做成：“这件事我暂时没能完成，抱歉。”`;
      s.commitment!.status = 'broken'; addEvent(s, 'withdraw', target, actionText);
    }
    if (input.action === 'repair') {
      actionText = `${who}重新联系餐厅工作人员，逐项核实车辆与候车位置，带着确认后的安排回来，把之前没完成的事补上。`;
      s.commitment!.status = 'repaired'; addEvent(s, 'repair', target, actionText);
    }
    if (input.action === 'share') {
      const available = shareable(s, target);
      const event = input.eventId ? available.find(e => e.id === input.eventId) : available[available.length - 1];
      if (!event) throw new Error('没有尚未告知的新事件。');
      learn(s, target, event, `${who}当面转述，尚未向在场者核实`, 'reported');
      actionText = `${who}把刚才发生的事情告诉${PEOPLE[target].name}：${event.text}这目前是${who}的转述，对方并未亲眼看到。`;
    }
    if (input.action === 'verify') {
      const known = s.knowledge[target].find(k => k.certainty === 'reported' && s.events.some(e => e.id === k.eventId && e.witnesses.some(w => w !== s.role && w !== target)));
      const event = s.events.find(e => e.id === known?.eventId)!;
      if (!event) throw new Error('目前没有可核实的转述。');
      const source = event.witnesses.find(w => w !== s.role && w !== target)!;
      learn(s, target, event, `${who}拨通${PEOPLE[source].name}的电话，对方确认自己在场所见`, 'verified');
      eventEffect(s, target, event, `${PEOPLE[source].name}电话确认`);
      actionText = `${who}当着${PEOPLE[target].name}的面拨通${PEOPLE[source].name}的电话，请其核实。${PEOPLE[source].name}确认自己在场看到：${event.text}`;
    }
  }
  s.messages.push({ id: crypto.randomUUID(), speaker: s.role, target, text: actionText, source: input.action === 'say' ? 'player' : 'action', action: input.action, turn: s.turn });
  return { state: s, target, actionText };
}
export function attitudeText(value: Attitude) {
  if (value.trust < 0) return '还在等一个交代';
  if (value.caution > 0) return '有所保留';
  if (value.trust >= 2) return '对你的可靠多了一分认可';
  if (value.trust > 0) return '开始留意你的行动';
  if (value.warmth > 0) return '相处多了一点暖意';
  return '尚无新的变化';
}
export function publicDemo(s: DemoState) {
  return { id: s.id, role: s.role, place: s.place, turn: s.turn, modelCalls: s.modelCalls,
    messages: s.messages.map(({ reply: _reply, ...message }) => message), events: s.events, commitment: s.commitment,
    present: present(s), changes: s.changes,
    people: (Object.keys(PEOPLE) as Person[]).filter(p => p !== s.role).map(p => ({ id: p, place: s.positions[p],
      attitude: attitude(s, p, s.role), towardChen: attitude(s, p, 'chen'), towardZhao: attitude(s, p, 'zhao'),
      known: s.knowledge[p].map(k => ({ ...k, text: s.events.find(e => e.id === k.eventId)?.text || '' })),
      actions: actions(s, p) })),
  };
}
export type DemoView = ReturnType<typeof publicDemo>;
