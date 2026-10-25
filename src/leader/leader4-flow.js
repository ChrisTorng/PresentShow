// Shortcut slots are the union of the loaded songs and their actual route.
import {repeatRuns} from '../config/repeats.js';
const compact=value=>String(value||'').replace(/\s+/g,'').replace(/橋段/g,'小副歌');
const groups=['intro','verse','prechorus','chorus','tag','interlude','extra','last-line','outro'];
const kinds={主歌:'verse',前副歌:'prechorus',副歌:'chorus',小副歌:'tag',尾句:'last-line'};
const utilityCategories={'前奏':'intro','間奏':'interlude','尾奏':'outro','變奏':'interlude','禱告':'extra','講話':'extra'};
const utilitySlot=name=>'utility:'+compact(name).replace(/^(.*?)(\d+)$/,(_,base,number)=>base+(Number(number)===1?'':number));
function sectionSlot(section){
 const label=compact(section?.name),base=label.replace(/\d+$/,'');
 if(Object.hasOwn(utilityCategories,base))return utilitySlot(label);
 const kind=kinds[base]||(section?.kind==='bridge'?'tag':section?.kind)||'extra';
 return ['verse','prechorus','chorus','tag','last-line'].includes(kind)?kind+':'+(Number(label.match(/(\d+)$/)?.[1])||1):'extra:'+label;
}
export function slotFor(item,catalog){
 if(item.utility)return utilitySlot(item.utility);
 const section=catalog[item.song]?.sections[item.section];
 return section?sectionSlot(section):null;
}
export function fixedShortcutSlots(catalog,route=[],viewedSong=0){
 const slots=new Map();
 const add=(id,label,kind,category=kind)=>{if(!slots.has(id))slots.set(id,{id,label:compact(label),kind,category:groups.includes(category)?category:'extra'});};
 for(const song of catalog)for(const section of song.sections){
  const id=sectionSlot(section),base=compact(section.name).replace(/\d+$/,'');
  add(id,section.name,Object.hasOwn(utilityCategories,base)?'instrumental':section.kind==='bridge'?'tag':section.kind,utilityCategories[base]||id.split(':')[0]);
 }
 for(const item of route)if(item.utility){
  const category=utilityCategories[compact(item.utility).replace(/\d+$/,'')]||(item.utility==='尾句'?'last-line':'extra');
  add(utilitySlot(item.utility),item.utility,'instrumental',category);
 }
 for(const slot of slots.values()){
  const local=catalog[viewedSong]?.sections.find(section=>sectionSlot(section)===slot.id);
  const localUtility=route.find(item=>item.song===viewedSong&&item.utility&&utilitySlot(item.utility)===slot.id);
  if(local)slot.label=compact(local.name);
  else if(localUtility)slot.label=compact(localUtility.utility);
  else if(!slot.id.startsWith('utility:')&&!slot.id.startsWith('extra:')){
   const [kind,number]=slot.id.split(':');
   const max=Math.max(...[...slots.keys()].filter(id=>id.startsWith(kind+':')).map(id=>Number(id.split(':')[1])));
   slot.label=slot.label.replace(/\d+$/,'')+(max>1?number:'');
  }
 }
 return [...slots.values()].sort((a,b)=>groups.indexOf(a.category)-groups.indexOf(b.category)||Number(a.id.split(':')[1]||0)-Number(b.id.split(':')[1]||0)||a.label.localeCompare(b.label,'zh-Hant'));
}
export function songBrowseTarget(songIndex,active,lastPositions){
 if(active.singing&&active.songIndex===songIndex)return active.routeIndex;
 return lastPositions.get(songIndex)?.routeIndex??null;
}
export function expandedRoute(route,catalog){
 const runs=repeatRuns(route,item=>JSON.stringify([item.song,item.utility,item.section,!!item.end]));
 return route.map((item,routeIndex)=>{
  if(item.end)return {end:true,routeIndex,song:item.song,name:'結束',kind:'ending',pages:[]};
  const song=catalog[item.song];
  if(!song)return null;
  const section=item.utility?null:song.sections[item.section];
  if(!item.utility&&!section)return null;
  const name=item.utility||compact(section.name);
  const {occurrence,total}=item.repeat||runs[routeIndex],repeated=total>1;
  const refs=item.pageRefs?.length?item.pageRefs:(item.utility?[0]:section.pages.map((_,i)=>i));
  const texts=item.utility?[item.utility]:refs.map(i=>section.pages[i]).filter(t=>t!==undefined);
  return {song:item.song,section:item.utility?-1:item.section,utility:item.utility||null,
   routeIndex,name,kind:item.utility?'instrumental':section.kind==='bridge'?'tag':section.kind||'verse',
   occurrence,total,repeated,loop:!!item.loop,slot:slotFor(item,catalog),
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
