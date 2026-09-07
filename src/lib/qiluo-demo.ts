export type Role = 'chen' | 'zhao';
export type Person = Role | 'zhuo' | 'shen';
export type Place = 'hall' | 'terrace' | 'corridor' | 'lobby' | 'street';
export type Item = 'phone' | 'umbrella' | 'water' | 'napkin';
export type World = { minutes: number; items: Record<Item, Place | Person | 'used'>; flags: string[]; weather: 'rain' | 'light-rain' };
export type Attitude = { trust: number; warmth: number; caution: number };
export type Event = { id: string; kind: string; actor: Person; target: Person; text: string; witnesses: Person[]; turn: number; causeId?:string; motive?:string };
export type Knowledge = { eventId: string; via: string; certainty: 'seen' | 'reported' | 'verified' };
export type Message = { id: string; speaker: Person | 'scene'; text: string; action?: string; target?: Person; source: 'opening' | 'action' | 'model' | 'player'; turn: number; reply?: { speaker_id: Person; narrative: string; dialogue: string; used_event_ids: string[] } };
export type Change = { id: string; observer: Person; actor: Person; reason: string; via: string; before: Attitude; after: Attitude; eventId: string };
export type DemoState = {
  version: 1; id: string; created: number; role: Role; place: Place; turn: number; modelCalls: number;
  positions: Record<Person, Place>; events: Event[]; knowledge: Record<Person, Knowledge[]>;
  attitudes: Record<string, Attitude>; messages: Message[]; changes: Change[];
  commitment: null | { target: Person; status: 'open' | 'broken' | 'done' | 'repaired'; witnesses: Person[] };
  usage: { input: number; output: number }; world: World;
};
export type ActionId = 'say' | 'act' | 'look' | 'wait' | 'take' | 'use' | 'arrange' | 'water' | 'promise' | 'fulfill' | 'withdraw' | 'repair' | 'share' | 'verify' | 'move';
export type TurnInput = { target?: Person; action: ActionId; text?: string; place?: Place; eventId?: string; item?: Item };
export const PEOPLE: Record<Person, { name: string; initial: string; label: string; color: string; introduction: string }> = {
  chen: { name: '陈挽', initial: '挽', label: '温润 · 从容 · 心有所向', color: '#8cbed2', introduction: '把一切安排得妥帖，是你熟悉的事。至于那个人，你还有很多话没有说。' },
  zhao: { name: '赵声阁', initial: '声', label: '内敛 · 敏锐 · 不动声色', color: '#cbb078', introduction: '难得片刻清静。今晚的许多细节都恰到好处，你开始留意那个忙碌的身影。' },
  zhuo: { name: '卓智轩', initial: '卓', label: '陈挽的多年老同学', color: '#a99bc4', introduction: '直率热闹，关心朋友；知道分寸，也有自己的判断。' },
  shen: { name: '沈宗年', initial: '沈', label: '赵声阁的朋友', color: '#8dabaa', introduction: '寡言而敏锐，正在露台廊边接电话。' },
};
export const PLACES: Record<Place, string> = { hall: '宴会厅 · 窗边', terrace: '露台 · 廊边', corridor:'安静走廊', lobby:'酒店门厅', street:'门外 · 雨中街边' };
export const ITEMS: Record<Item, string> = { phone:'自己的手机', umbrella:'借用的长柄伞', water:'一杯温水', napkin:'干净纸巾' };
export const SCENES: Record<Place, string> = {
  hall:'杯盏撤下一半，窗边仍留着温水和纸巾。露台的门虚掩着，另一侧的走廊通向门厅。',
  terrace:'檐口的雨线落在栏杆外。这里可以避雨、独处，也能从廊边折回宴会厅。',
  corridor:'地毯收住了脚步声。宴会厅的乐声渐远，走廊尽头是门厅；在这里可以安静处理自己的事。',
  lobby:'伞架旁放着可供客人借用的长柄伞。值班的工作人员正在核对候车单，玻璃门外是雨夜的街道。',
  street:'檐下接着湿亮的人行道，雨水在路沿汇成细流。门厅仍在身后，尚未预约车辆；今晚的体验暂限酒店周边。'
};
export function ensureWorld(s: DemoState) {
  s.world ||= { minutes:s.turn, items:{ phone:s.role, umbrella:'lobby', water:'hall', napkin:'hall' }, flags:[], weather:'rain' };
  return s.world;
}
export function clock(s: DemoState) { const n=21*60+ensureWorld(s).minutes; return `${String(Math.floor(n/60)%24).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`; }
export function counterpart(role: Role): Role { return role === 'chen' ? 'zhao' : 'chen'; }
export function attitude(s: DemoState, observer: Person, actor: Person): Attitude {
  return { ...(s.attitudes[`${observer}:${actor}`] || { trust: 0, warmth: 0, caution: 0 }) };
}
export function initialDemo(role: Role): DemoState {
  const other = counterpart(role);
  return { version: 1, id: crypto.randomUUID(), created: Date.now(), role, place: 'hall', turn: 0, modelCalls: 0,
    positions: { chen: 'hall', zhao: 'hall', zhuo: 'hall', shen: 'terrace' }, events: [],
    knowledge: { chen: [], zhao: [], zhuo: [], shen: [] }, attitudes: {}, changes: [], commitment: null,
    usage: { input: 0, output: 0 }, world:{ minutes:0, items:{phone:role,umbrella:'lobby',water:'hall',napkin:'hall'},flags:[],weather:'rain' }, messages: [
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
  if (event.kind === 'arrange')
    updateAttitude(s, observer, event, via, '确认你亲自处理了候车安排', { trust: 1 });
  if (event.kind === 'give' && observer === event.target)
    updateAttitude(s, observer, event, via, '实际收到了你递来的物品', { warmth: 1 });
}
function addEvent(s: DemoState, kind: string, target: Person, text: string, privateTo?:Person[]) {
  const witnesses = privateTo || [s.role, ...present(s)];
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
  return s.events.filter(e => ['fulfill', 'withdraw', 'repair', 'arrange', 'take', 'give', 'use', 'activity', 'move'].includes(e.kind) && s.knowledge[s.role].some(k => k.eventId === e.id) && !s.knowledge[target].some(k => k.eventId === e.id));
}
export function applyTurn(original: DemoState, input: TurnInput): { state: DemoState; target: Person | null; actionText: string } {
  if (original.turn >= 60) throw new Error('这段体验已到尾声。可以保存这一刻，重新开始另一种选择。');
  const s: DemoState = structuredClone(original); s.turn += 1; ensureWorld(s);
  if (['move','look','wait','take','use','arrange'].includes(input.action)) {
    const op: WorldOperation = { kind: input.action === 'look' ? 'inspect' : input.action as WorldOperation['kind'], place:input.place, item:input.item, minutes:5 };
    const actionText = executeWorld(s,[op]);
    return { state: s, target: null, actionText };
  }
  const target = input.target;
  if (!target || target === s.role || !present(s).includes(target)) throw new Error('请先选择同一场景里的一位人物。');
  let actionText = '';
  if (input.action === 'say') {
    actionText = input.text?.trim() || '';
    if (!actionText || actionText.length > 800) throw new Error('请输入1—800字。');
    addEvent(s,'speech',target,`${PEOPLE[s.role].name}对${PEOPLE[target].name}说：${actionText}`,/私下|耳边|压低声音|悄声|悄悄|低声|只对/.test(actionText)?[s.role,target]:undefined);
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
  advanceWorld(s,1);
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
  const world=ensureWorld(s);
  return { id: s.id, role: s.role, place: s.place, turn: s.turn, modelCalls: s.modelCalls,
    clock:clock(s), scene:SCENES[s.place], weather:world.weather, inventory:(Object.keys(ITEMS) as Item[]).filter(item=>world.items[item]===s.role).map(id=>({id,name:ITEMS[id]})),
    nearbyItems:(Object.keys(ITEMS) as Item[]).filter(item=>world.items[item]===s.place).map(id=>({id,name:ITEMS[id]})), flags:world.flags,
    messages: s.messages.filter(m=>!(m.source==='player'&&m.action==='say'&&s.messages.some(other=>other.turn===m.turn&&other.action==='act'&&other.source==='player'))).map(({ reply: _reply, ...message }) => message), events: s.events, commitment: s.commitment,
    present: present(s), changes: s.changes,
    people: (Object.keys(PEOPLE) as Person[]).filter(p => p !== s.role).map(p => ({ id: p, place: s.positions[p],
      attitude: attitude(s, p, s.role), towardChen: attitude(s, p, 'chen'), towardZhao: attitude(s, p, 'zhao'),
      known: s.knowledge[p].map(k => ({ ...k, text: s.events.find(e => e.id === k.eventId)?.text || '' })),
      actions: actions(s, p) })),
  };
}
export type DemoView = ReturnType<typeof publicDemo>;

export type WorldOperation = {
  kind:'move'|'inspect'|'take'|'use'|'give'|'wait'|'arrange'|'activity'|'attempt'|'talk'|'social';
  place?:Place; item?:Item; target?:Person; minutes?:number; description?:string; text?:string;
  action?:'water'|'promise'|'fulfill'|'withdraw'|'repair'|'share'|'verify';
};
function sceneMessage(s:DemoState,text:string) { s.messages.push({id:crypto.randomUUID(),speaker:'scene',text,source:'action',turn:s.turn}); }
function advanceWorld(s:DemoState,minutes:number) {
  const w=ensureWorld(s); w.minutes+=minutes;
  if(w.minutes>=15 && w.weather==='rain') {
    w.weather='light-rain'; sceneMessage(s,'雨声渐渐疏了，玻璃上的水痕仍未干。今晚已经过去了一刻钟。');
  }
  if(w.minutes>=5 && !w.flags.includes('call-ended')) {
    w.flags.push('call-ended');
    if(s.place==='terrace')sceneMessage(s,'沈宗年结束了电话，把手机收回衣袋。廊边重新安静下来。');
  }
}
function executeWorld(s:DemoState,steps:WorldOperation[]) {
  const w=ensureWorld(s), who=PEOPLE[s.role].name, results:string[]=[];
  const record=(kind:string,text:string,target:Person=s.role)=>{addEvent(s,kind,target,text,kind==='phone-check'?[s.role]:undefined);results.push(text)};
  for(const op of steps) {
    let failure='';
    if(op.kind==='move') {
      if(!op.place || !(op.place in PLACES))failure='这段体验还没有通往那里的路线。可以先在酒店及门外街边活动。';
      else if(s.place===op.place)results.push(`你已经在${PLACES[s.place]}。${SCENES[s.place]}`);
      else {
        // Departure witnesses see the departure, not private activity at the destination.
        addEvent(s,'move',s.role,`${who}离开了${PLACES[s.place]}。`);
        s.place=op.place;s.positions[s.role]=op.place;
        record('move',`${who}来到${PLACES[s.place]}。${SCENES[s.place]}`);
        const others=present(s);results.push(others.length?`此刻在附近的是${others.map(p=>PEOPLE[p].name).join('、')}。`:'此刻没有熟人在身旁。你可以独自做些事情，不必寻找聊天对象。');
        if(s.place==='street'&&!w.flags.includes('umbrella-open')){w.flags.push('wet');results.push('你迈出檐下时，雨点打湿了肩头。');}
        advanceWorld(s,2);
      }
    } else if(op.kind==='inspect') {
      if(op.item==='phone') {
        if(w.items.phone!==s.role)failure='自己的手机此刻不在手中。';
        else record('phone-check',`${who}看了一眼自己的手机。屏幕显示${clock(s)}，没有新的已确认消息。${w.flags.includes('transport-checked')?'今晚的车辆会停在门厅外的雨棚下。':'候车安排还没有核实，可以到门厅确认。'}`);
      } else if(op.item && w.items[op.item]!==s.role && w.items[op.item]!==s.place)failure=`${ITEMS[op.item]}不在手边，先到物品所在的位置。`;
      else {const names=(Object.keys(ITEMS) as Item[]).filter(i=>w.items[i]===s.place).map(i=>ITEMS[i]);record('inspect',`${who}停下来看了看四周。${SCENES[s.place]}${names.length?'眼前可取用的物品有：'+names.join('、')+'。':''}${w.flags.includes('transport-checked')&&s.place==='lobby'?'刚才核对过的候车位置仍是雨棚下。':''}`);}
      advanceWorld(s,1);
    } else if(op.kind==='take') {
      if(!op.item || op.item==='phone')failure='自己的手机本来就在身上；只能拿取眼前可供使用的物品。';
      else if(w.items[op.item]===s.role)results.push(`${ITEMS[op.item]}已经在你手中。`);
      else if(w.items[op.item]!==s.place)failure=`这里没有可取用的${ITEMS[op.item]}。先去物品所在的位置，不能隔空拿取。`;
      else {w.items[op.item]=s.role;record('take',`${who}${op.item==='umbrella'?'从门厅伞架借了一把长柄伞':`拿起${ITEMS[op.item]}`}，带在身边。`);advanceWorld(s,1);}
    } else if(op.kind==='use') {
      if(!op.item || w.items[op.item]!==s.role)failure='先把要使用的物品拿在手里。';
      else {
        if(op.item==='umbrella') {if(!w.flags.includes('umbrella-open'))w.flags.push('umbrella-open');record('use',`${who}撑开长柄伞，雨水落在伞面上。`);}
        if(op.item==='phone')record('phone-check',`${who}查看自己的手机，留意了一眼时间和今晚的安排。${w.flags.includes('transport-checked')?'候车位置已经核实。':'目前没有新的已确认消息。'}`);
        if(op.item==='water'){w.items.water='used';record('use',`${who}喝了几口温水，把空杯放好。温度在掌心慢慢散去。`);}
        if(op.item==='napkin'){w.items.napkin='used';w.flags=w.flags.filter(f=>f!=='wet');record('use',`${who}用纸巾擦去手上和衣袖表面的水珠，将用过的纸巾收好。`);}
        advanceWorld(s,1);
      }
    } else if(op.kind==='give') {
      if(!op.item || op.item==='phone' || w.items[op.item]!==s.role)failure='手上还没有可以递出的这件物品。';
      else if(!op.target || !present(s).includes(op.target))failure='对方不在这里，物品暂时还没有交到他手上。';
      else {w.items[op.item]=op.target;if(op.item==='umbrella')w.flags=w.flags.filter(f=>f!=='umbrella-open');record('give',`${who}把${ITEMS[op.item]}递给${PEOPLE[op.target].name}，对方接了过去。`,op.target);advanceWorld(s,1);}
    } else if(op.kind==='wait') {
      const minutes=Math.max(1,Math.min(20,Math.round(op.minutes||5)));
      record('wait',`${who}在${PLACES[s.place]}安静等了${minutes}分钟，没有主动搭话。`);advanceWorld(s,minutes);results.push(`时间来到${clock(s)}。${present(s).length?'附近的人继续各自的事，没有人被迫接话。':'四下仍安静，你可以继续独处，也可以动身。'}`);
    } else if(op.kind==='arrange') {
      if(s.place!=='lobby')failure='候车单在门厅工作人员手里，需要先去门厅核对。';
      else if(w.flags.includes('transport-checked'))results.push('车辆和候车位置已经核对过：酒店门厅外的雨棚下。重复确认没有产生新的关系变化。');
      else {w.flags.push('transport-checked');record('arrange',`${who}在门厅与值班工作人员核对了离场车辆，确认候车位置在门外雨棚下。这件事已经做完，还没有告诉不在场的人。`);advanceWorld(s,3);}
    } else if(op.kind==='activity') {
      // Local, self-directed activity has no authority to move people, grant items or edit feelings.
      const detail=(op.description||'停下来整理了一下自己的衣袖。').slice(0,350);
      record('activity',`${who}：${detail}`);advanceWorld(s,Math.max(1,Math.min(5,op.minutes||1)));
    } else if(op.kind==='attempt')failure=op.description||'这一步还没有发生。可以先观察眼前的环境，或把想做的事情分成具体的一步。';
    if(failure){results.push(`这一步尚未完成：${failure}`);break;}
  }
  const text=results.join('\n');if(text)sceneMessage(s,text);return text;
}
export function applyPlannedTurn(original:DemoState,inputText:string,steps:WorldOperation[]) {
  if(original.turn>=60)throw new Error('这段体验已经过了60步，可以保存后重新开始。');
  const s=structuredClone(original);s.turn++;ensureWorld(s);
  s.messages.push({id:crypto.randomUUID(),speaker:s.role,text:inputText,action:'act',source:'player',turn:s.turn});
  const social=steps.find(op=>op.kind==='talk'||op.kind==='social');
  const firstSocial=steps.findIndex(op=>op===social);
  const physical=firstSocial>=0?steps.slice(0,firstSocial):steps;
  const actionText=executeWorld(s,physical);
  if(social && !actionText.includes('这一步尚未完成：')) {
    if(!social.target || !present(s).includes(social.target)) {sceneMessage(s,'想找的人不在身旁。你可以先去他所在的地方，或继续做自己的事。');return {state:s,target:null,actionText};}
    const base=structuredClone(s);base.turn--;
    const result=applyTurn(base,{action:social.kind==='talk'?'say':social.action!,target:social.target,text:social.text||inputText});
    return result;
  }
  return {state:s,target:null,actionText};
}

export type NpcAction={kind:'say'|'move'|'invite'|'react';actor:Person;target?:Person;place?:Place;narrative?:string;dialogue?:string;motive:string;source_event_ids:string[];accepted?:boolean;invitation?:string};
export function applyNpcActions(s:DemoState,actions:NpcAction[]) {
  function npcEvent(actor:Person,target:Person,kind:string,text:string,witnesses:Person[],op:NpcAction) {
    const e:Event={id:crypto.randomUUID(),actor,target,kind,text,witnesses:[...new Set(witnesses)],turn:s.turn,causeId:op.source_event_ids[0],motive:op.motive};
    s.events.push(e);for(const p of e.witnesses)learn(s,p,e,'亲自在场','seen');return e;
  }
  function move(actor:Person,destination:Place,op:NpcAction) {
    if(s.positions[actor]===destination)return;
    const old=s.positions[actor];
    const witnesses=(Object.keys(PEOPLE) as Person[]).filter(p=>s.positions[p]===old);
    const departure=`${PEOPLE[actor].name}离开${PLACES[old]}。`;
    npcEvent(actor,actor,'npc-move',departure,witnesses,op);
    if(witnesses.includes(s.role))sceneMessage(s,departure);
    s.positions[actor]=destination;
    const arrival=`${PEOPLE[actor].name}来到${PLACES[destination]}。`;
    const arrived=(Object.keys(PEOPLE) as Person[]).filter(p=>s.positions[p]===destination);
    npcEvent(actor,actor,'npc-move',arrival,arrived,op);
    if(arrived.includes(s.role))sceneMessage(s,arrival);
  }
  for(const op of actions) {
    if(op.actor===s.role || op.source_event_ids.some(id=>!s.knowledge[op.actor].some(k=>k.eventId===id)))throw new Error('人物行动引用了尚未知晓的信息，本轮没有改变进度。');
    if(op.kind==='invite') {
      if(!op.target || op.target===s.role || op.target===op.actor)throw new Error('请托人找一位其他人物。');
      const cause=s.events.find(e=>e.id===op.source_event_ids[0]);
      if(!cause || !['speech','npc-speech'].includes(cause.kind) || cause.target!==op.actor)throw new Error('邀请缺少明确的来由，本轮没有改变进度。');
      const flag=`invited:${cause.id}:${op.target}`;if(s.world.flags.includes(flag))continue;
      const destination=s.positions[cause.actor], recipient=op.target, contactPlace=s.positions[recipient];
      const contactEvent=op.invitation?.trim()||`${PEOPLE[cause.actor].name}请你过去一趟。`;
      move(op.actor,contactPlace,op);
      const e=npcEvent(op.actor,recipient,'invitation',`${PEOPLE[op.actor].name}向${PEOPLE[recipient].name}转达：${contactEvent}`,[op.actor,recipient],op);
      // Only the delivered invitation reaches C. A and B's full private conversation does not.
      const entry=s.knowledge[recipient].find(k=>k.eventId===e.id)!;entry.certainty='reported';entry.via=`${PEOPLE[op.actor].name}专程转达`;
      s.world.flags.push(flag);advanceWorld(s,3);
      if(op.accepted!==false) {
        move(op.actor,destination,op);
        move(recipient,destination,{...op,source_event_ids:[e.id]});
        if(s.place===destination)sceneMessage(s,`${PEOPLE[op.actor].name}把消息带到了。${PEOPLE[recipient].name}接到邀请后过来，停在你身旁。`);
      } else {
        move(op.actor,destination,op);
        if(s.place===destination)sceneMessage(s,`${PEOPLE[op.actor].name}回来转告你，${PEOPLE[recipient].name}已经收到消息，此刻还不能过来。`);
      }
    } else if(op.kind==='move') {
      if(!op.place || !(op.place in PLACES))throw new Error('人物行程无法确定，本轮没有改变进度。');
      move(op.actor,op.place,op);advanceWorld(s,1);
    } else {
      if(s.positions[op.actor]!==s.place || (op.target&&s.positions[op.target]!==s.place))throw new Error('人物不在同一处，不能隔空接话。');
      const dialogue=op.dialogue?.trim()||'';
      if(op.kind==='say'&&!dialogue)throw new Error('人物回应缺少内容，请重试。');
      const narrative=op.narrative?.trim()||'';
      const text=[narrative,dialogue?`“${dialogue.replace(/^[“「"]|[”」"]$/g,'')}”`:''].filter(Boolean).join('\n');
      if(!text)continue;
      s.messages.push({id:crypto.randomUUID(),speaker:op.actor,target:op.target||s.role,source:'model',turn:s.turn,text,
        reply:{speaker_id:op.actor,narrative,dialogue,used_event_ids:op.source_event_ids}});
      npcEvent(op.actor,op.target||s.role,'npc-speech',`${PEOPLE[op.actor].name}：${text}`,[s.role,...present(s)],op);
    }
  }
}
