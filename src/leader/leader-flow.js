// Pure view model for Leader 3. Preserve occurrence indices from the controller.
const compact=value=>String(value||'').replace(/\s+/g,'');
const groups=['intro','verse','prechorus','chorus','tag','bridge','extra','interlude','last-line','outro'];
const fixed=[
 {id:'utility:前奏',label:'前奏',category:'intro',kind:'instrumental'},
 {id:'verse:1',label:'主歌1',category:'verse',kind:'verse'},
 {id:'verse:2',label:'主歌2',category:'verse',kind:'verse'},
 {id:'prechorus:1',label:'前副歌',category:'prechorus',kind:'prechorus'},
 {id:'chorus:1',label:'副歌',category:'chorus',kind:'chorus'},
 {id:'chorus:2',label:'副歌2',category:'chorus',kind:'chorus'},
 {id:'tag:1',label:'小副歌',category:'tag',kind:'tag'},
 {id:'bridge:1',label:'橋段',category:'bridge',kind:'bridge'},
 {id:'utility:間奏',label:'間奏',category:'interlude',kind:'instrumental'},
 {id:'utility:尾句',label:'尾句',category:'last-line',kind:'instrumental'},
 {id:'utility:尾奏',label:'尾奏',category:'outro',kind:'instrumental'}
];
function sectionSlot(section){
 const label=compact(section?.name);
 let kind=section?.kind;
 if(!['verse','prechorus','chorus','tag','bridge'].includes(kind)){
  if(label.startsWith('前副歌'))kind='prechorus';
  else if(label.startsWith('小副歌'))kind='tag';
  else if(label.startsWith('副歌'))kind='chorus';
  else if(label.startsWith('主歌'))kind='verse';
  else if(label.startsWith('橋段'))kind='bridge';
  else return 'extra:'+label;
 }
 return kind+':'+(Number(label.match(/(\d+)$/)?.[1])||1);
}
export function slotFor(item,catalog){
 if(item.utility)return 'utility:'+item.utility;
 const section=catalog[item.song]?.sections[item.section];
 return section?sectionSlot(section):null;
}
// Union is independent of the currently browsed song. Unused controls are disabled.
export function fixedShortcutSlots(catalog){
 const slots=new Map(fixed.map(item=>[item.id,item]));
 for(const song of catalog)for(const section of song.sections){
  const id=sectionSlot(section);
  if(!slots.has(id)){
   const category=id.split(':')[0];
   slots.set(id,{id,label:compact(section.name),category:groups.includes(category)?category:'extra',kind:section.kind||'verse'});
  }
 }
 return [...slots.values()].sort((a,b)=>{
  const groupDelta=groups.indexOf(a.category)-groups.indexOf(b.category);
  if(groupDelta)return groupDelta;
  const number=x=>Number(x.id.split(':')[1])||1;
  return number(a)-number(b)||a.label.localeCompare(b.label,'zh-Hant');
 });
}
export function expandedRoute(route,catalog){
 const repeats=new Map();
 return route.map((item,routeIndex)=>{
  if(item.end)return {end:true,routeIndex,song:item.song,name:'結束',kind:'ending',pages:[]};
  const song=catalog[item.song];
  if(!song)return null;
  const section=item.utility?null:song.sections[item.section];
  if(!item.utility&&!section)return null;
  const name=item.utility||section.name;
  const key=[item.song,item.utility||('section:'+item.section)].join(':');
  const occurrence=(repeats.get(key)||0)+1;
  repeats.set(key,occurrence);
  const refs=item.pageRefs?.length?item.pageRefs:(item.utility?[0]:section.pages.map((_,i)=>i));
  const texts=item.utility?[item.utility]:refs.map(i=>section.pages[i]).filter(t=>t!==undefined);
  return {song:item.song,section:item.utility?-1:item.section,utility:item.utility||null,
   routeIndex,name,kind:item.utility?'instrumental':section.kind||'verse',
   occurrence,slot:slotFor(item,catalog),
   pages:texts.map((text,routePage)=>({routePage,sourcePage:refs[routePage],lines:String(text).split(/\r?\n/)}))
  };
 }).filter(Boolean);
}
export function navigationTarget(row,routePage=0){
 const page=row.pages[routePage];
 if(row.end||!page)return null;
 // Utility uses sectionIndex 0 because the deployed Worker requires nonnegative integers.
 return {songIndex:row.song,sectionIndex:row.utility?0:row.section,utility:row.utility,
  routeIndex:row.routeIndex,routePage,page:page.sourcePage};
}
export function nextShortcutRow(rows,slot,songIndex,fromIndex){
 const matches=rows.filter(r=>r.slot===slot&&r.song===songIndex);
 return matches.find(r=>r.routeIndex>fromIndex)||matches[0]||null;
}
