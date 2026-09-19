export class ForegroundManager {
  constructor(host,onError){this.host=host;this.onError=onError;this.current=null;this.exiting=new Set();this.key='';this.observer=new ResizeObserver(()=>this.fit());this.observer.observe(host);}
  fit(){
    const scene=this.current,content=scene?.querySelector('.slide-content');if(!content)return;
    content.style.setProperty('--fit',1);
    if(scene.classList.contains('lyrics-slide')){
      const block=content.querySelector('.lyrics');let size=Math.min(scene.clientWidth*.064,scene.clientHeight*.43/(1.65*this.lyricMaxLines));block.style.fontSize=`${size}px`;
      const ctx=document.createElement('canvas').getContext('2d');
      const measure=()=>{const style=getComputedStyle(block);ctx.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;const spacing=parseFloat(style.letterSpacing)||0;return Math.max(...this.lyricLines.map(line=>ctx.measureText(line).width+Math.max(0,Array.from(line).length-1)*spacing));};
      let width=measure();if(width>scene.clientWidth*.86){size*=scene.clientWidth*.86/width;block.style.fontSize=`${size}px`;width=measure();}
      content.style.width=`${Math.min(scene.clientWidth*.92,width+scene.clientWidth*.05)}px`;
    }
    if(scene.classList.contains('reading-slide')){
      const block=content.querySelector('.block');let low=1,high=scene.clientWidth*.09;
      for(let i=0;i<14;i++){const size=(low+high)/2;block.style.fontSize=`${size}px`;if(block.scrollHeight<=content.clientHeight-parseFloat(getComputedStyle(content).paddingTop)-parseFloat(getComputedStyle(content).paddingBottom) && block.scrollWidth<=content.clientWidth+1)low=size;else high=size;}
      block.style.fontSize=`${low}px`;return;
    }
    const height=scene.clientHeight*(scene.classList.contains('lyrics-slide')?.52:.86);
    content.style.setProperty('--fit',Math.min(1,height/content.scrollHeight));
  }
  render(item,active,cue=false){
    const placeholder=!active && item.type==='media' && item.track?.kind!=='audio';
    const key=JSON.stringify([item.id,item.type,item.blocks,item.src,item.align,item.layout,item.credit,item.lyricStyle,item.lyricLines,item.pagination,placeholder]);
    if(key===this.key)return;this.key=key;
    for(const old of this.exiting){old.getAnimations().forEach(a=>a.cancel());old.remove();}this.exiting.clear();
    const previous=this.current,scene=document.createElement('div');scene.className='foreground';
    if(item.type==='image'){
      scene.classList.add('image-slide');const image=document.createElement('img');image.src=item.src;image.alt=item.alt||'';image.className=item.fit==='original'?'original':'contain';
      image.onerror=()=>{if(this.current===scene)this.onError('圖片無法載入，請檢查路徑或選取素材資料夾。');};scene.append(image);
    }else if(item.type==='text' || placeholder){
      const content=document.createElement('div');content.className=`slide-content ${item.align==='left'?'align-left':''}`;
      if(item.blocks?.some(b=>b.kind==='lyrics')){scene.classList.add('lyrics-slide');this.lyricMaxLines=item.lyricMaxLines||2;this.lyricLines=item.lyricLines||item.blocks.flatMap(b=>b.text.split('\n'));if(item.lyricStyle==='shadow')scene.classList.add('lyrics-shadow');}
      if(item.layout==='song-title')scene.classList.add('song-title-slide');
      if(item.layout==='reading')scene.classList.add('reading-slide');
      const blocks=placeholder?[{kind:'subtitle',text:`▶ ${item.label}\n${cue?'待播媒體':'正在投影視窗播放'}`}]:item.blocks||[];
      for(const block of blocks){const node=document.createElement('p');node.className=`block ${block.kind||'text'}`;node.textContent=block.text;content.append(node);}scene.append(content);
      if(item.credit){const credit=document.createElement('div');credit.className='song-credit';credit.textContent=item.credit;scene.append(credit);}
      if(item.pagination){const counter=document.createElement('div');counter.className='page-counter';counter.textContent=item.pagination;scene.append(counter);}
      if(item.readingTitle){const title=document.createElement('div');title.className='reading-title';title.textContent=item.readingTitle;scene.append(title);}
    }
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
