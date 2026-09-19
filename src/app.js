import { compile, resolveAsset } from './config/model.js';
import {parseConfig,formatConfig} from './config/format.js';
import {parseSongs,sectionTarget,SONG_KEYS} from './config/songs.js';
import {BACKGROUND_STYLES,normalizeBackground} from './backgrounds/config.js';
import {setBackgroundCue,replaceSongText,sequenceFor} from './config/editing.js';
import {CueNavigation} from './ui/navigation.js';
import {renderGrid,renderOutline} from './ui/grid.js';
const $ = selector => document.querySelector(selector);
const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const preview = $('#preview'),nextPreview=$('#next-preview'),cues=new CueNavigation();
let nextReady=false,nextRenderKey='';
let popup = null, popupReady = false, previewReady = false;
let raw, show, index=0, base=location.href, configSource='';
let sourceText='',mediaRevision='',backgroundEpoch=Date.now(),backgroundKey='',songToolbarKey='';
let assets=new Map(), objectUrls=[], playing=false, remaining=0, lastTick=performance.now();
let media={time:0,duration:0,playing:false,trackKey:null};
let mediaWantsPlay=false, volume=80, blackout=false, dragging=null, noticeTimer;
preview.src=`projector.html?preview=1&session=${encodeURIComponent(token)}`;
nextPreview.src=`projector.html?preview=1&cue=1&session=${encodeURIComponent(token)}`;
function notice(text) { $('#notice').textContent=text;$('#notice').hidden=!text;clearTimeout(noticeTimer);if(text)noticeTimer=setTimeout(()=>$('#notice').hidden=true,10000); }
const fmt = value => `${Math.floor((value||0)/60)}:${String(Math.floor((value||0)%60)).padStart(2,'0')}`;
function post(target,type,data={}) {target?.postMessage({presentShow:token,type,...data},location.origin);}
function command(action,value){post(popupReady?popup:preview.contentWindow,'command',{action,value});}
function effectiveItem(at=index){
  const item=structuredClone(show.items[at]);
  if(item.src)item.src=resolveAsset(item.src,base,assets);
  if(item.track && item.track.kind!=='youtube')item.track.src=resolveAsset(item.track.src,base,assets);
  if(item.background.src)item.background.src=resolveAsset(item.background.src,base,assets);
  if(item.background.poster)item.background.poster=resolveAsset(item.background.poster,base,assets);
  if(blackout && at===index){item.type='blank';item.blocks=[];}
  return item;
}
function render(resume) {
  if(!show)return;
  try {
    const item=effectiveItem();
    const nextBackgroundKey=JSON.stringify(item.background);
    if(nextBackgroundKey!==backgroundKey){backgroundKey=nextBackgroundKey;backgroundEpoch=Date.now();}
    const data={item,volume,resume:resume??0,playing:mediaWantsPlay,backgroundEpoch};
    if(previewReady)post(preview.contentWindow,'render',{...data,active:!popupReady});
    if(popupReady)post(popup,'render',{...data,active:true});
  }catch(e){notice(e.message);}
}
function previewCue(){
  if(!show || !nextReady)return;
  try{const at=cues.next(show.items,index),item=effectiveItem(at);const key=JSON.stringify(item);if(key!==nextRenderKey){nextRenderKey=key;post(nextPreview.contentWindow,'render',{item,active:false,playing:false,volume:0,backgroundEpoch, cue:true});}}catch(e){notice(e.message);}
}
function selectCue(at){const target=cues.click(at);if(target!==null)go(target);else update();}
function takeNext(){go(cues.next(show.items,index));}
function go(next){
  if(!show)return;
  cues.reset();
  const oldKey=show.items[index]?.track?.key;
  index=Math.max(0,Math.min(show.items.length-1,next));blackout=false;
  const item=show.items[index];remaining=item.seconds;
  if(item.track?.key!==oldKey){media={time:0,duration:0,playing:false,trackKey:item.track?.key||null};mediaWantsPlay=!!item.track;}
  render();update();
  document.querySelector(`.slide-card[data-index="${index}"]`)?.scrollIntoView({block:'nearest'});
}
function update(){
  if(!show)return;
  const item=show.items[index];
  $('#current-label').textContent=blackout?'':item.song&&!item.song.titlePage?item.song.sectionLabel:item.label;
  $('#slide-position').textContent=`${String(index+1).padStart(2,'0')} / ${String(show.items.length).padStart(2,'0')}`;
  $('#play').textContent=(playing || media.playing)?'Ⅱ 暫停播放':'▶ 開始播放';
  $('#timer-label').textContent=item.seconds?`${item.group || '自動換頁'} · ${Math.ceil(remaining)} 秒`:'手動換頁';
  $('#prev').disabled=index===0;$('#next').disabled=index===show.items.length-1 && cues.pending===null;
  const nextIndex=cues.next(show.items,index);$('#next-label').textContent=show.items[nextIndex].label;$('#cancel-cue').disabled=cues.pending===null;$('#next-preview').closest('.next-panel').classList.toggle('queued',cues.pending!==null);previewCue();
  $('#media-name').textContent=item.track?(item.track.label || item.label):'此頁沒有音樂或影片';
  $('#media-play').disabled=!item.track;$('#loop').disabled=!item.track;
  $('#loop').checked=item.track?.loop||false;
  $('#media-play').textContent=media.playing?'Ⅱ 暫停媒體':'▶ 播放媒體';
  $('#elapsed').textContent=fmt(media.time);$('#duration').textContent=fmt(media.duration);
  if(document.activeElement!==$('#seek'))$('#seek').value=media.time;
  $('#seek').max=media.duration||1;$('#seek').disabled=!item.track || !media.duration;
  $('#blank').classList.toggle('primary',blackout);
  $('#background-choice').value=item.background.id;
  $('#background-info').textContent=`${BACKGROUND_STYLES[item.background.type].label} · seed ${item.background.seed}`;
  if(songToolbarKey!==`${item.song?.instance}:${item.song?.sectionId}`){
    songToolbarKey=`${item.song?.instance}:${item.song?.sectionId}`;
    const toolbar=$('#song-navigation');toolbar.replaceChildren();toolbar.hidden=!item.song;
    if(item.song){
      const title=document.createElement('span');title.textContent=item.song.title;toolbar.append(title);
      for(const shortcut of SONG_KEYS){
        const targets=show.items.filter(p=>p.song?.instance===item.song.instance && p.song.sectionStart && p.song.sectionKey===shortcut);
        if(!targets.length)continue;
        const button=document.createElement('button');button.textContent=`${shortcut} · ${targets[0].song.section}${targets.length>1?` ×${targets.length}`:''}`;
        button.classList.toggle('current-section',shortcut===item.song.sectionKey);button.onclick=()=>key(shortcut.toLowerCase());toolbar.append(button);
      }
    }
  }
  $('#grid').querySelectorAll('.slide-card').forEach(card=>{const selected=Number(card.dataset.index)===index;card.classList.toggle('active',selected);card.setAttribute('aria-pressed',String(selected));});
  const targets=new Set(SONG_KEYS.map(key=>cues.target(show.items,index,key)).filter(i=>i!==null));
  $('#grid').querySelectorAll('.slide-card').forEach(card=>{const at=Number(card.dataset.index);card.classList.toggle('queued',cues.pending===at);card.querySelector('.card-badge').classList.toggle('shortcut-next',targets.has(at));});
  $('#section-nav').querySelectorAll('button').forEach(button=>button.classList.toggle('active',Number(button.dataset.section)===item.section.index));
}
function grid(){
  $('#item-count').textContent=`${show.items.length} 個畫面`;
  renderGrid({container:$('#grid'),show,asset:source=>resolveAsset(source,base,assets),onSelect:selectCue,onReorder:reorder});
  renderOutline($('#section-nav'),show,(next,section)=>{selectCue(next);document.querySelector(`#section-${section}`).scrollIntoView({block:'start',behavior:'smooth'});});
}
function reorder(from,to){
  // Reordering within a carousel preserves it; moving whole standalone items preserves other groups.
  const a=show.items[from].origin,b=show.items[to].origin;
  if(a.section!==b.section || ['boundary','reading','song-title'].includes(a.kind) || ['boundary','reading','song-title'].includes(b.kind)){notice('跨項目排序請修改 YAML；項目空白頁會自動產生。');return;}
  const list=sequenceFor(raw,a);
  if(a.kind==='song' || b.kind==='song'){notice('歌曲分頁由空行決定，請在「編輯歌詞」調整；整首歌曲的順序可在 YAML sequence 修改。');return;}
  if(a.sequence===b.sequence && a.kind==='group'){const pages=list[a.sequence].pages;pages.splice(b.sub,0,pages.splice(a.sub,1)[0]);}
  else if(a.kind==='page' && b.kind==='page'){list.splice(b.sequence,0,list.splice(a.sequence,1)[0]);}
  else {notice('輪播內可拖曳排序；跨輪播移動請用「編輯設定」調整 sequence，保留清楚的循環範圍。');return;}
  applyRaw(raw);notice('順序已調整。請下載設定檔以保留修改。');
}
function applyRaw(candidate,text,preserve=false){
  const currentOrigin=show?.items[index]?.origin;
  const compiled=compile(candidate);
  if(preserve && currentOrigin){const target=compiled.items.findIndex(item=>JSON.stringify(item.origin)===JSON.stringify(currentOrigin));index=target>=0?target:Math.min(index,compiled.items.length-1);}
  cues.reset();nextRenderKey='';raw=candidate;show=compiled;sourceText=text??formatConfig(raw);songToolbarKey='';
  if(!preserve){index=0;playing=false;mediaWantsPlay=!!show.items[0].track;media={time:0,duration:0,playing:false,trackKey:null};remaining=show.items[0].seconds;blackout=false;mediaRevision=`${Date.now()}-${Math.random()}`;}
  // A new revision must reset previously loaded media even when its URL is unchanged.
  show.items.forEach(item=>{if(item.track)item.track.key=`${mediaRevision}:${item.track.key}`;});
  $('#background-choice').replaceChildren();
  Object.entries(show.backgrounds).forEach(([id,bg])=>{const option=document.createElement('option');option.value=id;option.textContent=`${id} · ${BACKGROUND_STYLES[bg.type].label}`;$('#background-choice').append(option);});
  $('#entry').hidden=true;$('#controller').hidden=false;document.body.classList.add('console-open');$('#show-name').textContent=show.name;document.title=`${show.name} · PresentShow`;
  $('#media-status').textContent='投影視窗開啟後，聲音只從投影視窗播放。';grid();render();update();
}
async function loadURL(value){
  try{
    const url=new URL(value,location.href);if(!['http:','https:'].includes(url.protocol))throw new Error('本機設定請使用「選取本機 JSON 設定檔」。');
    const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`讀取失敗：HTTP ${response.status}`);
    const text=await response.text(),candidate=parseConfig(text);compile(candidate);base=response.url;configSource=url.href;applyRaw(candidate,text);
  }catch(e){notice(`無法載入設定：${e.message}`);}
}
$('#sample').onclick=()=>loadURL('examples/sample.yml');
$('#load-url').onclick=()=>loadURL($('#config-url').value.trim());
$('#config-url').onkeydown=e=>{if(e.key==='Enter')$('#load-url').click();};
$('#config-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const text=await file.text(),candidate=parseConfig(text);compile(candidate);base=location.href;configSource=file.name;applyRaw(candidate,text);}catch(err){notice(`設定檔錯誤：${err.message}`);}e.target.value='';};
for(const input of document.querySelectorAll('.assets-input'))input.onchange=e=>{
  // Retain old blob URLs until page unload: currently playing media must not be invalidated.
  assets=new Map();
  for(const file of e.target.files){const url=URL.createObjectURL(file);objectUrls.push(url);const path=file.webkitRelativePath || file.name;assets.set(path,url);assets.set(path.split('/').slice(1).join('/') || file.name,url);}
  document.querySelectorAll('.asset-count').forEach(el=>el.textContent=`已選取 ${e.target.files.length} 個素材檔案`);
  if(show){grid();render();update();}notice('素材已就緒，檔案只在本機使用。');
};
$('#prev').onclick=()=>go(index-1);$('#next').onclick=takeNext;$('#take-next').onclick=takeNext;$('#cancel-cue').onclick=()=>{cues.reset();update();};
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
  else setTimeout(()=>{if(popup && !popup.closed && !popupReady)notice('投影視窗尚未連線。若目前瀏覽器不支援獨立視窗，請用 Chrome／Edge 開啟相同網址再試。');},8000);
}
$('#open-projector').onclick=openProjector;$('#focus-projector').onclick=openProjector;
$('#back').onclick=()=>{playing=false;mediaWantsPlay=false;command('play',false);$('#controller').hidden=true;$('#entry').hidden=false;document.body.classList.remove('console-open');};
$('#edit').onclick=()=>{$('#config-text').value=sourceText;$('#editor-error').textContent='';$('#editor').showModal();};
$('#close-editor').onclick=()=>$('#editor').close();
$('#apply').onclick=()=>{try{const text=$('#config-text').value;applyRaw(parseConfig(text),text);$('#editor').close();notice('設定已套用；請下載保存修改。');}catch(e){$('#editor-error').textContent=e.message;}};
$('#download').onclick=()=>{try{const text=$('#config-text').value;compile(parseConfig(text));const url=URL.createObjectURL(new Blob([text],{type:'text/yaml;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='presentation.private.yml';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){$('#editor-error').textContent=e.message;}};
$('#edit-songs').onclick=()=>{$('#song-text').value=raw.songs||'';$('#song-error').textContent='';$('#song-editor').showModal();};
$('#close-songs').onclick=()=>$('#song-editor').close();
$('#apply-songs').onclick=()=>{
  try{const source=$('#song-text').value;const next=replaceSongText(raw,source,parseSongs(raw.songs||''),parseSongs(source));applyRaw(next);$('#song-editor').close();notice('歌詞已分頁；新增歌曲接在既有歌曲後，原本無歌曲則加至流程末尾。請下載設定保存。');}
  catch(e){$('#song-error').textContent=e.message;}
};
$('#background-choice').onchange=e=>{try{applyRaw(setBackgroundCue(raw,show.items[index],e.target.value),undefined,true);notice('已記錄此頁的背景切換；後續頁面會延續，直到下一個背景設定。');}catch(err){notice(err.message);}};
for(const [type,meta] of Object.entries(BACKGROUND_STYLES)){const option=document.createElement('option');option.value=type;option.textContent=meta.label;$('#bg-type').append(option);}
$('#edit-background').onclick=()=>{
  const bg=show.items[index].background;
  $('#bg-id').value=bg.id;$('#bg-type').value=bg.type;$('#bg-seed').value=bg.seed;
  $('#bg-color-a').value=bg.colors[0];$('#bg-color-b').value=bg.colors[1];
  for(const name of ['deviation','speed','motion','colorMotion','blobs','blur','sensitivity','response'])$(`#bg-${name}`).value=bg[name];
  $('#bg-src').value=bg.src||'';$('#bg-fit').value=bg.fit||'cover';$('#background-error').textContent='';$('#background-editor').showModal();
};
$('#close-background').onclick=()=>$('#background-editor').close();
$('#apply-background').onclick=()=>{
  try{
    const id=$('#bg-id').value.trim();if(!id)throw new Error('請輸入背景名稱。');
    const config={type:$('#bg-type').value,seed:$('#bg-seed').value,colors:[$('#bg-color-a').value,$('#bg-color-b').value],src:$('#bg-src').value.trim(),fit:$('#bg-fit').value};
    const original=raw.backgrounds?.[show.items[index].background.id];
    if(config.type==='video' && original?.poster)config.poster=original.poster;
    for(const name of ['deviation','speed','motion','colorMotion','blobs','blur','sensitivity','response'])config[name]=Number($(`#bg-${name}`).value);
    normalizeBackground(config,id);
    const candidate=setBackgroundCue(raw,show.items[index],id);candidate.backgrounds={...raw.backgrounds,[id]:config};
    // Legacy JSON has an implicit default background; retain it for all earlier pages.
    if(!raw.backgrounds)candidate.backgrounds={...show.backgrounds,...candidate.backgrounds};
    applyRaw(candidate,undefined,true);$('#background-editor').close();notice('背景已更新，媒體保持播放；請下載設定保存。');
  }catch(e){$('#background-error').textContent=e.message;}
};
function key(key){
  if(key==='ArrowLeft')go(index-1);
  if(key==='ArrowRight')takeNext();
  if(key===' ')toggle();
  if(key==='Escape'){cues.reset();update();}
  if(SONG_KEYS.includes(key.toUpperCase())){const target=cues.shortcut(show.items,index,key,performance.now());if(target!==null)go(target);else update();}
}

document.addEventListener('keydown',e=>{if(!show || !$('#entry').hidden || document.querySelector('dialog[open]') || e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.target.closest('input,textarea,select,[contenteditable]'))return;if(['ArrowLeft','ArrowRight',' ','Escape'].includes(e.key) || SONG_KEYS.includes(e.key.toUpperCase())){e.preventDefault();key(e.key);}});
window.addEventListener('message',event=>{
  if(event.origin!==location.origin || event.data?.presentShow!==token)return;
  const isPreview=event.source===preview.contentWindow,isPopup=event.source===popup;
  if(event.source===nextPreview.contentWindow){if(event.data.type==='ready'){nextReady=true;nextRenderKey='';previewCue();}return;}
  if(!isPreview && !isPopup)return;
  const msg=event.data;
  if(msg.type==='ready'){
    if(isPopup){popupReady=true;$('#connection').textContent='投影視窗已連線';$('#open-projector').textContent='● 投影已連線 ↗';$('#open-projector').classList.add('connected');}else previewReady=true;
    render(media.time);return;
  }
  if(popupReady?!isPopup:!isPreview)return;
  if(msg.type==='status' && msg.trackKey===(show?.items[index]?.track?.key||null)){media=msg;update();}
  if(msg.type==='error'){$('#media-status').textContent=msg.message || '媒體已就緒。';if(msg.message)notice(msg.message);}
  if(msg.type==='audio' && isPopup)post(preview.contentWindow,'audio',{signal:msg.signal});
  if(msg.type==='key')key(msg.key);
});
setInterval(()=>{
  const now=performance.now(),delta=(now-lastTick)/1000;lastTick=now;
  $('#clock').textContent=new Date().toLocaleTimeString('zh-TW',{hour12:false,hour:'2-digit',minute:'2-digit'});
  if(popup?.closed){popup=null;popupReady=false;$('#connection').textContent='本機預覽';$('#open-projector').textContent='↗ 開啟投影視窗';$('#open-projector').classList.remove('connected');render(media.time);}
  if(show && playing && !blackout && remaining>0){remaining=Math.max(0,remaining-delta);if(remaining===0){const next=show.items[index].autoNext;if(cues.pending!==null || next!==null)go(cues.pending??next);else playing=false;}update();}
},200);
window.addEventListener('beforeunload',()=>{command('play',false);popup?.close();objectUrls.forEach(url=>URL.revokeObjectURL(url));});
const initial=new URLSearchParams(location.search).get('config');if(initial){$('#config-url').value=initial;loadURL(initial);}
