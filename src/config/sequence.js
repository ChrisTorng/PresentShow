import {normalizeTransition} from './transitions.js';
export function expandSequence(config,songs,backgrounds,defaultBackground){
  const items=[],sections=[];
  let currentBackground=defaultBackground,currentTransition=normalizeTransition(config.transition);
  const change=(bg,transition)=>{
    if(bg && bg!=='keep'){if(typeof bg!=='string' || !Object.hasOwn(backgrounds,bg))throw new Error(`找不到背景：${bg}`);currentBackground=bg;}
    currentTransition=normalizeTransition(transition,currentTransition);
  };
  const definitions=config.sections || [{id:'all',title:'播放流程',sequence:config.sequence,bookends:false}];
  if(!Array.isArray(definitions) || !definitions.length)throw new Error('sections 必須是非空陣列。');
  const ids=new Set();
  definitions.forEach((section,sectionIndex)=>{
    const id=section.id || `section-${sectionIndex+1}`,title=section.title || id;
    if(ids.has(id))throw new Error(`項目 ID 重複：${id}`);ids.add(id);
    if(!Array.isArray(section.sequence) || !section.sequence.length)throw new Error(`項目 ${title} 需要非空的 sequence。`);
    const meta={id,title,index:sectionIndex,start:items.length};
    const push=(page,origin)=>{change(page.background,page.transition);items.push({...page,background:currentBackground,transition:{...currentTransition},section:{id,title,index:sectionIndex},origin:{section:config.sections?sectionIndex:null,...origin}});};
    const firstRef=section.sequence[0],firstPage=firstRef?.pages?.[0] ?? firstRef;
    const firstDefinition=config.pages?.[typeof firstPage==='string'?firstPage:firstPage?.page];
    change(section.startBackground ?? firstPage?.background ?? firstRef?.background ?? firstDefinition?.background ?? section.background,firstPage?.transition ?? firstRef?.transition ?? firstDefinition?.transition ?? section.transition);
    const bookends=section.bookends ?? config.bookends ?? !!config.sections;
    const boundary=edge=>push({id:`${id}-${edge}`,type:'blank',label:'',seconds:0,media:'stop'},{kind:'boundary',edge,sequence:-1,sub:null});
    if(bookends && firstDefinition?.type!=='blank' && !(items.at(-1)?.type==='blank' && items.at(-1)?.background===currentBackground))boundary('start');
    const add=(ref,sequenceIndex,sub=null,group,seconds)=>{
      const pageId=typeof ref==='string'?ref:ref?.page,page=config.pages?.[pageId];
      if(!page)throw new Error(`找不到頁面：${pageId}`);
      if(!['blank','text','image','media'].includes(page.type))throw new Error(`${pageId}：type 必須為 blank、text、image 或 media。`);
      if(page.layout==='roster' && (!Array.isArray(page.columns)||page.columns.some(c=>!Array.isArray(c.rows))))throw new Error(`${pageId}：服事表 columns 需要 rows。`);
      if(page.blocks && (!Array.isArray(page.blocks) || page.blocks.some(b=>!['eyebrow','title','subtitle','text','quote','account','caption','lyrics'].includes(b.kind) || typeof b.text!=='string')))throw new Error(`${pageId}：blocks 需指定有效的 kind 與文字 text。`);
      if(page.type==='image' && !page.src)throw new Error(`${pageId}：圖片需要 src。`);
      if(page.fit && !['contain','original'].includes(page.fit))throw new Error(`${pageId}：fit 請使用 contain 或 original。`);
      const duration=(typeof ref==='object'?ref.seconds:undefined) ?? seconds ?? page.seconds ?? 0;
      if(!Number.isFinite(duration) || duration<0)throw new Error(`${pageId}：seconds 必須是大於等於 0 的數字。`);
      push({...page,id:pageId,group,seconds:duration,label:page.type==='blank'?'':page.label||pageId,background:ref?.background??page.background,transition:ref?.transition??page.transition},{sequence:sequenceIndex,kind:sub===null?'page':'group',sub});
    };
    section.sequence.forEach((entry,sequenceIndex)=>{
      if(entry && typeof entry==='object' && Object.hasOwn(entry,'song')){
        const song=songs.find(s=>s.id===entry.song || s.title===entry.song);
        if(!song)throw new Error(`找不到歌曲：${entry.song}`);
        for(const field of ['backgroundAt','transitionAt'])for(const page of Object.keys(entry[field]||{}))if(!/^\d+$/.test(page) || Number(page)<1 || Number(page)>song.pages.length)throw new Error(`${song.title}：${field} 頁碼超出歌曲範圍。`);
        const metadata=config.songMeta?.[song.id]||{};
        const songInfo={id:song.id,title:song.title,instance:`${sectionIndex}:${sequenceIndex}`};
        const titlePage=(entry.titlePage??config.songTitlePage)!==false;
        if(titlePage)push({id:`song-${song.id}-title`,type:'text',layout:'song-title',label:metadata.title||song.title,
          blocks:[{kind:'title',text:metadata.title||song.title},{kind:'subtitle',text:metadata.english||''}],credit:metadata.credit||'',song:{...songInfo,titlePage:true},
          seconds:0,media:entry.media,background:entry.background,transition:entry.transition},
          {sequence:sequenceIndex,kind:'song-title',sub:null});
        const lyricLines=song.pages.flatMap(p=>p.text.split('\n'));
        song.pages.forEach((page,i)=>push({
          id:`song-${song.id}-${i+1}`,type:'text',label:`${song.title} · ${page.sectionLabel}`,blocks:[{kind:'lyrics',text:page.text}],seconds:0,
          lyricLines,lyricMaxLines:Math.max(...song.pages.map(p=>p.text.split('\n').length)),lyricStyle:entry.lyricStyle??metadata.lyricStyle??'panel',media:i===0 && !titlePage?entry.media:'keep',background:entry.backgroundAt?.[i+1] ?? (i===0?entry.background:undefined),transition:entry.transitionAt?.[i+1] ?? (i===0?entry.transition:undefined),
          song:{...page,text:undefined,id:song.id,title:song.title,instance:`${sectionIndex}:${sequenceIndex}`,page:i+1}
        },{sequence:sequenceIndex,kind:'song',sub:i}));
      }else if(entry && typeof entry==='object' && typeof entry.text==='string'){
        const paragraphs=entry.text.trim().split(/\n\s*\n/).filter(p=>p.trim());
        if(!paragraphs.length)throw new Error('文字項目不可為空。');
        paragraphs.forEach((text,i)=>push({id:`text-${sectionIndex}-${sequenceIndex}-${i}`,type:'text',layout:'reading',label:`${entry.title||section.title} · ${i+1}/${paragraphs.length}`,
          blocks:[{kind:'text',text:text.trim()}],readingTitle:entry.title||section.title,pagination:`${i+1}/${paragraphs.length}`,seconds:0,
          background:entry.backgroundAt?.[i+1]??(i===0?entry.background:undefined),transition:entry.transitionAt?.[i+1]??(i===0?entry.transition:undefined)},
          {sequence:sequenceIndex,kind:'reading',sub:i}));
      }else if(entry && typeof entry==='object' && entry.pages){
        if(!Array.isArray(entry.pages) || !entry.pages.length)throw new Error('輪播 pages 不可為空。');
        change(entry.background,entry.transition);const start=items.length;
        entry.pages.forEach((ref,sub)=>add(ref,sequenceIndex,sub,entry.label||'輪播',entry.seconds??10));
        for(let i=start;i<items.length;i++){items[i].autoStart=entry.autoStart!==false;items[i].autoNext=i<items.length-1?i+1:entry.loop?start:entry.continue?i+1:null;}
      }else add(entry,sequenceIndex);
    });
    change(section.endBackground,section.endTransition);
    if(bookends && (items.at(-1)?.type!=='blank' || items.at(-1)?.background!==currentBackground))boundary('end');
    meta.end=items.length-1;
    const songItems=items.slice(meta.start,meta.end+1).filter(p=>p.song);
    if(songItems.length){
      for(const [boundary,nearest] of [[items[meta.start],songItems[0]],[items[meta.end],songItems.at(-1)]])if(boundary.type==='blank')boundary.song={id:nearest.song.id,title:nearest.song.title,instance:nearest.song.instance,boundary:true};
    }
    sections.push(meta);
  });
  return {items,sections};
}
