import {readingRows} from '../config/text.js';
export class ForegroundManager {
  constructor(host,onError){this.host=host;this.onError=onError;this.current=null;this.exiting=new Set();this.key='';this.observer=new ResizeObserver(()=>this.fit());this.observer.observe(host);}
  fit(){
    const scene=this.current,content=scene?.querySelector('.slide-content');if(!content)return;
    content.style.setProperty('--fit',1);
    if(scene.classList.contains('lyrics-slide')){
      const block=content.querySelector('.lyrics');let size=Math.min(scene.clientWidth*.12,scene.clientHeight*.46/(1.35*this.lyricMaxLines));block.style.fontSize=`${size}px`;
      const ctx=document.createElement('canvas').getContext('2d');
      const measure=()=>{const style=getComputedStyle(block);ctx.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;const spacing=parseFloat(style.letterSpacing)||0;return Math.max(...this.lyricLines.map(line=>ctx.measureText(line).width+Math.max(0,Array.from(line).length-1)*spacing));};
      let width=measure();size=Math.min(size, size*scene.clientWidth*.85/width);block.style.fontSize=`${size}px`;width=measure();
      content.style.width=`${scene.clientWidth*.9}px`;
    }
    if(scene.classList.contains('reading-slide')){
      const block=content.querySelector('.block');let low=1,high=scene.clientWidth*.035;
      for(let i=0;i<14;i++){const size=(low+high)/2;block.style.fontSize=`${size}px`;if(block.scrollHeight<=content.clientHeight-parseFloat(getComputedStyle(content).paddingTop)-parseFloat(getComputedStyle(content).paddingBottom) && block.scrollWidth<=content.clientWidth+1)low=size;else high=size;}
      block.style.fontSize=`${low}px`;return;
    }
    const height=scene.clientHeight*(scene.classList.contains('lyrics-slide')?.52:.86);
    content.style.setProperty('--fit',Math.min(1,height/content.scrollHeight));
  }
  destroy(){this.observer.disconnect();for(const scene of this.host.children)scene.getAnimations({subtree:true}).forEach(a=>a.cancel());this.host.replaceChildren();}
  render(item,active,cue=false){
    const placeholder=!active && item.type==='media' && item.track?.kind!=='audio';
    const key=JSON.stringify([item.id,item.type,item.blocks,item.src,item.align,item.layout,item.credit,item.lyricStyle,item.lyricLines,item.pagination,item.heading,item.readingTitle,item.columns,item.qr,item.track?.label,item.track?.poster,placeholder]);
    if(key===this.key)return;this.key=key;this.onError('');
    for(const old of this.exiting){old.getAnimations().forEach(a=>a.cancel());old.remove();}this.exiting.clear();
    const previous=this.current,scene=document.createElement('div');scene.className='foreground';
    if(item.type==='image'){
      scene.classList.add('image-slide');const image=document.createElement('img');image.src=item.src;image.alt=item.alt||'';image.className=item.fit==='original'?'original':'contain';
      image.onload=()=>{if(this.current===scene)this.onError('');};image.onerror=()=>{if(this.current===scene)this.onError('圖片無法載入，請檢查路徑或選取素材資料夾。');};scene.append(image);
    }else if(item.layout==='roster'){
      scene.classList.add('roster-slide');const heading=document.createElement('h1');heading.textContent=item.heading;scene.append(heading);
      const columns=document.createElement('div');columns.className='roster-columns';
      const maxRows=Math.max(...item.columns.map(c=>c.rows.length));columns.style.setProperty('--roster-rows',maxRows);
      for(const column of item.columns){const panel=document.createElement('section');panel.className='roster-column';
        for(let i=0;i<column.rows.length;i++){const row=column.rows[i],entry=document.createElement('div');entry.className='roster-row';entry.style.gridRow=String(i+1);entry.style.gridColumn='2';
          if(row.group){entry.classList.add('roster-group-row');if(i===0||column.rows[i-1].group!==row.group){let count=1;while(column.rows[i+count]?.group===row.group)count++;const label=document.createElement('div');label.className='roster-group-label';label.style.gridRow=`${i+1} / span ${count}`;for(const char of row.group){const letter=document.createElement('span');letter.textContent=char;label.append(letter);}panel.append(label);}}
          const role=document.createElement('span');role.textContent=row.role;const name=document.createElement('strong');name.textContent=row.name;entry.append(role,name);panel.append(entry);
        }columns.append(panel);
      }scene.append(columns);
    }else if(item.type==='text' || placeholder || item.blocks?.length){
      const content=document.createElement('div');content.className=`slide-content ${item.align==='left'?'align-left':''}`;
      if(item.blocks?.some(b=>b.kind==='lyrics')){scene.classList.add('lyrics-slide');this.lyricMaxLines=item.lyricMaxLines||2;this.lyricLines=item.lyricLines||item.blocks.flatMap(b=>b.text.split('\n'));if(item.lyricStyle==='shadow')scene.classList.add('lyrics-shadow');}
      if(item.layout==='song-title')scene.classList.add('song-title-slide');
      if(item.layout==='reading')scene.classList.add('reading-slide');
      const blocks=placeholder?[{kind:'eyebrow',text:item.section?.title||''},{kind:'title',text:item.track?.label||item.label}]:item.blocks||[];
      if(placeholder && item.track?.poster){const cover=document.createElement('img');cover.src=item.track.poster;cover.className='media-cover';cover.alt='';scene.append(cover);scene.classList.add('media-card-slide');}
      for(const block of blocks){const node=document.createElement(item.layout==='reading'?'div':'p');node.className=`block ${block.kind||'text'}`;if(item.layout==='reading'){node.classList.add('reading-list');for(const row of readingRows(block.text)){const line=document.createElement('div');line.className='reading-row';const number=document.createElement('span');number.className='reading-number';number.textContent=row.number;const text=document.createElement('span');text.className='reading-copy';text.textContent=row.text;line.append(number,text);node.append(line);}}else if(item.layout==='song-title'&&block.kind==='subtitle'){for(const word of block.text.split(/(\s+)/)){const span=document.createElement('span');span.className='small-cap-word';const first=document.createElement('b');first.textContent=word.slice(0,1).toUpperCase();span.append(first,document.createTextNode(word.slice(1).toUpperCase()));node.append(span);}}else node.textContent=block.text;content.append(node);}scene.append(content);
      if(item.credit){const credit=document.createElement('div');credit.className='song-credit';credit.textContent=item.credit;scene.append(credit);}
      if(item.pagination){const counter=document.createElement('div');counter.className='page-counter';counter.textContent=item.pagination;scene.append(counter);}
      if(item.readingTitle){const title=document.createElement('div');title.className='reading-title';title.textContent=item.readingTitle;scene.append(title);}
    }
    if(item.qr){scene.classList.add('has-qr');const qr=document.createElement('img');qr.className='slide-qr';const qrSize=typeof item.qr==='object'?Number(item.qr.size)||13:13;scene.style.setProperty('--qr-size',`${Math.max(8,Math.min(30,qrSize))}%`);qr.src=typeof item.qr==='string'?item.qr:item.qr.src;qr.alt='QR code';scene.append(qr);}
    this.host.append(scene);this.current=scene;this.fit();requestAnimationFrame(()=>this.fit());
    const duration=item.transition.type==='none'?0:item.transition.duration*1000;
    this.host.dataset.transition=String(item.transition.duration);this.host.dataset.page=item.id;
    if(!duration){previous?.remove();return;}
    scene.animate([{opacity:0},{opacity:1}],{duration,easing:'ease-in-out'});
    if(previous){
      const opacity=getComputedStyle(previous).opacity;previous.getAnimations().forEach(a=>a.cancel());this.exiting.add(previous);
      previous.animate([{opacity},{opacity:0}],{duration,easing:'ease-in-out'}).onfinish=()=>{previous.remove();this.exiting.delete(previous);};
    }
  }
}
