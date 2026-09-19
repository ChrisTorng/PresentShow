const aliases={verse:'V',v:'V','主歌':'V','pre-chorus':'P',prechorus:'P','pre chorus':'P',p:'P','導歌':'P',chorus:'C',c:'C','副歌':'C',bridge:'B',b:'B','橋段':'B',intro:'I',i:'I',outro:'O',o:'O',tag:'T',t:'T',ending:'E',e:'E'};
export const SONG_KEYS=['V','P','C','B','I','O','T','E'];
export function parseSongs(source=''){
  if(typeof source!=='string')throw new Error('songs 請使用 | 多行純文字。');
  const songs=[];let song=null,lines=[],section='Verse',sectionKey='V',sectionId=0,first=true;
  function flush(){
    if(!lines.length)return;
    if(!song)throw new Error('歌詞請先用 # 歌名 開始。');
    song.pages.push({text:lines.join('\n'),section,sectionKey,sectionId,sectionStart:first});lines=[];first=false;
  }
  for(const raw of source.replace(/^\uFEFF/,'').replaceAll('\r','').split('\n')){
    const line=raw.trim();
    if(/^#\s+/.test(line)){
      flush();song={id:songs.length+1,title:line.replace(/^#\s+/,''),pages:[]};songs.push(song);section='Verse';sectionKey='V';sectionId=0;first=true;
    }else if(/^\[.+\]$/.test(line)){
      flush();if(!song)throw new Error('段落標記前需要 # 歌名。');
      section=line.slice(1,-1).trim();const normalized=section.toLowerCase().replace(/\s*\d+$/,'');
      sectionKey=aliases[normalized] || null;sectionId++;first=true;
    }else if(!line)flush();
    else lines.push(line.replace(/\\~/g,'~'));
  }
  flush();
  for(const song of songs){
    if(!song.pages.length)throw new Error(`歌曲「${song.title}」沒有歌詞。`);
    const counts={},groups=new Map();
    for(const page of song.pages){
      if(!groups.has(page.sectionId)){const key=page.sectionKey||page.section;counts[key]=(counts[key]||0)+1;groups.set(page.sectionId,{number:counts[key],pages:[]});}
      groups.get(page.sectionId).pages.push(page);
    }
    for(const group of groups.values())group.pages.forEach((page,i)=>{page.sectionNumber=group.number;page.sectionPage=i+1;page.sectionPages=group.pages.length;page.sectionLabel=`${page.section} ${group.number}${group.pages.length>1?`-${i+1}`:''}`;});
  }
  return songs;
}
export function sectionTarget(items,index,key){
  const item=items[index];if(!item?.song)return null;
  const targets=items.map((page,i)=>({page,i})).filter(({page})=>page.song?.instance===item.song.instance && page.song.sectionStart && page.song.sectionKey===key.toUpperCase()).map(({i})=>i);
  return targets.find(i=>i>index) ?? targets[0] ?? null;
}
