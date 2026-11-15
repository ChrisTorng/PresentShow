import {readingRows} from '../config/text.js';
export class ForegroundManager {
  constructor(host,onError){this.host=host;this.onError=onError;this.current=null;this.exiting=new Set();this.key='';this.observer=new ResizeObserver(()=>this.fit());this.observer.observe(host);}
  fit(){
    const scene=this.current;
    for(const field of scene?.querySelectorAll('.roster-with-topic .roster-row > *, .roster-topic')??[]){
      if(!field.clientWidth)continue;
      field.style.removeProperty('font-size');
      if(field.scrollWidth>field.clientWidth){
        let low=0,high=parseFloat(getComputedStyle(field).fontSize);
        for(let i=0;i<12;i++){
          const size=(low+high)/2;
          field.style.fontSize=`${size}px`;
          if(field.scrollWidth>field.clientWidth)high=size;else low=size;
        }
        field.style.fontSize=`${low}px`;
      }
    }
    const content=scene?.querySelector('.slide-content');if(!content)return;
    content.style.setProperty('--fit',1);
    if(scene.classList.contains('lyrics-slide')){
      const block=content.querySelector('.lyrics');let size=Math.min(scene.clientWidth*.12,scene.clientHeight*.46/(1.35*this.lyricMaxLines));block.style.fontSize=`${size}px`;
      const ctx=document.createElement('canvas').getContext('2d');
      const measure=()=>{const style=getComputedStyle(block);ctx.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;const spacing=parseFloat(style.letterSpacing)||0;return Math.max(...this.lyricLines.map(line=>ctx.measureText(line).width+Math.max(0,Array.from(line).length-1)*spacing));};
      let width=measure();size=Math.min(size, size*scene.clientWidth*.85/width);block.style.fontSize=`${size}px`;width=measure();
      content.style.width=`${scene.clientWidth*.9}px`;
    }
    if(scene.classList.contains('reading-slide')){
      const block=content.querySelector('.block');
      const {paddingTop,paddingBottom}=getComputedStyle(content);
      const availableHeight=content.clientHeight-parseFloat(paddingTop)-parseFloat(paddingBottom);
      const fits=size=>{
        block.style.fontSize=`${size}px`;
        return block.scrollHeight<=availableHeight && block.scrollWidth<=block.clientWidth+1;
      };
      const scale=scene.clientWidth/100;
      let low=Math.max(1,(this.readingFont?.min??0)*scale);
      let high=(this.readingFont?.max??3.5)*scale;
      // A new page exceeding the calibrated minimum must still fit without clipping.
      if(!fits(low))low=1;
      if(fits(high))return;
      for(let i=0;i<14;i++){
        const size=(low+high)/2;
        if(fits(size))low=size;else high=size;
      }
      block.style.fontSize=`${low}px`;return;
    }
    const height=scene.clientHeight*(scene.classList.contains('lyrics-slide')?.52:.86);
    content.style.setProperty('--fit',Math.min(1,height/content.scrollHeight));
  }
  destroy(){this.observer.disconnect();for(const scene of this.host.children)scene.getAnimations({subtree:true}).forEach(a=>a.cancel());this.host.replaceChildren();}
  render(item,active,cue=false){
    const placeholder=!active && item.type==='media' && item.track?.kind!=='audio';
    const key=JSON.stringify([item.id,item.type,item.blocks,item.src,item.align,item.layout,item.credit,item.lyricStyle,item.lyricLines,item.pagination,item.heading,item.readingTitle,item.readingFont,item.columns,item.topic,item.qr,item.track?.label,item.track?.poster,placeholder]);
    if(key===this.key)return;this.key=key;this.onError('');
    for(const old of this.exiting){old.getAnimations().forEach(a=>a.cancel());old.remove();}this.exiting.clear();
    const previous=this.current,scene=document.createElement('div');scene.className='foreground';
    if(item.type==='image'){
      scene.classList.add('image-slide');const image=document.createElement('img');image.src=item.src;image.alt=item.alt||'';image.className=item.fit==='original'?'original':'contain';
      image.onload=()=>{if(this.current===scene)this.onError('');};image.onerror=()=>{if(this.current===scene)this.onError('圖片無法載入，請檢查路徑或選取素材資料夾。');};scene.append(image);
    }else if(item.type==='web'){
      scene.classList.add('web-placeholder');if(!active){const title=document.createElement('h1');title.textContent=item.label||'報告網頁';const hint=document.createElement('p');hint.textContent='請在投影視窗操作網頁';scene.append(title,hint);}
    }else if(item.layout==='roster'){
      scene.classList.add('roster-slide');const heading=document.createElement('h1');heading.textContent=item.heading;scene.append(heading);
      const columns=document.createElement('div');columns.className='roster-columns';
      const hasTopic=typeof item.topic==='string';
      if(hasTopic)scene.classList.add('roster-with-topic');
      const rosterColumns=hasTopic?[item.columns[0]??{rows:[]},item.columns[1]??{rows:[]},...item.columns.slice(2)]:item.columns;
      const maxRows=Math.max(1,...rosterColumns.map((column,index)=>column.rows.length+(hasTopic&&index===1?2:0)));
      columns.style.setProperty('--roster-rows',maxRows);
      for(const [index,column] of rosterColumns.entries()){
        const panel=document.createElement('section');panel.className='roster-column';
        const topicColumn=hasTopic&&index===1;
        const firstRow=topicColumn?3:1;
        if(topicColumn&&item.topic.trim()){
          const topic=document.createElement('strong');
          topic.className='roster-topic';topic.textContent=item.topic;panel.append(topic);
        }
        for(let i=0;i<column.rows.length;i++){const row=column.rows[i],entry=document.createElement('div');entry.className='roster-row';entry.style.gridRow=String(firstRow+i);
          if(row.group){entry.classList.add('roster-group-row');if(column.rows[i+1]?.group===row.group)entry.classList.add('roster-group-inner');if(i===0||column.rows[i-1].group!==row.group){let count=1;while(column.rows[i+count]?.group===row.group)count++;const label=document.createElement('div');label.className='roster-group-label';label.style.gridRow=`${firstRow+i} / span ${count}`;for(const char of row.group){const letter=document.createElement('span');letter.textContent=char;label.append(letter);}panel.append(label);}}
          const role=document.createElement('span');role.textContent=row.role;const name=document.createElement('strong');name.textContent=row.name;entry.append(role,name);panel.append(entry);
        }columns.append(panel);
      }scene.append(columns);
    }else if(item.type==='text' || placeholder || item.blocks?.length){
      const content=document.createElement('div');content.className=`slide-content ${item.align==='left'?'align-left':''}`;
      if(item.blocks?.some(b=>b.kind==='lyrics')){scene.classList.add('lyrics-slide');this.lyricMaxLines=item.lyricMaxLines||2;this.lyricLines=item.lyricLines||item.blocks.flatMap(b=>b.text.split('\n'));if(item.lyricStyle==='shadow')scene.classList.add('lyrics-shadow');}
      if(item.layout==='song-title')scene.classList.add('song-title-slide');
      if(item.layout==='reading'){
        scene.classList.add('reading-slide');
        this.readingFont=item.readingFont;
        if(item.readingFont)scene.classList.add('reading-screen-fit');
      }
      const blocks=placeholder?[{kind:'eyebrow',text:item.section?.title||''},{kind:'title',text:item.track?.label||item.label}]:item.blocks||[];
      if(placeholder && item.track?.poster){const cover=document.createElement('img');cover.src=item.track.poster;cover.className='media-cover';cover.alt='';scene.append(cover);scene.classList.add('media-card-slide');}
      for(const block of blocks){const node=document.createElement(item.layout==='reading'?'div':'p');node.className=`block ${block.kind||'text'}`;if(item.layout==='reading'){node.classList.add('reading-list');for(const row of readingRows(block.text)){const line=document.createElement('div');line.className='reading-row';const number=document.createElement('span');number.className='reading-number';number.textContent=row.number;const text=document.createElement('span');text.className='reading-copy';text.textContent=row.text;line.append(number,text);node.append(line);}}else if(item.layout==='song-title'&&block.kind==='subtitle'){for(const word of block.text.split(/(\s+)/)){const span=document.createElement('span');span.className='small-cap-word';const first=document.createElement('b');first.textContent=word.slice(0,1).toUpperCase();span.append(first,document.createTextNode(word.slice(1).toUpperCase()));node.append(span);}}else node.textContent=block.text;content.append(node);}scene.append(content);
      if(item.credit){const credit=document.createElement('div');credit.className='song-credit';credit.textContent=item.credit;scene.append(credit);}
      if(item.pagination && !item.readingFont){const counter=document.createElement('div');counter.className='page-counter';counter.textContent=item.pagination;scene.append(counter);}
      if(item.readingTitle){const title=document.createElement('div');title.className='reading-title';title.textContent=item.readingFont && item.pagination?item.readingTitle+" "+item.pagination:item.readingTitle;scene.append(title);}
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
