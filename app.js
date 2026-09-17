import { compile, resolveAsset } from './model.js';
const $ = selector => document.querySelector(selector);
const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const preview = $('#preview');
let popup = null, popupReady = false, previewReady = false;
let raw, show, index=0, base=location.href, configSource='';
let assets=new Map(), objectUrls=[], playing=false, remaining=0, lastTick=performance.now();
let media={time:0,duration:0,playing:false,trackKey:null};
let mediaWantsPlay=false, volume=80, blackout=false, dragging=null, noticeTimer;
preview.src=`projector.html?preview=1&session=${encodeURIComponent(token)}`;
function notice(text) { $('#notice').textContent=text;$('#notice').hidden=!text;clearTimeout(noticeTimer);if(text)noticeTimer=setTimeout(()=>$('#notice').hidden=true,10000); }
const fmt = value => `${Math.floor((value||0)/60)}:${String(Math.floor((value||0)%60)).padStart(2,'0')}`;
function post(target,type,data={}) {target?.postMessage({presentShow:token,type,...data},location.origin);}
function command(action,value){post(popupReady?popup:preview.contentWindow,'command',{action,value});}
function effectiveItem(){
  const item=structuredClone(show.items[index]);
  if(item.src)item.src=resolveAsset(item.src,base,assets);
  if(item.track && item.track.kind!=='youtube')item.track.src=resolveAsset(item.track.src,base,assets);
  if(blackout){item.type='blank';item.blocks=[];}
  return item;
}
function render(resume) {
  if(!show)return;
  try {
    const item=effectiveItem();
    const data={item,volume,resume:resume??0,playing:mediaWantsPlay};
    if(previewReady)post(preview.contentWindow,'render',{...data,active:!popupReady});
    if(popupReady)post(popup,'render',{...data,active:true});
  }catch(e){notice(e.message);}
}
function go(next){
  if(!show)return;
  const oldKey=show.items[index]?.track?.key;
  index=Math.max(0,Math.min(show.items.length-1,next));blackout=false;
  const item=show.items[index];remaining=item.seconds;
  if(item.track?.key!==oldKey){media={time:0,duration:0,playing:false,trackKey:item.track?.key||null};mediaWantsPlay=!!item.track;}
  render();update();
}
function update(){
  if(!show)return;
  const item=show.items[index];
  $('#current-label').textContent=blackout?'純背景（媒體持續）':item.label;
  $('#slide-position').textContent=`${String(index+1).padStart(2,'0')} / ${String(show.items.length).padStart(2,'0')}`;
  $('#play').textContent=(playing || media.playing)?'Ⅱ 暫停播放':'▶ 開始播放';
  $('#timer-label').textContent=item.seconds?`${item.group || '自動換頁'} · ${Math.ceil(remaining)} 秒`:'手動換頁';
  $('#prev').disabled=index===0;$('#next').disabled=index===show.items.length-1;
  $('#media-name').textContent=item.track?(item.track.label || item.label):'此頁沒有音樂或影片';
  $('#media-play').disabled=!item.track;$('#loop').disabled=!item.track;
  $('#loop').checked=item.track?.loop||false;
  $('#media-play').textContent=media.playing?'Ⅱ 暫停媒體':'▶ 播放媒體';
  $('#elapsed').textContent=fmt(media.time);$('#duration').textContent=fmt(media.duration);
  if(document.activeElement!==$('#seek'))$('#seek').value=media.time;
  $('#seek').max=media.duration||1;$('#seek').disabled=!item.track || !media.duration;
  $('#blank').classList.toggle('primary',blackout);
  [...$('#grid').children].forEach((card,i)=>{card.classList.toggle('active',i===index);card.setAttribute('aria-pressed',String(i===index));});
}
function grid(){
  $('#grid').replaceChildren();$('#item-count').textContent=`${show.items.length} 個畫面`;
  show.items.forEach((item,i)=>{
    const card=document.createElement('button');card.className='slide-card';card.draggable=true;card.title=`${i+1}. ${item.label}`;card.setAttribute('aria-label',card.title);
    const thumb=document.createElement('div');thumb.className=`thumbnail ${item.type==='media'?'media-thumb':''}`;
    if(item.type==='image'){
      const img=document.createElement('img');try{img.src=resolveAsset(item.src,base,assets);}catch{}img.alt=item.alt||item.label;thumb.append(img);
    }else if(item.type==='media'){
      const symbol=document.createElement('span');symbol.className='thumb-media';symbol.textContent=item.track?.kind==='audio'?'♫':'▶';thumb.append(symbol);
      const text=document.createElement('small');text.textContent=item.track?.label || item.label;thumb.append(text);
    }else if(item.type==='text'){
      const blocks=item.blocks||[];const title=blocks.find(b=>['title','quote','account'].includes(b.kind)) || blocks[0];
      const main=document.createElement('strong');main.textContent=title?.text||'';thumb.append(main);
      const secondary=blocks.find(b=>b!==title);if(secondary){const small=document.createElement('small');small.textContent=secondary.text;thumb.append(small);}
    }
    const meta=document.createElement('div');meta.className='card-meta';
    const n=document.createElement('span');n.className='card-index';n.textContent=String(i+1).padStart(2,'0');
    const label=document.createElement('span');label.className='card-title';label.textContent=item.label;
    const badge=document.createElement('span');badge.className='card-badge';badge.textContent=item.seconds?`${item.seconds}s`:item.track?.loop?'↻':'';
    meta.append(n,label,badge);card.append(thumb,meta);
    if(item.group){const tag=document.createElement('span');tag.className='group-label';tag.textContent=`↻ ${item.group}`;card.append(tag);}
    card.onclick=()=>go(i);
    card.ondragstart=e=>{dragging=i;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(i));};
    card.ondragover=e=>{e.preventDefault();card.classList.add('drag-over');};card.ondragleave=()=>card.classList.remove('drag-over');
    card.ondragend=()=>{dragging=null;document.querySelectorAll('.drag-over').forEach(c=>c.classList.remove('drag-over'));};
    card.ondrop=e=>{e.preventDefault();card.classList.remove('drag-over');if(dragging!==null && dragging!==i)reorder(dragging,i);dragging=null;};
    $('#grid').append(card);
  });
}
function reorder(from,to){
  // Reordering within a carousel preserves it; moving whole standalone items preserves other groups.
  const entries=[];
  raw.sequence.forEach((entry,seq)=>{if(entry?.pages)entry.pages.forEach((_,sub)=>entries.push({seq,sub}));else entries.push({seq,sub:null});});
  const a=entries[from],b=entries[to];
  if(a.seq===b.seq && a.sub!==null){const list=raw.sequence[a.seq].pages;list.splice(b.sub,0,list.splice(a.sub,1)[0]);}
  else if(a.sub===null && b.sub===null){raw.sequence.splice(b.seq,0,raw.sequence.splice(a.seq,1)[0]);}
  else {notice('輪播內可拖曳排序；跨輪播移動請用「編輯設定」調整 sequence，保留清楚的循環範圍。');return;}
  applyRaw(raw);notice('順序已調整。請下載設定檔以保留修改。');
}
function applyRaw(candidate){
  const compiled=compile(candidate);
  raw=candidate;show=compiled;index=0;playing=false;mediaWantsPlay=!!show.items[0].track;media={time:0,duration:0,playing:false,trackKey:null};remaining=show.items[0].seconds;blackout=false;
  // A new revision must reset previously loaded media even when its URL is unchanged.
  const revision=`${Date.now()}-${Math.random()}`;show.items.forEach(item=>{if(item.track)item.track.key=`${revision}:${item.track.key}`;});
  $('#entry').hidden=true;$('#controller').hidden=false;$('#show-name').textContent=show.name;document.title=`${show.name} · PresentShow`;
  $('#media-status').textContent='投影視窗開啟後，聲音只從投影視窗播放。';grid();render();update();
}
async function loadURL(value){
  try{
    const url=new URL(value,location.href);if(!['http:','https:'].includes(url.protocol))throw new Error('本機設定請使用「選取本機 JSON 設定檔」。');
    const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`讀取失敗：HTTP ${response.status}`);
    const candidate=await response.json();compile(candidate);base=response.url;configSource=url.href;applyRaw(candidate);
  }catch(e){notice(`無法載入設定：${e.message}`);}
}
$('#sample').onclick=()=>loadURL('examples/sample.json');
$('#load-url').onclick=()=>loadURL($('#config-url').value.trim());
$('#config-url').onkeydown=e=>{if(e.key==='Enter')$('#load-url').click();};
$('#config-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const candidate=JSON.parse(await file.text());compile(candidate);base=location.href;configSource=file.name;applyRaw(candidate);}catch(err){notice(`設定檔錯誤：${err.message}`);}e.target.value='';};
for(const input of document.querySelectorAll('.assets-input'))input.onchange=e=>{
  // Retain old blob URLs until page unload: currently playing media must not be invalidated.
  assets=new Map();
  for(const file of e.target.files){const url=URL.createObjectURL(file);objectUrls.push(url);const path=file.webkitRelativePath || file.name;assets.set(path,url);assets.set(path.split('/').slice(1).join('/') || file.name,url);}
  document.querySelectorAll('.asset-count').forEach(el=>el.textContent=`已選取 ${e.target.files.length} 個素材檔案`);
  if(show){grid();render();update();}notice('素材已就緒，檔案只在本機使用。');
};
$('#prev').onclick=()=>go(index-1);$('#next').onclick=()=>go(index+1);
function toggle(){playing=!(playing || media.playing);mediaWantsPlay=playing;command('play',playing);update();}
$('#play').onclick=toggle;
$('#blank').onclick=()=>{blackout=!blackout;render();update();};
$('#media-play').onclick=()=>{mediaWantsPlay=!media.playing;command('play',mediaWantsPlay);};
$('#loop').onchange=e=>{const key=show.items[index].track?.key;show.items.forEach(item=>{if(item.track?.key===key)item.track.loop=e.target.checked;});command('loop',e.target.checked);};
$('#volume').oninput=e=>{volume=Number(e.target.value);command('volume',volume);};
$('#seek').oninput=e=>{media.time=Number(e.target.value);$('#elapsed').textContent=fmt(media.time);};
$('#seek').onchange=e=>command('seek',Number(e.target.value));
function openProjector(){
  if(popup && !popup.closed){popup.focus();return;}
  popupReady=false;
  popup=window.open(`projector.html?session=${encodeURIComponent(token)}`,`present-show-${token}`,'popup,width=1280,height=720');
  if(!popup)notice('瀏覽器封鎖了新視窗。請允許此網站開啟彈出視窗，再試一次。');
}
$('#open-projector').onclick=openProjector;$('#focus-projector').onclick=openProjector;
$('#back').onclick=()=>{playing=false;mediaWantsPlay=false;command('play',false);$('#controller').hidden=true;$('#entry').hidden=false;};
$('#edit').onclick=()=>{$('#config-text').value=JSON.stringify(raw,null,2);$('#editor-error').textContent='';$('#editor').showModal();};
$('#close-editor').onclick=()=>$('#editor').close();
$('#apply').onclick=()=>{try{const candidate=JSON.parse($('#config-text').value);applyRaw(candidate);$('#editor').close();notice('設定已套用；請下載保存修改。');}catch(e){$('#editor-error').textContent=e.message;}};
$('#download').onclick=()=>{try{const candidate=JSON.parse($('#config-text').value);compile(candidate);const url=URL.createObjectURL(new Blob([JSON.stringify(candidate,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='presentation.private.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){$('#editor-error').textContent=e.message;}};
function key(key){if(key==='ArrowLeft')go(index-1);if(key==='ArrowRight')go(index+1);if(key===' ')toggle();}
document.addEventListener('keydown',e=>{if(!show || !$('#entry').hidden || $('#editor').open || e.target.closest('input,textarea,select,[contenteditable]'))return;if(['ArrowLeft','ArrowRight',' '].includes(e.key)){e.preventDefault();key(e.key);}});
window.addEventListener('message',event=>{
  if(event.origin!==location.origin || event.data?.presentShow!==token)return;
  const isPreview=event.source===preview.contentWindow,isPopup=event.source===popup;
  if(!isPreview && !isPopup)return;
  const msg=event.data;
  if(msg.type==='ready'){
    if(isPopup){popupReady=true;$('#connection').textContent='投影視窗已連線';}else previewReady=true;
    render(media.time);return;
  }
  if(popupReady?!isPopup:!isPreview)return;
  if(msg.type==='status' && msg.trackKey===(show?.items[index]?.track?.key||null)){media=msg;update();}
  if(msg.type==='error'){$('#media-status').textContent=msg.message || '媒體已就緒。';if(msg.message)notice(msg.message);}
  if(msg.type==='key')key(msg.key);
});
setInterval(()=>{
  const now=performance.now(),delta=(now-lastTick)/1000;lastTick=now;
  $('#clock').textContent=new Date().toLocaleTimeString('zh-TW',{hour12:false,hour:'2-digit',minute:'2-digit'});
  if(popup?.closed){popup=null;popupReady=false;$('#connection').textContent='本機預覽';render(media.time);}
  if(show && playing && !blackout && remaining>0){remaining=Math.max(0,remaining-delta);if(remaining===0){const next=show.items[index].autoNext;if(next!==null)go(next);else playing=false;}update();}
},200);
window.addEventListener('beforeunload',()=>{command('play',false);popup?.close();objectUrls.forEach(url=>URL.revokeObjectURL(url));});
const initial=new URLSearchParams(location.search).get('config');if(initial){$('#config-url').value=initial;loadURL(initial);}
