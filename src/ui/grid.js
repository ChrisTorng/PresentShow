import {ForegroundManager} from '../player/foreground.js';
import {youtubeId} from '../config/model.js';
import {repeatRatio} from '../config/repeats.js';
export function thumbnailLabel(item,iteration=1){
 const song=item.song;
 if(!song||song.boundary)return item.type==='blank'?'':item.label;
 if(song.titlePage)return '前奏';
 const name=song.utility||song.sectionName||song.sectionLabel?.split(/\s*·\s*/)[0]||'';
 return name+(song.utility?'':` · ${repeatRatio(song.repeat,iteration)}`);
}
export function refreshThumbnailRepeats(container,show,getIteration){
 for(const card of container.querySelectorAll('.slide-card[data-loop]')){
  const at=Number(card.dataset.index),label=card.querySelector('.card-title');
  const text=thumbnailLabel(show.items[at],getIteration(at));if(label.textContent!==text)label.textContent=text;
 }
}
let renderers=[],observer;
export function renderOutline(container,show,onSelect){
  container.replaceChildren();
  for(const section of show.sections){
    const button=document.createElement('button');button.className='outline-item';button.dataset.section=section.index;
    const name=document.createElement('span');name.textContent=section.title;
    const count=document.createElement('small');count.textContent=String(section.end-section.start+1);button.append(name,count);
    button.onclick=()=>onSelect(section.start,section.index);container.append(button);
  }
}
export function renderGrid({container,show,asset,onSelect,onReorder,onEdit}){
  renderers.forEach(r=>r.destroy());renderers=[];observer?.disconnect();
  observer=new ResizeObserver(entries=>{for(const entry of entries){entry.target.firstElementChild.style.transform=`scale(${entry.contentRect.width/1600})`;}});
  container.replaceChildren();let dragging=null;
  for(const section of show.sections){
    const group=document.createElement('section');group.className='sequence-section';group.id=`section-${section.index}`;
    const heading=document.createElement('h3');heading.className='sequence-section-title';
    const title=document.createElement('span');title.textContent=section.title;const count=document.createElement('small');count.textContent=`${section.end-section.start+1} 頁`;heading.append(title,count);
    const grid=document.createElement('div');grid.className='slide-grid';
    for(let i=section.start;i<=section.end;i++){
      const item=show.items[i],card=document.createElement('div');card.className='slide-card';card.dataset.index=i;card.draggable=['song','song-utility','page','group'].includes(item.origin.kind);card.tabIndex=0;card.setAttribute('role','button');card.title=`${i+1}. ${item.label}`;card.setAttribute('aria-label',card.title);
      const thumb=document.createElement('div');thumb.className='faithful-thumb';
      const stage=document.createElement('div');stage.className='thumbnail-stage slide-surface';
      stage.style.background=`linear-gradient(130deg,${item.background.colors[0]},${item.background.colors[1]})`;
      const source=item.background.poster||(item.background.type==='image'?item.background.src:null);
      if(source){const image=document.createElement('img');image.className='thumbnail-background';try{image.src=asset(source);}catch{}image.alt='';stage.append(image);}
      const host=document.createElement('div');host.className='foreground-host';stage.append(host);thumb.append(stage);
      const display=structuredClone(item);display.transition={type:'none',duration:0};
      if(display.src)try{display.src=asset(display.src);}catch{}
      if(display.qr)try{display.qr=typeof display.qr==='string'?asset(display.qr):{...display.qr,src:asset(display.qr.src)};}catch{}
      if(display.track?.kind==='youtube')display.track.poster=`https://i.ytimg.com/vi/${youtubeId(display.track.src)}/hqdefault.jpg`;
      const renderer=new ForegroundManager(host,()=>{});renderer.render(display,false,true);renderers.push(renderer);observer.observe(thumb);
      const meta=document.createElement('div');meta.className='card-meta';
      const label=document.createElement('span');label.className='card-title';label.textContent=thumbnailLabel(item);
      if(item.loopGroup)card.dataset.loop=item.loopGroup;
      const badge=document.createElement('span');badge.className='card-badge';badge.textContent=item.seconds?`${item.seconds}s`:item.song?(item.song.sectionStart?item.song.sectionKey||'':''):item.track?.loop?'↻':'';
      meta.append(label,badge);card.append(thumb,meta);
      if(item.song){
        const kind=item.song.utility||item.song.titlePage||item.song.boundary?'instrumental':item.song.sectionKey==='C'?'chorus':item.song.sectionKey==='P'?'prechorus':['T','B'].includes(item.song.sectionKey)?'tag':'verse';
        card.dataset.lyricKind=kind;
        label.classList.add('song-part-label');
      }
      if(item.origin.kind==='song'){
        const menu=document.createElement('details');menu.className='card-menu';menu.draggable=false;
        const trigger=document.createElement('summary');trigger.textContent='⋯';trigger.title='頁面編排操作';menu.append(trigger);
        const actions=document.createElement('div');actions.className='card-menu-actions';menu.append(actions);
        for(const [action,text] of [['copy','複製此頁'],['up','向前移動'],['down','向後移動'],['delete','刪除此頁']]){
          const button=document.createElement('button');button.type='button';button.textContent=text;
          button.onclick=e=>{e.preventDefault();e.stopPropagation();menu.open=false;onEdit(i,action);};
          actions.append(button);
        }
        menu.onclick=e=>e.stopPropagation();menu.ondragstart=e=>e.preventDefault();
        meta.append(menu);
      }
      if(item.song?.sectionPages){const page=document.createElement('span');page.className='card-page';page.textContent=`${item.song.sectionPage}/${item.song.sectionPages}`;meta.append(page);}
      if(item.group){const tag=document.createElement('span');tag.className='group-label';tag.textContent=`↻ ${item.group}`;card.append(tag);}
      card.onclick=()=>onSelect(i);card.onkeydown=e=>{if(e.target===card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();onSelect(i);}};
      card.ondragstart=e=>{dragging=i;e.dataTransfer.effectAllowed='copyMove';e.dataTransfer.setData('text/plain',String(i));};
      card.ondragover=e=>{if(dragging!==null){e.preventDefault();e.dataTransfer.dropEffect=e.ctrlKey?'copy':'move';card.classList.add('drag-over');}};card.ondragleave=()=>card.classList.remove('drag-over');
      card.ondragend=()=>{dragging=null;container.querySelectorAll('.drag-over').forEach(c=>c.classList.remove('drag-over'));};
      card.ondrop=e=>{e.preventDefault();card.classList.remove('drag-over');if(dragging!==null && (dragging!==i||e.ctrlKey))onReorder(dragging,i,e.ctrlKey?'copy':'move');dragging=null;};grid.append(card);
    }
    group.append(heading,grid);container.append(group);
  }
}
