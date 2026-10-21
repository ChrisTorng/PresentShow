import {parsePlan} from '../leader/singer-sequence.js';
import {compactSectionName} from './songs.js';

// The arrangement contains references, never lyric text. Each reference remains
// editable through the original songs source, even when used several times.
export function songSections(song) {
  const sections=[];
  for(const page of song.pages){
    if(sections.at(-1)?.id!==page.sectionId)
      sections.push({id:page.sectionId,name:page.sectionName,pages:[]});
    sections.at(-1).pages.push(page);
  }
  return sections;
}
export function defaultArrangement(song) {
  return songSections(song).flatMap(section=>section.pages.map((_,i)=>({section:section.name,page:i+1})));
}
export function planArrangement(song,plan){
  const sections=songSections(song);
  const catalog=[{title:song.title,sections}];
  return parsePlan(0,plan,catalog).flatMap(part=>
    part.utility ? [{utility:part.utility}] :
    sections[part.section].pages.map((_,i)=>({section:sections[part.section].name,page:i+1})));
}
export function arrangedSong(song, entry, plan){
  const arrangement=entry.arrangement ?? (plan ? planArrangement(song,plan) : defaultArrangement(song));
  if(!Array.isArray(arrangement)||!arrangement.length)throw Error(`${song.title}：播放編排不可為空。`);
  const sections=songSections(song);
  return arrangement.map((token,index)=>{
    if(token && typeof token==='object' && typeof token.utility==='string'){
      if(!['前奏','間奏','變奏','尾句','尾奏'].includes(token.utility))
        throw Error(`${song.title}：未知的演唱提示 ${token.utility}。`);
      return {utility:token.utility,source:null,slot:index,ref:{utility:token.utility}};
    }
    if(!token || typeof token.section!=='string'||!Number.isInteger(token.page)||token.page<1)
      throw Error(`${song.title}：編排第 ${index+1} 項需要 section 與正整數 page。`);
    const section=sections.find(s=>compactSectionName(s.name)===compactSectionName(token.section));
    const source=section?.pages[token.page-1];
    if(!source)throw Error(`${song.title}：編排第 ${index+1} 項找不到 ${token.section} 第 ${token.page} 頁。`);
    return {source,slot:index,ref:{section:section.name,page:token.page}};
  });
}
export function upgradeSongArrangements(raw,show) {
  const result=structuredClone(raw);
  const lists=result.sections?.map(section=>section.sequence) || [result.sequence];
  for(const list of lists)for(const entry of list)if(entry && typeof entry==='object' && entry.song!=null){
    if(entry.arrangement)continue;
    const song=show.songs.find(s=>s.id===entry.song||s.title===entry.song);
    if(!song)continue;
    const plan=result.leaderPlans?.[song.id] ?? result.leaderPlans?.[song.title];
    entry.arrangement=arrangedSong(song,entry,plan).map(s=>s.ref);
  }
  return result;
}
export function editArrangement(raw,show,origin,action,targetOrigin=null) {
  if(origin.kind!=='song'&&origin.kind!=='song-utility')throw Error('請選擇歌曲歌詞或提示頁編排。');
  if(targetOrigin && (origin.section!==targetOrigin.section || origin.sequence!==targetOrigin.sequence))
    throw Error('歌曲頁面只可在同一首歌的編排中移動；可複製歌曲項目來安排整首重唱。');
  const next=upgradeSongArrangements(raw,show);
  const list=origin.section==null?next.sequence:next.sections[origin.section].sequence;
  const order=list[origin.sequence].arrangement;
  const from=origin.slot,to=targetOrigin?.slot??from;
  if(from<0||from>=order.length||to<0||to>=order.length)throw Error('頁面編排位置已失效。');
  if(action==='delete'){
    if(order.length===1)throw Error('歌曲播放編排至少需要一頁。');
    order.splice(from,1);
  }else if(action==='copy'){
    order.splice(to+1,0,structuredClone(order[from]));
  }else if(action==='move'){
    if(from!==to)order.splice(to,0,order.splice(from,1)[0]);
  }else if(action==='up' && from>0)order.splice(from-1,0,order.splice(from,1)[0]);
  else if(action==='down' && from<order.length-1)order.splice(from+1,0,order.splice(from,1)[0]);
  return next;
}
