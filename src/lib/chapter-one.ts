// Adaptation notes: uploaded source, chapter 1 and chapter 2 up to the restaurant departure.
// Author knowledge stays on the server. Player/NPC views are filtered by witnessed events.
export type ChapterRole = 'chen' | 'zhao';
export type ChapterPerson = ChapterRole | 'zhuo' | 'shen' | 'tan' | 'manager';
export type ChapterPlace = 'airport' | 'hall' | 'service' | 'terrace' | 'canopy' | 'departed';
export type ChapterPhase = 'landing' | 'arrival' | 'dinner' | 'dessert' | 'meeting' | 'farewell' | 'ended';
export const CAST: Record<ChapterPerson, { name: string; initial: string; color: string; relation: string }> = {
  chen:{name:'陈挽',initial:'挽',color:'#8cbed2',relation:'张罗接风宴的人，卓智轩的老同学'},
  zhao:{name:'赵声阁',initial:'声',color:'#cbb078',relation:'归来的客人，明隆掌权者'},
  zhuo:{name:'卓智轩',initial:'卓',color:'#a99bc4',relation:'想替老朋友争取一个照面的机会'},
  shen:{name:'沈宗年',initial:'沈',color:'#8dabaa',relation:'与赵家交情深，话少，有自己的判断'},
  tan:{name:'谭又明',initial:'谭',color:'#b6a087',relation:'与赵声阁一起长大，熟悉陈挽的为人'},
  manager:{name:'餐厅经理',initial:'侍',color:'#92a4ab',relation:'负责席面、后厨与候车安排'},
};
export const CHAPTER_PLACES: Record<ChapterPlace,string> = {airport:'机场 · B3 出口',hall:'餐厅 · 圆桌',service:'餐厅 · 侍应台',terrace:'避风廊',canopy:'餐厅 · 檐下',departed:'盘山路 · 离场'};
export const PHASES: {id:ChapterPhase;name:string;subtitle:string}[] = [
  {id:'landing',name:'归航',subtitle:'八号风球登陆的那一天'},
  {id:'arrival',name:'入席之前',subtitle:'数日后 · 湾区傍山别墅餐厅'},
  {id:'dinner',name:'席间',subtitle:'一张圆桌，各有远近'},
  {id:'dessert',name:'临时换一道甜',subtitle:'风雨在席面上留下一个缺口'},
  {id:'meeting',name:'一面',subtitle:'有些话，只够说到这里'},
  {id:'farewell',name:'檐下',subtitle:'车已候着，雨还没有停'},
  {id:'ended',name:'本章终',subtitle:'这一晚，留下了什么'},
];
export type ChapterEvent = {id:string;turn:number;actor:ChapterPerson|'world';text:string;witnesses:ChapterPerson[];cause?:string;kind:string};
export type ChapterMessage = {id:string;speaker:ChapterPerson|'scene';text:string;speech?:string;turn:number;kind:'scene'|'dialogue'|'player'|'chapter'};
export type ChapterTrace = {id:string;observer:ChapterPerson;actor:ChapterPerson;reason:string;eventId:string};
export type ChapterState = {
  story:'qiluo-chapter-one';version:1;id:string;created:number;role:ChapterRole;phase:ChapterPhase;turn:number;modelCalls:number;
  place:ChapterPlace;positions:Record<ChapterPerson,ChapterPlace>;minutes:number;phaseActions:number;
  flags:string[];completed:string[];events:ChapterEvent[];messages:ChapterMessage[];traces:ChapterTrace[];
  ending:null|{title:string;text:string;threads:string[]};usage:{input:number;output:number};
};
export type ChapterChoice = {id:string;label:string;hint:string;place?:ChapterPlace};
export type ChapterOperation = {kind:'choice'|'move'|'observe'|'wait'|'activity'|'say'|'summon';id?:string;place?:ChapterPlace;target?:ChapterPerson;via?:ChapterPerson;text?:string;private?:boolean};
const ALL=Object.keys(CAST) as ChapterPerson[];
const flag=(s:ChapterState,f:string)=>s.flags.includes(f);
function setFlag(s:ChapterState,f:string){if(!flag(s,f))s.flags.push(f)}
export function chapterPresent(s:ChapterState){return ALL.filter(p=>p!==s.role&&s.positions[p]===s.place)}
function message(s:ChapterState,speaker:ChapterMessage['speaker'],text:string,kind:ChapterMessage['kind']='scene'){
  s.messages.push({id:crypto.randomUUID(),speaker,text,kind,turn:s.turn});
}
function event(s:ChapterState,actor:ChapterEvent['actor'],text:string,witnesses:ChapterPerson[],kind='action',cause?:string){
  const e={id:crypto.randomUUID(),turn:s.turn,actor,text,witnesses:[...new Set(witnesses)],kind,cause};s.events.push(e);return e;
}
function record(s:ChapterState,actor:ChapterPerson,text:string,witnesses:ChapterPerson[]=ALL.filter(p=>s.positions[p]===s.positions[actor]),kind='action',cause?:string){
  const e=event(s,actor,text,witnesses,kind,cause);
  if(witnesses.includes(s.role)){
    message(s,actor,text,actor===s.role?'player':'dialogue');
    if(kind==='speech'&&['chen','zhao'].includes(actor)){
      const quotes=[...text.matchAll(/“([^”]+)”|「([^」]+)」|"([^"\n]+)"/g)];
      s.messages.at(-1)!.speech=(quotes.length?quotes.map(m=>m[1]||m[2]||m[3]).join(' '):actor===s.role?text:'').replace(/（[^）]*）|\([^)]*\)|\*[^*]*\*/g,'').trim();
    }
  }return e;
}
function scene(s:ChapterState,text:string){message(s,'scene',text)}
function response(s:ChapterState,actor:ChapterPerson,text:string,witnesses:ChapterPerson[],cause?:string){return record(s,actor,text,witnesses,'speech',cause)}
function trace(s:ChapterState,observer:ChapterPerson,actor:ChapterPerson,reason:string,e:ChapterEvent){
  if(observer===s.role||!e.witnesses.includes(observer))return;
  if(!s.traces.some(t=>t.observer===observer&&t.actor===actor&&t.reason===reason))s.traces.push({id:crypto.randomUUID(),observer,actor,reason,eventId:e.id});
}
function relocate(s:ChapterState,p:ChapterPerson,to:ChapterPlace,cause?:string){
  const old=s.positions[p];if(old===to)return;
  const out=ALL.filter(x=>s.positions[x]===old);
  event(s,p,`${CAST[p].name}离开${CHAPTER_PLACES[old]}。`,out,'move',cause);
  s.positions[p]=to;if(p===s.role)s.place=to;
  const inside=ALL.filter(x=>s.positions[x]===to);
  const text=`${CAST[p].name}来到${CHAPTER_PLACES[to]}。`;
  event(s,p,text,inside,'move',cause);
  if(out.includes(s.role)||inside.includes(s.role))scene(s,text);
}
function ensureAt(s:ChapterState,p:ChapterPerson,place:ChapterPlace){relocate(s,p,place)}
export function chapterKnown(s:ChapterState,p:ChapterPerson){return s.events.filter(e=>e.witnesses.includes(p))}
export function chapterScene(s:ChapterState){
  if(s.place==='airport')return s.role==='chen'?'雨刷扫过挡风玻璃。你把车停在不显眼的地方，能看见 B3 出口。卓智轩的来电亮在屏幕上。':'机场出口的广播又报了一遍风雨。司机已把黑色迈巴赫停在遮雨处，身后的门隔住人声。';
  if(s.place==='service')return s.phase==='dessert'?'侍应台避开了主桌的视线。经理握着菜单，等一句可以交代给后厨的安排。':'灯光落在折好的餐巾上，酒水单压着桌角。经理在这里核对上菜顺序。';
  if(s.place==='terrace')return '廊边有风，雨在外侧斜着落。门一合，席间的谈笑便轻了；这里适合说不想让整桌听见的话。';
  if(s.place==='canopy')return '山下的海浪声盖过引擎。门童站在檐内，车灯把雨脚照亮，湿石阶上留着一线暖光。';
  if(s.place==='departed')return '盘山路的弯道把餐厅的灯光一盏盏留在身后。这一晚的故事到这里为止。';
  return s.phase==='arrival'?'赵声阁的位子在主座。陈挽在离主位很远的位置有一个席位，卓智轩也隔着几位宾客。桌上的热闹尚未真正开始。':s.phase==='dessert'?'热菜撤下，杯底的茶影晃了一下。侍应台那边压低了声音，席上的人还在闲谈。':s.phase==='meeting'?'卓智轩站起身，拿了自己的酒杯。赵声阁身旁是谭又明和沈宗年，一句话要等前一句说完才能递过去。':'圆桌很大，席上的话各有去处。赵声阁在主位，谭又明和沈宗年挨得近；陈挽的茶杯在另一头。';
}
export function initialChapter(role:ChapterRole):ChapterState{
  const s:ChapterState={story:'qiluo-chapter-one',version:1,id:crypto.randomUUID(),created:Date.now(),role,phase:'landing',turn:0,modelCalls:0,place:'airport',positions:{chen:'airport',zhao:'airport',zhuo:'hall',shen:'hall',tan:'hall',manager:'service'},minutes:0,phaseActions:0,flags:[],completed:[],events:[],messages:[],traces:[],ending:null,usage:{input:0,output:0}};
  message(s,'scene','第一章 · 风球之下\n机场归来，接风宴，直到最后一辆车离开。','chapter');
  scene(s,role==='chen'?'机场高架被雨水洗得发白。陈挽放慢车速，绕到 B3，泊进一个不招眼的位置。手机震了一下，是卓智轩在问接风宴。\n餐厅的照片早已备好。你抬头看了一眼出口，暂时没有要等的人。':'落地时机身沉了一下。走出 B3，雨和广播声一齐压过来，司机已在车边等候。\n海市的消息在手机上接连亮起。接风的邀约不少，眼前先要处理的是这场风雨和回程。');
  event(s,'world','台风影响海市，赵声阁独自回国；接风宴尚在数日后。',ALL,'fact');
  if(role==='chen')response(s,'zhuo','电话里，卓智轩先问正事。\n“地方定了？照片发来看看。”',['chen','zhuo']);
  return s;
}
function addChoice(out:ChapterChoice[],s:ChapterState,id:string,label:string,hint:string,place?:ChapterPlace){if(!s.completed.includes(id))out.push({id,label,hint,place})}
export function chapterChoices(s:ChapterState):ChapterChoice[]{
  if(s.phase==='ended')return [];
  const o:ChapterChoice[]=[],c=(id:string,label:string,hint:string,place?:ChapterPlace)=>addChoice(o,s,id,label,hint,place);
  if(s.phase==='landing'){
    if(s.role==='chen'){
      c('airport-watch','等到他上车','确认平安就好，不走到他面前。');
      c('airport-zhuo','给卓回电话','说正事，也接住他多问的那一句。');
    }else{
      c('airport-work','看一眼待办','先处理回程，接风宴留待数日后。');
      c('airport-window','暂时收起手机','雨很大，车外的陌生车辆没有引起你的注意。');
    }
  }
  if(s.phase==='arrival'){
    if(s.role==='chen'){
      c('prepare','与经理核对席面','温度、花的位置、醒酒时间，逐件落定。','service');
      c('keep-distance','从一旁让出迎宾的位置','不抢着迎上去，让安排先于自己被看见。','hall');
    }else{
      c('notice-room','在入席前看一眼四周','留意舒服在哪里，不急着归功于某个人。','hall');
      c('ask-host','问卓今晚谁在照应','这一问，会让名字比人更早到你耳边。','hall');
    }
  }
  if(s.phase==='dinner'){
    if(s.role==='chen'){
      c('quiet-tea','接住卓的眼色，仍坐着饮茶','你知道他的好意，也可以不照着他的意思做。','hall');
      c('ask-help','请卓替你看一会儿席面','把一件具体的事交给朋友，自己喘口气。','hall');
    }else{
      c('taste','认真尝一口菜','谭又明熟悉你的挑剔，筷子比客套更能说明问题。','hall');
      c('ask-chen','向卓问起陈挽','当着沈的面打听，他会有自己的反应。','hall');
    }
  }
  if(s.phase==='dessert'&&!flag(s,'dessert-served')){
    if(s.role==='chen'||flag(s,'shortage-known-zhao')){
      c('tea','换成雷公根和生地水','让经理去附近的老凉茶铺取茶，席面可以接下去。','service');
      c('red-bean','采用后厨备好的红豆汤','稳妥地补上甜点，不再让工作人员冒雨跑一趟。','service');
    }else c('ask-shortage','过去问经理出了什么事','走到侍应台再问；隔桌看见，不等于已经听见。','service');
  }
  if(s.phase==='dessert'&&flag(s,'dessert-served')){
    if(s.role==='chen')c('watch-cup','只看看那只杯子','是否称心，比有没有被记住更容易确认。','hall');
    else c('ask-tea','问一句这道茶是谁改的','给称心的细节找到一个确实的来由。','hall');
  }
  if(s.phase==='meeting'){
    if(!flag(s,'introduced')&&!flag(s,'declined-introduction'))c('introduce',s.role==='chen'?'随卓过去，问候一声':'接过卓的引见','等赵和沈说完，再有分寸地打个照面。','hall');
    if(s.role==='chen'&&!flag(s,'introduced'))c('stay-seated','暂时不去，先把手头的事做完','这一次，卓会尊重你的选择。','hall');
    if(flag(s,'introduced')){
      if(!flag(s,'bridge-set'))c('bridge','把出行改到台风后','谭刚提起明日打球和看桥，这个安排需要想一层。','hall');
      c('light-exit',s.role==='chen'?'借添茶退出谈话':'让谈话停在合适的地方','有了照面，也不必立刻把距离缩短。','hall');
    }
    if(s.role==='zhao'&&flag(s,'introduced'))c('ask-circle','问谭与沈对陈挽的看法','两个人的担保有分量，却不能替你作决定。','hall');
  }
  if(s.phase==='farewell'){
    c('cars',s.role==='chen'?'核对车辆和泊车次序':'向经理确认车辆已到','安排落实后，门童和司机才知道怎样接应。','canopy');
    c('umbrella','取伞，站到檐下','可以送行，也可以在上车前停一小会儿。','canopy');
    if(s.role==='chen'){
      c('decline','婉拒续场，留下善后','谭从车窗招呼你，餐厅里还有客人。','canopy');
      c('join','把善后交接给经理，再应下续场','一个偏离原来走向的小选择，先把交接做完。','canopy');
    }else c('thanks','离开前，对陈挽说一句','若你已知道安排出自他手，可以把谢意落在实处。','canopy');
  }
  return o;
}
export function continueLabel(s:ChapterState){return ({landing:'前往接风宴 · 数日后',arrival:'入席，等第一道菜上来',dinner:'让晚宴继续 · 饭后',dessert:'茶点过后 · 敬酒时分',meeting:'晚宴散场 · 去檐下',farewell:s.role==='chen'?'目送车辆离开 · 完成本章':'上车离开 · 完成本章',ended:'本章已完成'})[s.phase]}
function serveDessert(s:ChapterState,kind:'tea'|'red-bean',actor:ChapterPerson,cause?:string){
  if(flag(s,'dessert-served'))return;
  setFlag(s,'dessert-served');setFlag(s,kind);
  const arranged=record(s,actor,kind==='tea'?`${CAST[actor].name}把菜单合上，向经理交代去附近取雷公根和生地水，分好茶盅再送上桌。`:`${CAST[actor].name}向经理确认改上红豆汤，让后厨照着人数分好。`,[actor,'manager'],'dessert-order',cause);
  response(s,'manager','经理听完，复述了一遍数量，转身去交代侍应。\n“明白，我让他们尽快送上。”',[actor,'manager'],arranged.id);
  s.minutes+=8;
  const delivered=event(s,'manager',kind==='tea'?'侍应撤下空盘，换上雷公根和生地水。有人尝过，向经理招手要续杯。':'红豆汤按人数送到席上。甜点没有再等，席间的闲谈接了下去。',['chen','zhao','zhuo','shen','tan','manager'],'dessert-delivered',arranged.id);
  if(s.place==='hall')scene(s,delivered.text);else scene(s,'侍应托着分好的茶点往圆桌走去。你这边的交代已经落实。');
  if(kind==='tea'&&s.role==='chen'){
    const enjoyed=event(s,'zhao','赵声阁手边的凉茶渐渐见了底；谭又明把自己的茶盅递过去，请侍应再添一些。',['chen','zhao','tan','shen'],'tea-enjoyed',delivered.id);
    if(s.place==='hall')scene(s,enjoyed.text);
  }
  trace(s,'manager',actor,'临时变更有了清楚的安排，后厨不用再空等',arranged);
}
function introduction(s:ChapterState){
  if(flag(s,'introduced')||flag(s,'declined-introduction'))return;
  for(const p of ['chen','zhuo','zhao','tan','shen'] as ChapterPerson[])ensureAt(s,p,'hall');
  const cause=response(s,'zhuo','卓智轩等两人谈完，才把这句话递过去。\n“声阁，陈挽，我以前跟你提过的老同学。”',['chen','zhao','zhuo','tan','shen']);
  setFlag(s,'introduced');setFlag(s,'name-known');
  if(s.role==='chen'){
    record(s,'chen','陈挽举杯，杯沿停得稳。\n“赵先生。”',['chen','zhao','zhuo','tan','shen'],'speech',cause.id);
    response(s,'zhao','赵声阁抬眼，看了看他，礼貌地举了一下杯。\n“你好。”',['chen','zhao','zhuo','tan','shen'],cause.id);
  }else{
    record(s,'zhao','赵声阁接过这声引见，举杯示意，给对方留了说话的位置。',['chen','zhao','zhuo','tan','shen'],'action',cause.id);
    response(s,'chen','陈挽问候了一声，没把名字和来历再说一遍。\n“赵先生。”',['chen','zhao','zhuo','tan','shen'],cause.id);
  }
  const invitation=response(s,'tan','谭又明接着开口，像是想起一件寻常的事。\n“阿挽，明天打球？顺便带声阁去看看明珠大桥。”',['chen','zhao','zhuo','tan','shen'],cause.id);
  setFlag(s,'bridge-invitation');
  if(s.role==='zhao'){
    const e=response(s,'chen','陈挽没急着应，先看了一眼被雨压暗的窗。\n“等台风过了吧。后日去对岸，路上也从容些。”',['chen','zhao','zhuo','tan','shen'],invitation.id);
    setFlag(s,'bridge-set');setFlag(s,'bridge');
    response(s,'tan','谭又明朝窗外望了一下，失笑。\n“把这天气忘了。行，你看着安排。”',['chen','zhao','tan','zhuo','shen'],e.id);
    trace(s,'tan','chen','把心血来潮的邀约改成能成行的安排',e);
  }
}
function finish(s:ChapterState){
  if(s.phase==='ended')return;
  if(!flag(s,'transport-checked')){
    const e=event(s,'manager','经理按原有候车单叫车，门童逐一核对司机，离场比提前安排多等了一会儿。',ALL,'transport-default');
    scene(s,e.text);
  }
  if(s.role==='chen'&&!flag(s,'join')&&!flag(s,'decline')){setFlag(s,'decline');record(s,'chen','陈挽向车窗那边点点头，示意自己还要留在这里照应客人。',['chen','tan'],'decline')}
  const last=event(s,'world','司机接过钥匙。几辆车沿着盘山路离开，尾灯很快被弯道和雨水隔住。',ALL,'departure');scene(s,last.text);
  s.positions.zhao='departed';s.positions.tan='departed';s.positions.shen='departed';
  const threads:string[]=[];
  if(flag(s,'tea'))threads.push(s.role==='chen'?'甜点的缺口补成了凉茶，席上的人续了杯。':'凉茶的味道留了下来。'+(flag(s,'credit-known')?'你已经知道安排出自谁手。':'是谁的主意，你没有追问。'));
  else threads.push('红豆汤稳妥地补上了甜点，晚宴没有为此中断。');
  if(flag(s,'introduced'))threads.push('卓的引见已经发生；这一晚，至少有了一个正式的照面。');
  else threads.push('没有正式引见。距离保留着，今晚的细节仍然发生过。');
  if(flag(s,'bridge-set'))threads.push('看桥与打球改到风球过后，谭记下了这份周全。');
  if(flag(s,'transport-checked'))threads.push('提前确认的车辆次序，让檐下少了一段等待。');
  if(flag(s,'boundary'))threads.push('一句越过分寸的话让对方有所保留；之后的客气没有抹去它。');
  let title='',text='';
  if(s.role==='chen'){
    if(flag(s,'join')){title='多走的一步';text='经理接过交接单，向你示意。你收好伞，走向谭又明替你留下的车位。今晚没有忽然变得亲近，只是原本要说的“下次”，被你改成了这一次。\n车门合上。下一处灯火，暂时不在本章里。';s.place='departed';s.positions.chen='departed'}
    else if(flag(s,'thanked')){title='一句落在实处的话';text='车走了，那句简短的谢意仍然清楚。你把伞收拢，水顺着伞尖落在石阶边。\n餐厅里还有人叫你。你应了一声，转身回去；该做的事一件也没少，今晚却多了一个可以记住的停顿。';s.place='canopy'}
    else {title='灯仍亮着';text='最后一辆车越过弯道，雨里只剩下路灯。你收了伞，回身看见侍应还在等人点头。\n这一晚安排妥当，没什么需要再补说的。陈挽重新走进餐厅，身后的风把门轻轻推了一下。';s.place='hall'}
  }else{
    title=flag(s,'credit-known')&&flag(s,'introduced')?'名字与细节':flag(s,'boundary')?'分寸之外':'片刻舒心';
    text=flag(s,'credit-known')&&flag(s,'introduced')?'车厢里静下来。茶的余味还在，卓介绍过的名字也没有混进那些客套话里。\n你并没有因此知道陈挽更多的事。只是往后再听见这个名字，大概能与今晚的几件小事对上。':'车开出一段路，餐厅已经看不见了。手机再次亮起，你在回消息之前停了一会儿。\n这一席比近来的应酬舒服些。至于桌边那些没有多说的人，今夜仍只是见过。';
    s.place='departed';s.positions.zhao='departed';
  }
  s.positions[s.role]=s.place;s.ending={title,text,threads};s.phase='ended';message(s,'scene',text,'chapter');
}
function enter(s:ChapterState,next:ChapterPhase){
  s.phase=next;s.phaseActions=0;message(s,'scene',PHASES.find(p=>p.id===next)!.name,'chapter');
  if(next==='arrival'){
    s.minutes=0;s.place=s.role==='chen'?'service':'canopy';s.positions={chen:'service',zhao:'canopy',tan:'canopy',shen:'canopy',zhuo:'hall',manager:'service'};
    scene(s,'数日后，湾区傍山别墅餐厅。\n山下的海浪一阵阵扑上来，屋里的灯照着酒杯。赵声阁到得从容，沈宗年和谭又明在他身后；卓智轩迎过去，位置仍往后让着。');
    if(s.role==='chen')scene(s,'你来得早。经理站在一旁等最后一遍确认；主桌那边有人起身迎客，你手里的酒水单还有两处要核。');
    else {const e=record(s,'chen','陈挽与经理核对了温度、兰花的位置和醒酒时间，没有到门口去。',['chen','manager'],'prepare');setFlag(s,'prepared');scene(s,'入门时，乐声的轻重和室内的凉意都合适。没有人急着挤到跟前，你先和熟人点头。');}
  }
  if(next==='dinner'){
    for(const p of ['chen','zhao','tan','shen','zhuo'] as ChapterPerson[])s.positions[p]='hall';s.positions.manager='service';s.place='hall';s.minutes=Math.max(s.minutes,15);
    scene(s,'第一道热菜上来，迎客的人陆续落座。你也回到自己的席位。\n圆桌两头隔着菜与说笑声。陈挽坐得很远，赵声阁身旁的话不向整桌展开。');
    if(s.role==='chen')response(s,'zhuo','卓智轩隔着人看了你一眼，又朝主座轻轻抬了抬酒杯。',['chen','zhuo']);
    else if(flag(s,'prepared'))scene(s,'菜的火候恰好，酒也没有醒得太过。谭又明说话间留意了一眼你的筷子。');
  }
  if(next==='dessert'){
    s.minutes=Math.max(s.minutes,45);s.positions.manager='service';
    scene(s,'热菜渐渐撤下。经理走到陈挽身边，声音压得很低。');
    if(s.role==='chen'){
      ensureAt(s,'chen','service');
      const e=response(s,'manager','经理把菜单翻到甜点那页。\n“陈先生，芒果那批货被台风耽误了。后厨备着红豆汤，您看要不要换？”',['chen','manager']);
    }else{
      ensureAt(s,'chen','service');
      event(s,'manager','芒果因台风没有运到，原定甜点做不了；后厨备着红豆汤。',['chen','manager'],'shortage');
      scene(s,'你隔着圆桌只看见经理翻动菜单，并没有听清他们说什么。可以过去问，也可以让他们自行处理。');
    }
  }
  if(next==='meeting'){
    s.minutes=Math.max(s.minutes,62);for(const p of ['zhao','tan','shen','zhuo'] as ChapterPerson[])ensureAt(s,p,'hall');
    scene(s,'席间开始有人起身敬酒。卓智轩端着杯子，往陈挽那边看了一眼，没有隔着人高声招呼。');
    if(s.role==='chen'){relocate(s,'zhuo',s.place);response(s,'zhuo','卓走到你身边，语气熟得不必客套。\n“忙了一晚，好歹过去碰个杯。”',['chen','zhuo']);}
    else scene(s,'沈宗年刚说完一件事，卓已带着陈挽往主座这边过来。两人停下，等你们的话告一段落。');
  }
  if(next==='farewell'){
    s.minutes=Math.max(s.minutes,90);s.place='canopy';s.positions={chen:'canopy',zhao:'canopy',tan:'canopy',shen:'canopy',zhuo:'hall',manager:'canopy'};
    scene(s,'散场了。你随人流来到檐下，室外的海浪声一下近起来。\n赵声阁拿着外套，电话里的话说得低。陈挽站在不挡路的地方，餐厅的灯从他身后照出来。');
    if(s.role==='chen')response(s,'tan','谭又明从车窗探出头，朝餐厅这边招手。\n“阿挽，收拾完过来？我们去桂兰坊。”',['chen','tan']);
    else scene(s,'电话挂断，司机在等你上车。谭又明从另一辆车里招呼陈挽，陈挽回头看了看还未走完的宾客。');
  }
}
function advance(s:ChapterState){
  if(s.phase==='landing'){
    if(s.role==='chen'&&!flag(s,'airport-confirmed'))scene(s,'在你离开机场前，黑色迈巴赫驶出了 B3。是否再跟上一程，你没有说；接下来的几日，接风宴照常准备。');
    enter(s,'arrival');return;
  }
  if(s.phase==='arrival'){enter(s,'dinner');return}
  if(s.phase==='dinner'){enter(s,'dessert');return}
  if(s.phase==='dessert'){
    if(!flag(s,'dessert-served'))serveDessert(s,s.role==='chen'?'red-bean':'tea',s.role==='chen'?'manager':'chen');
    enter(s,'meeting');return;
  }
  if(s.phase==='meeting'){
    if(s.role==='zhao'&&!flag(s,'introduced'))introduction(s);
    if(s.role==='chen'&&flag(s,'introduced')&&!flag(s,'bridge-set'))response(s,'tan','谭又明又看看窗外，改了主意。\n“算了，等这风过去再说。”',['chen','zhao','zhuo','shen','tan']);
    enter(s,'farewell');return;
  }
  if(s.phase==='farewell')finish(s);
}
function choice(s:ChapterState,id:string){
  const option=chapterChoices(s).find(c=>c.id===id);if(!option)throw new Error('这件事在当前时刻不能再做。请按眼前的选项继续。');
  if(option.place)ensureAt(s,s.role,option.place);
  s.completed.push(id);
  switch(id){
    case 'airport-watch':{
      const e=record(s,'chen','陈挽等到那道身影上了黑色迈巴赫，才重新握住方向盘。你隔着一段车距跟上，确认车过了海底隧道，便转向另一条路。',['chen'],'airport-confirmed');setFlag(s,'airport-confirmed');scene(s,'这趟“接机”没有见面，也没有招呼。对方不知道你来过。');break;
    }
    case 'airport-zhuo':{
      record(s,'chen','陈挽发去餐厅照片。卓问起同行的人，你回了一句：\n“他自己回来的。”',['chen','zhuo'],'speech');
      response(s,'zhuo','卓智轩停了片刻，声音压下来。\n“你跑机场去了？陈挽，别给我弄出事。”',['chen','zhuo']);
      record(s,'chen','“我有分寸。”陈挽把话说得轻，先把餐厅的正事交代完。',['chen','zhuo'],'speech');break;
    }
    case 'airport-work':record(s,'zhao','赵声阁先确认回程线路，把接风的邀约留到后面处理。司机关好后备厢，等他上车。',['zhao'],'work');break;
    case 'airport-window':record(s,'zhao','赵声阁收起手机，在车里坐定。雨沿着玻璃往下淌，外面的车灯晃过去，没有哪一辆需要他多看。',['zhao'],'observe');break;
    case 'prepare':{
      const e=record(s,'chen','陈挽请经理把温度再调低一点，移开挡在灯下的兰花，又叮嘱酒不必醒透。经理逐项记下，让侍应去办。',['chen','manager'],'prepare');setFlag(s,'prepared');trace(s,'manager','chen','交代具体，侍应知道该怎样落实',e);break;
    }
    case 'keep-distance':record(s,'chen','陈挽从迎宾的动线旁退开，低头确认最后一页单子。来客越过身边，他按礼数点了点头。',['chen','manager'],'discretion');setFlag(s,'discreet');break;
    case 'notice-room':record(s,'zhao','赵声阁没有急着坐下。灯光、室温、身边人说话的距离都合适，他把外套交给侍应，才朝主座走去。',['zhao','tan','shen'],'notice');setFlag(s,'noticed');break;
    case 'ask-host':{
      ensureAt(s,'zhuo','hall');const e=record(s,'zhao','赵声阁问卓智轩：\n“今晚是谁在照应？”',['zhao','zhuo'],'speech');
      response(s,'zhuo','卓朝侍应台那边看了一眼，没把声音抬高。\n“陈挽，我老同学。这样的事交给他，省心。”',['zhao','zhuo'],e.id);setFlag(s,'credit-known');setFlag(s,'name-known');break;
    }
    case 'quiet-tea':record(s,'chen','陈挽朝卓智轩笑了笑，接住他的意思，却没有站起来。茶水还温着，桌上有人继续讲海市的近闻。',['chen','zhuo'],'discretion');setFlag(s,'discreet');break;
    case 'ask-help':{
      const e=record(s,'chen','陈挽走近卓，低声请他替自己留意下一道菜和客人续杯。',['chen','zhuo'],'request');
      response(s,'zhuo','卓把酒杯搁下，叫住刚经过的侍应，确认过上菜顺序，才回过头来。\n“行，你先吃两口。也不至于这一桌都要你一个人看着。”',['chen','zhuo'],e.id);trace(s,'zhuo','chen','你肯把具体的事交给他，他实际接手了',e);setFlag(s,'helped');break;
    }
    case 'taste':{
      const e=record(s,'zhao','赵声阁尝了一口菜，没有很快放下筷子。',['zhao','tan','shen'],'taste');
      response(s,'tan','谭又明侧过身，声音只够近旁听见。\n“还合口？”',['zhao','tan','shen'],e.id);
      record(s,'zhao','赵声阁点了一下头。\n“嗯。”',['zhao','tan','shen'],'speech');setFlag(s,'noticed');break;
    }
    case 'ask-chen':{
      ensureAt(s,'zhuo','hall');const e=record(s,'zhao','赵声阁问卓智轩：\n“陈挽平日也替你照应这些？”',['zhao','zhuo','shen','tan'],'speech');
      response(s,'zhuo','卓智轩顺着他的话往桌末看了一眼。\n“碰上聚会会帮忙。他做事，你见一回就知道。”',['zhao','zhuo','shen','tan'],e.id);
      response(s,'shen','沈宗年把杯子放下，看向赵声阁。\n“怎么问起他？”',['zhao','zhuo','shen','tan'],e.id);setFlag(s,'shen-question');setFlag(s,'name-known');break;
    }
    case 'ask-shortage':{
      const e=record(s,'zhao','赵声阁走到侍应台，问经理：\n“甜点有问题？”',['zhao','manager','chen'],'speech');
      response(s,'manager','经理把事情说清，没把责任推给后厨。\n“芒果那批货被台风耽误了，陈先生正和我们商量更换。现在有红豆汤可以做。”',['zhao','manager','chen'],e.id);setFlag(s,'shortage-known-zhao');break;
    }
    case 'tea':case 'red-bean':serveDessert(s,id,s.role);break;
    case 'watch-cup':{
      const text=flag(s,'tea')?'陈挽没有急着问好不好，只在侍应添茶时看了一眼主位。赵声阁手边的茶盅已经浅了，谭又明又要了一杯。':'陈挽确认甜点都已送到，才坐回去。没有人再招手催促，后厨那一处缺口算是补上了。';record(s,'chen',text,['chen'],'observe');break;
    }
    case 'ask-tea':{
      ensureAt(s,'tan','hall');const e=record(s,'zhao','赵声阁问了谭又明一句：\n“茶点是谁换的？”',['zhao','tan','shen'],'speech');
      if(s.completed.includes('tea')||s.completed.includes('red-bean'))response(s,'tan','谭又明朝侍应台示意。\n“不是你方才过去定的吗？”',['zhao','tan','shen'],e.id);
      else {response(s,'tan','谭又明叫住经理确认。经理解释过，谭才转回身。\n“陈挽的主意。原来的甜点让这台风耽误了。”',['zhao','tan','shen'],e.id);setFlag(s,'credit-known');setFlag(s,'name-known')};break;
    }
    case 'introduce':introduction(s);break;
    case 'stay-seated':record(s,'chen','陈挽示意卓先过去，自己还想把手头的事收好。卓看看他的神色，没有再端着杯子堵在身旁。',['chen','zhuo'],'decline');setFlag(s,'declined-introduction');break;
    case 'bridge':{
      if(flag(s,'bridge-set')){scene(s,'看桥与打球已经说好等风球过后。你确认了时间，没有再把同一件事算作新的照顾。');break}
      const e=record(s,s.role,`${CAST[s.role].name}把出行往后推了两日，先等台风过去，再去大桥对岸。`,['chen','zhao','zhuo','shen','tan'],'bridge-plan');
      response(s,'tan','谭又明顺着他的话看了一眼窗外。\n“也是，这天气。就后日吧。”',['chen','zhao','zhuo','shen','tan'],e.id);setFlag(s,'bridge-set');trace(s,'tan',s.role,'把明日的临时邀约改成能成行的安排',e);break;
    }
    case 'light-exit':{
      if(s.role==='chen'){record(s,'chen','陈挽虚举一下酒杯。\n“我去看看还要不要添茶，各位慢慢。”',['chen','zhao','zhuo','shen','tan'],'speech');relocate(s,'chen','service');setFlag(s,'discreet')}
      else record(s,'zhao','赵声阁点头示意，没把刚有过的照面拖成盘问。杯子落回桌上，席间的谈话自然接上。',['chen','zhao','zhuo','shen','tan'],'discretion');break;
    }
    case 'ask-circle':{
      ensureAt(s,'chen','service');const e=record(s,'zhao','赵声阁等陈挽离开，才问起他怎么和几人相熟。',['zhao','tan','shen'],'speech');
      response(s,'tan','谭又明收了刚才玩笑的语气。\n“人是可靠的。你不用因为他替我们安排这些，就另作猜想。”',['zhao','tan','shen'],e.id);
      response(s,'shen','沈宗年接了一句，语气平常。\n“没问题。”',['zhao','tan','shen'],e.id);setFlag(s,'vouched');break;
    }
    case 'cars':{
      const e=record(s,s.role,`${CAST[s.role].name}与经理对过司机、车辆和泊车次序，请门童把候车位置留在檐下。`,[s.role,'manager'],'cars');setFlag(s,'transport-checked');
      response(s,'manager','经理把单子交给门童，等对方与司机逐一确认，才回来点头。\n“已经对好了，车过来就能上。”',[s.role,'manager'],e.id);trace(s,'manager',s.role,'候车次序有了实际交接',e);break;
    }
    case 'umbrella':record(s,s.role,`${CAST[s.role].name}从伞架取下一把长柄黑伞，在檐外撑开。风推着伞面，你往避风处站稳了一些。`,[s.role],'umbrella');setFlag(s,'umbrella');break;
    case 'decline':{
      const e=record(s,'chen','陈挽回头看一眼餐厅，朝车窗笑了笑。\n“下次吧谭少，里面还有客人。”',['chen','tan'],'decline');response(s,'tan','谭又明没有勉强，抬手示意他忙自己的。\n“行，改天。”',['chen','tan'],e.id);setFlag(s,'decline');s.completed.push('join');break;
    }
    case 'join':{
      const e=record(s,'chen','陈挽先与经理对完剩余宾客和车辆，确认有人接手，才走回车边。\n“交代好了，今晚一起过去。”',['chen','tan','manager'],'handover');response(s,'tan','谭又明往里面挪了挪，让出一个位置。\n“这不就好了。上车。”',['chen','tan'],e.id);setFlag(s,'join');s.completed.push('decline');trace(s,'manager','chen','离开前把剩余事务交接清楚',e);break;
    }
    case 'thanks':{
      const text=flag(s,'credit-known')?'赵声阁在上车前叫住陈挽。\n“今晚的安排，多谢。”':'赵声阁在上车前向檐下的陈挽点头。\n“先走了。”';
      const e=record(s,'zhao',text,['chen','zhao'],'speech');response(s,'chen','陈挽稍稍站直，声音在雨里仍听得清。\n“赵先生慢走。”',['chen','zhao'],e.id);if(flag(s,'credit-known'))setFlag(s,'thanked');break;
    }
  }
}
export function applyChapterOperation(s:ChapterState,op:ChapterOperation):{target?:ChapterPerson;cause?:ChapterEvent}{
  if(s.phase==='ended')throw new Error('本章已经结束，可以回看结算，或换一个视角重新开始。');
  if(op.kind==='choice'){
    if(op.id==='continue')advance(s);else if(op.id)choice(s,op.id);else throw new Error('请选择眼前可以做的事。');return {};
  }
  if(op.kind==='move'){
    if(!op.place||s.phase==='landing'||!['hall','service','terrace','canopy'].includes(op.place))throw new Error('眼下能走动的是餐厅、侍应台、避风廊和檐下。机场与离场请沿章节继续。');
    relocate(s,s.role,op.place);s.minutes+=2;scene(s,chapterScene(s));return {};
  }
  if(op.kind==='observe'){record(s,s.role,chapterScene(s),[s.role],'observe');return {}}
  if(op.kind==='wait'){
    record(s,s.role,`${CAST[s.role].name}暂时不说话，给眼前的事留了一会儿时间。`,[s.role],'wait');s.minutes+=5;
    // Time moves even when the player stays silent. A chapter transition is announced clearly.
    if(s.phase==='dessert'&&!flag(s,'dessert-served'))serveDessert(s,s.role==='chen'?'red-bean':'tea',s.role==='chen'?'manager':'chen');
    else if(s.phaseActions>=3)advance(s);
    else scene(s,'侍应继续手头的事，风雨没有停。还可以做一点自己的事，或让这一段时间过去。');
    return {};
  }
  if(op.kind==='activity'){
    if(!op.text?.trim())throw new Error('写下一个具体的动作。');
    record(s,s.role,op.text.trim().startsWith(CAST[s.role].name)?op.text:`${CAST[s.role].name}${op.text}`,[s.role,...chapterPresent(s)],'activity');s.minutes++;return {};
  }
  if(op.kind==='summon'){
    if(s.phase==='landing'||!op.via||!op.target||op.via===s.role||op.target===s.role||op.target===op.via||s.positions[op.via]!==s.place||s.positions[op.target]==='departed')throw new Error('先向眼前的人托付，且只能找仍在餐厅范围内的其他人。');
    const cause=record(s,s.role,`${CAST[s.role].name}请${CAST[op.via].name}把${CAST[op.target].name}找过来。`,[s.role,op.via],'request');
    response(s,op.via,`${CAST[op.via].name}应了一声，动身去找人。`,[s.role,op.via],cause.id);
    const destination=s.place;relocate(s,op.via,s.positions[op.target],cause.id);
    const delivered=event(s,op.via,`${CAST[op.via].name}转告：${CAST[s.role].name}请你过去一趟。`,[op.via,op.target],'invitation',cause.id);
    relocate(s,op.via,destination,cause.id);relocate(s,op.target,destination,delivered.id);
    response(s,op.target,`${CAST[op.target].name}到近旁停下。\n“找我什么事？”`,[s.role,op.target,op.via],delivered.id);s.minutes+=3;return {};
  }
  if(op.kind==='say'){
    if(!op.target||op.target===s.role||s.phase==='landing'||s.positions[op.target]!==s.place)throw new Error('先走到对方面前，再说这句话。');
    if(!op.text?.trim())throw new Error('写下想说的话。');
    // A large table is not an omniscient room. Quiet exchanges are delivered only to their addressee.
    const witnesses:ChapterPerson[]=[s.role,op.target];
    if(!op.private&&s.place==='hall'&&s.role==='zhao'&&['zhuo','tan','shen'].includes(op.target))for(const p of ['shen','tan'] as ChapterPerson[])if(s.positions[p]==='hall')witnesses.push(p);
    const cause=record(s,s.role,op.text,witnesses,'speech');return {target:op.target,cause};
  }
  throw new Error('这个动作暂时无法执行。');
}
export function chapterTurn(original:ChapterState,ops:ChapterOperation[],inputText?:string){
  if(original.turn>=100&&!ops.every(op=>op.kind==='choice'&&op.id==='continue'))throw new Error('本章已到100步。请回到存档或重新开始。');
  const s=structuredClone(original);s.turn++;s.phaseActions++;
  const phase=s.phase;let reply:{target?:ChapterPerson;cause?:ChapterEvent}={};
  for(const op of ops){reply=applyChapterOperation(s,op);if(reply.target||s.phase!==phase)break}
  return {state:s,...reply};
}
export function chapterNpcReply(s:ChapterState,target:ChapterPerson,text:string,sourceIds:string[],cause:ChapterEvent){
  if(target===s.role||s.positions[target]!==s.place)throw new Error('对方此刻不能隔空回应。');
  if(sourceIds.some(id=>!chapterKnown(s,target).some(e=>e.id===id)))throw new Error('回应引用了对方尚未知道的事情。');
  const witnesses=cause.witnesses.filter(p=>s.positions[p]===s.place);
  response(s,target,text,witnesses,cause.id);
  if(s.role==='zhao'&&target==='zhuo'&&cause.witnesses.includes('shen')&&s.positions.shen===s.place&&/陈挽/.test(cause.text)&&/打听|了解|最近|忙|怎么样|什么样|照应/.test(cause.text)&&!flag(s,'shen-question')){
    response(s,'shen','沈宗年原本听着，至此把杯子放回桌上。\n“你怎么忽然问起陈挽？”',witnesses,cause.id);setFlag(s,'shen-question');
  }
}
export function chapterView(s:ChapterState){
  const known=chapterKnown(s,s.role),ids=new Set(known.map(e=>e.id));
  return {id:s.id,role:s.role,phase:s.phase,phaseName:PHASES.find(p=>p.id===s.phase)!.name,place:s.place,scene:chapterScene(s),turn:s.turn,modelCalls:s.modelCalls,
    clock:s.phase==='landing'?'归国当日':`${String(19+Math.floor((50+s.minutes)/60)).padStart(2,'0')}:${String((50+s.minutes)%60).padStart(2,'0')}`,
    choices:chapterChoices(s),continueLabel:continueLabel(s),messages:s.messages,present:s.phase==='landing'?[]:chapterPresent(s),
    people:ALL.filter(p=>p!==s.role&&p!=='manager').map(p=>({id:p,place:s.positions[p]===s.place?s.place:null,nearby:s.phase!=='landing'&&s.positions[p]===s.place,
      impressions:s.traces.filter(t=>t.observer===p&&ids.has(t.eventId)).map(t=>t.reason)})),
    events:known.map(({witnesses,...e})=>({...e,cause:e.cause&&ids.has(e.cause)?e.cause:undefined,witnesses})),
    traces:s.traces.filter(t=>ids.has(t.eventId)),ending:s.ending,
    inventory:flag(s,'umbrella')?['自己的手机','借用的长柄黑伞']:['自己的手机'],
    progress:Math.min(6,PHASES.findIndex(p=>p.id===s.phase)),maxModelTurns:30};
}
export type ChapterView=ReturnType<typeof chapterView>;
