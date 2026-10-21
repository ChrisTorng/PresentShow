import {createSyncClient,validSyncRoom,normalizeEndpoint} from './leader-sync.js';
export function mountLeader({onState,onError=()=>{}}){
 const params=new URLSearchParams(location.search),get=id=>document.getElementById(id);
 const cover=document.createElement('section');cover.id='leader-cover';cover.className='leader-cover';
 cover.innerHTML='<div class="leader-cover-card"><h2 id="leader-cover-title">連接 PresentShow 主控</h2><p id="leader-cover-message">輸入連線代碼，或掃描主控顯示的 QR Code。</p><button id="leader-cover-connect">設定連線</button></div>';document.body.append(cover);
 const chip=document.createElement('div');chip.className='leader-sync-chip';
 chip.innerHTML='<span id="leader-sync-status">尚未同步</span><button id="leader-sync-settings" type="button" aria-label="修改連線設定">⚙</button>';document.body.append(chip);
 const panel=document.createElement('dialog');panel.className='leader-sync-dialog';
 panel.innerHTML='<h2>連線到 PresentShow 主控</h2><label>連線代碼<input id="leader-room" autocomplete="off" spellcheck="false" placeholder="主控畫面的 32 位代碼"></label><label>WebSocket 服務網址<input id="leader-ws" autocomplete="url" inputmode="url" placeholder="https://present-show-sync.帳號.workers.dev"></label><p id="leader-settings-error" role="alert"></p><div class="leader-dialog-actions"><button id="leader-close" type="button">取消</button><button id="leader-connect" type="button">連線</button></div>';document.body.append(panel);
 const roomInput=get('leader-room'),urlInput=get('leader-ws');
 roomInput.value=params.get('room')||localStorage.getItem('present-show-leader-room')||'';
 urlInput.value=params.get('ws')||localStorage.getItem('present-show-relay-url')||'';
 let client=null,hasData=false,singing=false,online=false;
 const status=message=>{get('leader-sync-status').textContent=message;};
 const showCover=(title,message,button=true)=>{get('leader-cover-title').textContent=title;get('leader-cover-message').textContent=message;get('leader-cover-connect').hidden=!button;cover.hidden=false;};
 const refresh=()=>{if(!hasData)showCover('等待主控設定','連線後會自動取得主控的歌曲、歌詞及播放順序。');else if(!singing)showCover('目前不是唱歌階段','主控切換至歌曲歌詞頁時，這裡會自動顯示。',false);else cover.hidden=true;chip.classList.toggle('offline',hasData&&!online);};
 const open=()=>{get('leader-settings-error').textContent='';panel.showModal();};
 get('leader-sync-settings').onclick=open;get('leader-cover-connect').onclick=open;
 get('leader-close').onclick=()=>panel.close();
 get('leader-connect').onclick=()=>{
  try{
   const room=roomInput.value.trim().toLowerCase(),endpoint=normalizeEndpoint(urlInput.value.trim());
   if(!validSyncRoom(room))throw Error('連線代碼格式錯誤，請直接複製主控提供的代碼。');
   client?.close();hasData=false;singing=false;online=false;
   localStorage.setItem('present-show-leader-room',room);localStorage.setItem('present-show-relay-url',endpoint);
   client=createSyncClient({room,endpoint,role:'leader',
    onStatus:s=>{status(s);if(s.includes('中斷')||s.includes('錯誤'))online=false;refresh();},
    onOpen:()=>{status('已連線，等待主控');client.send({type:'request'});},
    onPresence:isOnline=>{online=isOnline;status(isOnline?'主控在線 · 已同步':'主控離線');refresh();},
    onState:(snapshot,rev)=>{if(!snapshot||snapshot.schema!==1)return;hasData=true;singing=!!snapshot.active?.singing;try{onState(snapshot);}catch(e){onError(e);status('資料套用失敗：'+e.message);}refresh();}
   });panel.close();refresh();
  }catch(e){get('leader-settings-error').textContent=e.message;}
 };
 function navigate(sequence){
  if(!hasData||!client?.connected){status('未連線，無法控制主控');return;}
  if(!online){status('主控離線，無法切換');return;}
  const queued=sequence.cue,item=queued?sequence.route.find(e=>e.id===queued.id):sequence.nextSegment;
  if(!item||item.end||item.utility||!Number.isInteger(item.section)){status('此項目不是主控的歌詞頁，暫無投影對應');return;}
  client.send({type:'navigate',target:{songIndex:item.song,sectionIndex:item.section,page:queued?.page||0,routeIndex:sequence.route.findIndex(e=>e.id===item.id)}});
 }
 refresh();if(validSyncRoom(roomInput.value.trim().toLowerCase())&&urlInput.value.trim())get('leader-connect').click();else open();
 return {navigate};
}
