import {accessLabels,createSyncClient,newHostKey,validSyncRoom,normalizeEndpoint} from './leader-sync.js';
import {ScreenAwake} from './screen-awake.js';
import {applyUILabels,uiLabels} from '../config/ui-labels.js';
export function mountLeader({onState,onError=()=>{},onAccessChange=()=>{},showOutsideWorship=false}){
 const params=new URLSearchParams(location.search),get=id=>document.getElementById(id);
 const variant=location.pathname.match(/leader([1-4])\.html$/)?.[1]||'';
 const clientKeys=new Map();
 const cover=document.createElement('section');cover.id='leader-cover';cover.className='leader-cover';
 cover.innerHTML='<div class="leader-cover-card"><h2 id="leader-cover-title">連接 PresentShow 主控</h2><p id="leader-cover-message">輸入連線代碼，或掃描主控顯示的 QR Code。</p><button id="leader-cover-connect">設定連線</button></div>';document.body.append(cover);
 const chip=document.createElement('div');chip.className='leader-sync-chip';
 chip.innerHTML='<span id="leader-access-mode">瀏覽</span><span id="leader-client-id" hidden></span><span id="leader-sync-status" hidden></span><button id="leader-sync-settings" type="button" aria-label="修改連線設定">⚙</button>';document.body.append(chip);
 const awakeStatus=document.createElement('span');awakeStatus.className='leader-awake-status';chip.prepend(awakeStatus);
 const awake=new ScreenAwake({onStatus:(text,locked)=>{awakeStatus.textContent=locked?'':text;awakeStatus.hidden=locked;}});
 const positionChip=()=>{const box=get('fullscreen')?.getBoundingClientRect();if(box?.width){chip.style.top=(box.bottom+2)+'px';chip.style.right=Math.max(5,innerWidth-box.right)+'px';}};
 window.addEventListener('resize',positionChip);document.addEventListener('fullscreenchange',positionChip);requestAnimationFrame(positionChip);
 window.addEventListener('pagehide',event=>{if(event.persisted)awake.lock?.release();else awake.destroy();});
 window.addEventListener('pageshow',()=>awake.request());
 const panel=document.createElement('dialog');panel.className='leader-sync-dialog';
 panel.innerHTML='<h2>連線到 PresentShow 主控</h2><label>連線代碼<input id="leader-room" autocomplete="off" spellcheck="false" placeholder="主控畫面的 32 位代碼"></label><label>WebSocket 服務網址<input id="leader-ws" autocomplete="url" inputmode="url" placeholder="https://present-show-sync.帳號.workers.dev"></label><p id="leader-settings-error" role="alert"></p><div class="leader-dialog-actions"><button id="leader-close" type="button">取消</button><button id="leader-connect" type="button">連線</button></div>';document.body.append(panel);
 const roomInput=get('leader-room'),urlInput=get('leader-ws');
 const originalApp=document.querySelector('main'),reading=document.createElement('section');reading.className='leader-readonly-app';reading.hidden=true;document.body.append(reading);
 let readingArea='before',readingPosition=null,latestSnapshot=null,labels=uiLabels();
 function applyLabels(snapshot){
  labels={...uiLabels(),...snapshot.labels};applyUILabels(document,labels);
  document.title=`PresentShow · ${labels.leader} ${variant}`;
  document.querySelector('meta[name="description"]')?.setAttribute('content',document.title);
 }
 function renderReading(snapshot){
  if(showOutsideWorship){if(originalApp)originalApp.hidden=false;return;}
  const outside=!snapshot.active?.singing;reading.hidden=!outside;if(originalApp)originalApp.hidden=outside;
  if(!outside)return;
  const at=snapshot.active.slideIndex,changed=at!==readingPosition;
  if(changed)readingArea=snapshot.active.area||'before';readingPosition=at;reading.replaceChildren();
  const heading=document.createElement('h1');heading.textContent=labels.worship+(readingArea==='before'?'前':'後')+' · 僅看';reading.append(heading);
  const nav=document.createElement('nav');
  for(const [area,title] of [['before',labels.worship+'前'],['after',labels.worship+'後']]){
   const button=document.createElement('button');button.textContent=title;button.onclick=()=>{readingArea=area;renderReading(latestSnapshot);};nav.append(button);
  }
  reading.append(nav);const list=document.createElement('div');list.className='leader-readonly-list';
  for(const item of snapshot.readOnly?.[readingArea]||[]){
   const row=document.createElement('article');row.className='leader-readonly-item';row.classList.toggle('active',item.slideIndex===at);row.classList.toggle('queued',item.slideIndex===snapshot.next?.slideIndex);
   const title=document.createElement('strong');title.textContent=item.name||'';const text=document.createElement('p');text.textContent=item.lines.join('\n');row.append(title,text);list.append(row);
  }
  reading.append(list);if(changed)list.querySelector('.active')?.scrollIntoView({block:'nearest',behavior:'smooth'});
 }
 roomInput.value=params.get('room')||localStorage.getItem('present-show-leader-room')||'';
 urlInput.value=params.get('ws')||localStorage.getItem('present-show-relay-url')||'';
 let client=null,hasData=false,singing=false,online=false,level='view',clientId='',denied='';
 const status=message=>{const abnormal=/中斷|錯誤|無法|失敗|離線|無效/.test(message);get('leader-sync-status').textContent=abnormal?message:'';get('leader-sync-status').hidden=!abnormal;};
 const showCover=(title,message,button=true)=>{get('leader-cover-title').textContent=title;get('leader-cover-message').textContent=message;get('leader-cover-connect').hidden=!button;cover.hidden=false;};
 const refresh=()=>{
  if(!hasData){if(originalApp)originalApp.hidden=true;reading.hidden=true;}
  if(denied)showCover('無法使用此邀請',denied);
  else if(!hasData&&client)showCover('載入中…','正在等待主控傳送歌曲、歌詞及播放順序。');
  else if(!hasData)showCover('連接 PresentShow 主控','輸入連線代碼，或掃描主控顯示的 QR Code。');
  else cover.hidden=true;
  chip.classList.toggle('offline',hasData&&!online);
  get('leader-access-mode').textContent=accessLabels[level];
  get('leader-client-id').textContent=clientId.slice(0,8);get('leader-client-id').hidden=!clientId;
  document.body.classList.toggle('leader-view-only',level==='view');
 };
 function setAccess(next,id=''){
  level=next;clientId=id;refresh();onAccessChange();
 }
 const open=()=>{get('leader-settings-error').textContent='';panel.showModal();};
 get('leader-sync-settings').onclick=open;get('leader-cover-connect').onclick=open;
 get('leader-close').onclick=()=>panel.close();
 get('leader-connect').onclick=()=>{
  try{
   const room=roomInput.value.trim().toLowerCase(),endpoint=normalizeEndpoint(urlInput.value.trim());
   if(!validSyncRoom(room))throw Error('連線代碼格式錯誤，請直接複製主控提供的代碼。');
   client?.close();hasData=false;singing=false;online=false;denied='';setAccess('view');
   localStorage.setItem('present-show-leader-room',room);localStorage.setItem('present-show-relay-url',endpoint);
   const usesInvite=room===params.get('room')&&normalizeEndpoint(params.get('ws')||endpoint)===endpoint;
   const invite=usesInvite?params.get('id'):null;
   const controlKey=usesInvite&&!invite&&params.get('mode')!=='view'?(params.get('cue')||params.get('control')):null;
   const playbackKey=usesInvite&&!invite&&params.get('mode')==='control'?params.get('playback'):null;
   const storageKey='present-show-client:'+endpoint+':'+room+':'+variant;
   let clientKey;
   if(!invite){
    clientKey=sessionStorage.getItem(storageKey)||clientKeys.get(storageKey)||newHostKey();
    sessionStorage.setItem(storageKey,clientKey);clientKeys.set(storageKey,clientKey);
   }
   client=createSyncClient({room,endpoint,role:'leader',controlKey,playbackKey,variant,clientKey,invite,
    onAccess:setAccess,
    onDenied:message=>{denied=message;setAccess('view');},
    onStatus:s=>{status(s);if(s.includes('中斷')||s==='WebSocket 網路錯誤'){online=false;setAccess('view');}},
    onOpen:()=>{status('已連線，等待主控');client.send({type:'request'});},
    onPresence:isOnline=>{const changed=online!==isOnline;online=isOnline;status(isOnline?'主控在線 · 已同步':'主控離線');refresh();if(changed)onAccessChange();},
    onState:snapshot=>{if(!snapshot||snapshot.schema!==1)return false;singing=!!snapshot.active?.singing;latestSnapshot=snapshot;document.body.dataset.syncReceivedAt=String(Date.now());try{if(originalApp)originalApp.hidden=false;applyLabels(snapshot);onState(snapshot);renderReading(snapshot);hasData=true;}catch(e){refresh();onError(e);status('資料套用失敗：'+e.message);return false;}refresh();positionChip();return true;}
   });panel.close();refresh();
  }catch(e){get('leader-settings-error').textContent=e.message;}
 };
 function navigate(sequence){
  if(level==='view')return;
  if(!singing){status('目前為唯讀階段');return;}
  if(!hasData||!client?.connected){status('未連線，無法控制主控');return;}
  if(!online){status('主控離線，無法切換');return;}
  const queued=sequence.cue,item=queued?sequence.route.find(e=>e.id===queued.id):sequence.nextSegment;
  if(!item||item.end){status('此項目不是主控的歌詞頁，暫無投影對應');return;}
  const routePage=queued?.page||0;
  client.send({type:'navigate',target:{songIndex:item.song,sectionIndex:item.section??0,utility:item.utility||null,
    page:item.pageRefs?.[routePage]??routePage,routePage,
    routeIndex:sequence.route.findIndex(e=>e.id===item.id)}});
 }
 function navigateTo(target){
  if(level==='view')return false;
  if(!singing){status('目前為唯讀階段');return false;}
  if(!hasData||!client?.connected){status('未連線，無法控制主控');return false;}
  if(!online){status('主控離線，無法切換');return false;}
  if(!target||!Number.isInteger(target.routeIndex)||target.routeIndex<0
   ||!Number.isInteger(target.routePage)||target.routePage<0
   ||!Number.isInteger(target.songIndex)||target.songIndex<0
   ||!Number.isInteger(target.sectionIndex)||target.sectionIndex<0
   ||!Number.isInteger(target.page)||target.page<0){status('無效的換頁要求');return false;}
  return client.send({type:'navigate',target});
 }
 function playback(action,slideIndex){
  if(level!=='control')return false;
  if(!hasData||!client?.connected||!online){status('主控離線，無法切換');return false;}
  return client.send({type:'playback',action,slideIndex,contentVersion:latestSnapshot.contentVersion});
 }
 get('leader-loading')?.remove();
 refresh();if(validSyncRoom(roomInput.value.trim().toLowerCase())&&urlInput.value.trim())get('leader-connect').click();else open();
 return {navigate,navigateTo,playback,get canControl(){return level!=='view';},get level(){return level;},get online(){return online;}};
}
