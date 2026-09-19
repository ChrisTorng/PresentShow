// Store a background cue at the exact sequence position, including a page inside a song.
export function sequenceFor(raw,origin){return origin.section==null?raw.sequence:raw.sections[origin.section].sequence;}
export function setBackgroundCue(raw,item,background){
  const next=structuredClone(raw),{sequence,kind,sub}=item.origin;
  const list=sequenceFor(next,item.origin);
  if(kind==='boundary'){
    next.sections[item.origin.section][item.origin.edge==='start'?'startBackground':'endBackground']=background;
  }else if(kind==='song-title'){
    list[sequence].background=background;
  }else if(kind==='reading'){
    list[sequence].backgroundAt={...list[sequence].backgroundAt,[sub+1]:background};
  }else if(kind==='song'){
    const entry=list[sequence];entry.backgroundAt={...entry.backgroundAt,[sub+1]:background};
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
    return [{...entry,song:song.id,backgroundAt:Object.fromEntries(Object.entries(entry.backgroundAt||{}).filter(([page])=>Number(page)<=song.pages.length)),transitionAt:Object.fromEntries(Object.entries(entry.transitionAt||{}).filter(([page])=>Number(page)<=song.pages.length))}];
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
