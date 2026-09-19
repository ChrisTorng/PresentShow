export function renderOutline(container,show,onSelect){
  container.replaceChildren();
  for(const section of show.sections){
    const button=document.createElement('button');button.className='outline-item';button.dataset.section=section.index;
    const name=document.createElement('span');name.textContent=section.title;
    const count=document.createElement('small');count.textContent=String(section.end-section.start+1);button.append(name,count);
    button.onclick=()=>onSelect(section.start,section.index);container.append(button);
  }
}
export function renderGrid({container,show,asset,onSelect,onReorder}){
  container.replaceChildren();let dragging=null;
  for(const section of show.sections){
    const group=document.createElement('section');group.className='sequence-section';group.id=`section-${section.index}`;
    const heading=document.createElement('h3');heading.className='sequence-section-title';
    const title=document.createElement('span');title.textContent=section.title;const count=document.createElement('small');count.textContent=`${section.end-section.start+1} 頁`;heading.append(title,count);
    const grid=document.createElement('div');grid.className='slide-grid';
    for(let i=section.start;i<=section.end;i++){
      const item=show.items[i],card=document.createElement('button');card.className='slide-card';card.dataset.index=i;card.draggable=!['song','song-title','reading','boundary'].includes(item.origin.kind);card.title=`${i+1}. ${item.label}`;card.setAttribute('aria-label',card.title);
      const thumb=document.createElement('div');thumb.className=`thumbnail ${item.type==='media'?'media-thumb':''} ${item.song&&!item.song.titlePage?'lyric-thumb':''} ${item.lyricStyle==='shadow'?'shadow-thumb':''}`;
      if(item.type!=='media'){
        thumb.style.background=`linear-gradient(130deg,${item.background.colors[0]},${item.background.colors[1]})`;
        const source=item.background.poster || (item.background.type==='image'?item.background.src:null);
        if(source){const image=document.createElement('img');image.className='thumb-background';try{image.src=asset(source);}catch{}image.alt='';thumb.append(image);}
      }
      if(item.type==='image'){
        const image=document.createElement('img');try{image.src=asset(item.src);}catch{}image.alt=item.alt||item.label;image.className='thumb-foreground';thumb.append(image);
      }else if(item.type==='media'){
        const symbol=document.createElement('span');symbol.className='thumb-media';symbol.textContent=item.track?.kind==='audio'?'♫':'▶';thumb.append(symbol);
        const text=document.createElement('small');text.textContent=item.track?.label || item.label;thumb.append(text);
      }else if(item.type==='text'){
        const blocks=item.blocks||[],title=blocks.find(b=>['title','quote','account','lyrics'].includes(b.kind))||blocks[0];
        const copy=document.createElement('div');copy.className='thumb-copy';if(item.lyricLines)copy.style.width=`min(94%, ${Math.max(...item.lyricLines.map(line=>Array.from(line).length))*.85+.8}vw)`;const main=document.createElement('strong');main.textContent=title?.text||'';copy.append(main);
        const secondary=blocks.find(b=>b!==title);if(secondary){const small=document.createElement('small');small.textContent=secondary.text;copy.append(small);}thumb.append(copy);
      }
      const meta=document.createElement('div');meta.className='card-meta';
      const n=document.createElement('span');n.className='card-index';n.textContent=String(i+1).padStart(2,'0');
      const label=document.createElement('span');label.className='card-title';label.textContent=item.type==='blank'?'':item.song?.titlePage?'標題':item.song?item.song.sectionLabel:item.label;
      const badge=document.createElement('span');badge.className='card-badge';badge.textContent=item.seconds?`${item.seconds}s`:item.song?(item.song.sectionStart?item.song.sectionKey||'':''):item.track?.loop?'↻':'';
      meta.append(n,label,badge);card.append(thumb,meta);
      if(item.group){const tag=document.createElement('span');tag.className='group-label';tag.textContent=`↻ ${item.group}`;card.append(tag);}
      card.onclick=()=>onSelect(i);
      card.ondragstart=e=>{dragging=i;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(i));};
      card.ondragover=e=>{if(dragging!==null){e.preventDefault();card.classList.add('drag-over');}};card.ondragleave=()=>card.classList.remove('drag-over');
      card.ondragend=()=>{dragging=null;container.querySelectorAll('.drag-over').forEach(c=>c.classList.remove('drag-over'));};
      card.ondrop=e=>{e.preventDefault();card.classList.remove('drag-over');if(dragging!==null && dragging!==i)onReorder(dragging,i);dragging=null;};grid.append(card);
    }
    group.append(heading,grid);container.append(group);
  }
}
