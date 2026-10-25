import {songSections,defaultArrangement} from './arrangement.js';
import {compactSectionName} from './songs.js';
// Store a background cue at the exact sequence position, including a page inside a song.
export function sequenceFor(raw,origin){return origin.section==null?raw.sequence:raw.sections[origin.section].sequence;}
export function setMediaSource(raw,show,index,values){
 const item=show.items[index],key=item?.track?.key;
 const source=show.items.find(page=>key&&page.track?.key===key&&page.media&&typeof page.media==='object');
 if(!source)throw Error('此頁沒有可編輯的媒體來源。');
 const next=structuredClone(raw),origin=source.origin;
 const owner=['page','group'].includes(origin.kind)?next.pages[source.id]:sequenceFor(next,origin)[origin.sequence];
 if(!owner?.media||typeof owner.media!=='object')throw Error('找不到媒體設定。');
 for(const [field,value] of Object.entries(values)){
  const variable=typeof owner.media[field]==='string'&&/^\{\{([^}]+)\}\}$/.exec(owner.media[field]);
  if(variable){next.variables??={};next.variables[variable[1].trim()]=value;}
  else owner.media[field]=value;
 }
 owner.media.autoTitle=false;
 return next;
}
export function setBackgroundCue(raw,item,background){
  const next=structuredClone(raw),{sequence,kind,sub}=item.origin;
  const list=sequenceFor(next,item.origin);
  if(kind==='boundary'){
    next.sections[item.origin.section][item.origin.edge==='start'?'startBackground':'endBackground']=background;
  }else if(kind==='song-title'){
    list[sequence].background=background;
  }else if(kind==='reading'){
    list[sequence].backgroundAt={...list[sequence].backgroundAt,[sub+1]:background};
  }else if(kind==='song' || kind==='song-utility'){
    const entry=list[sequence];
    const hasPlan=entry.plan || next.leaderPlans?.[entry.song] || next.leaderPlans?.[String(entry.song)];
    if(entry.arrangement||hasPlan||kind==='song-utility')
      entry.backgroundSlots={...entry.backgroundSlots,[item.origin.slot+1]:background};
    else entry.backgroundAt={...entry.backgroundAt,[sub+1]:background};
  }else if(kind==='group'){
    const ref=list[sequence].pages[sub];
    list[sequence].pages[sub]={...(typeof ref==='string'?{page:ref}:ref),background};
  }else{
    const ref=list[sequence];list[sequence]={...(typeof ref==='string'?{page:ref}:ref),background};
  }
  return next;
}
// Match existing references by their old title when songs are reordered in the text editor.
export function replaceSongText(raw,source,oldSongs,newSongs){
  const next=structuredClone(raw);next.songs=source;
  const update=list=>list.flatMap(entry=>{
    if(!entry || typeof entry!=='object' || !Object.hasOwn(entry,'song'))return [entry];
    const old=oldSongs.find(s=>s.id===entry.song || s.title===entry.song);
    const atOldPosition=newSongs.find(s=>s.id===old?.id);
    const renamed=oldSongs.length===newSongs.length && atOldPosition && !oldSongs.some(s=>s.title===atOldPosition.title) ? atOldPosition:null;
    const song=newSongs.find(s=>s.title===old?.title) || renamed;
    if(!song)return [];
    let arrangement=entry.arrangement;
    if(Array.isArray(arrangement)){
      const previous=songSections(old),current=songSections(song);
      arrangement=arrangement.flatMap(ref=>{
        if(ref.utility)return [ref];
        const i=previous.findIndex(s=>compactSectionName(s.name)===compactSectionName(ref.section));
        const nextSection=current.find(s=>compactSectionName(s.name)===compactSectionName(ref.section))||current[i];
        if(!nextSection||ref.page>nextSection.pages.length)return [];
        return [{...ref,section:nextSection.name}];
      });
      if(!arrangement.length)arrangement=defaultArrangement(song);
    }
    return [{...entry,song:song.id,...(arrangement?{arrangement}:{}),backgroundAt:Object.fromEntries(Object.entries(entry.backgroundAt||{}).filter(([page])=>Number(page)<=song.pages.length)),transitionAt:Object.fromEntries(Object.entries(entry.transitionAt||{}).filter(([page])=>Number(page)<=song.pages.length))}];
  });
  if(next.sections){
    next.sections=next.sections.map(section=>({...section,sequence:update(section.sequence)})).filter(section=>section.sequence.length);
    let insertion=next.sections.findLastIndex(section=>section.sequence.some(e=>e?.song))+1;
    if(!insertion)insertion=next.sections.length;
    const used=next.sections.flatMap(section=>section.sequence).filter(e=>e?.song).map(e=>e.song);
    const additions=newSongs.filter(song=>!used.includes(song.id)).map(song=>({id:`song-${song.id}-${Date.now()}`,title:song.title,sequence:[{song:song.id}]}));
    next.sections.splice(insertion,0,...additions);return next;
  }
  next.sequence=update(next.sequence);
  let insertion=next.sequence.findLastIndex(entry=>entry && typeof entry==='object' && Object.hasOwn(entry,'song'))+1;
  if(!insertion)insertion=next.sequence.length;
  const missing=newSongs.filter(song=>!next.sequence.some(entry=>entry?.song===song.id));
  next.sequence.splice(insertion,0,...missing.map(song=>({song:song.id})));
  return next;
}
