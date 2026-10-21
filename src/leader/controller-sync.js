import {createSyncClient,newSyncRoom,newHostKey,normalizeEndpoint} from './leader-sync.js';
import {leaderSnapshot} from './leader-sync-data.js';
import {parsePlan} from './singer-sequence.js';

export class ControllerSync {
 constructor({getShow,getRaw,getIndex,onTake}) {
  this.getShow=getShow;this.getRaw=getRaw;this.getIndex=getIndex;this.onTake=onTake;
  this.client=null;this.position=null;this.pending=null;
  const get=id=>document.getElementById(id);this.get=get;
  get('sync-endpoint').value=localStorage.getItem('present-show-relay-url')||'';
  get('sync-room').value=localStorage.getItem('present-show-host-room')||'';
  get('sync-toggle').onclick=()=>this.client?this.disconnect():this.connect();
  get('sync-variant').onchange=()=>this.renderInvite();
  get('sync-new-room').onclick=()=>{this.disconnect();localStorage.removeItem('present-show-host-room');localStorage.removeItem('present-show-host-key');get('sync-room').value='';this.renderInvite();this.status('已重設連線代碼');};
  get('sync-endpoint').addEventListener('change',()=>{try{localStorage.setItem('present-show-relay-url',normalizeEndpoint(get('sync-endpoint').value.trim()));}catch{}});
  this.renderInvite();
 }
 status(message){this.get('sync-status').textContent=message;}
 renderInvite() {
  const endpoint=this.client?.endpoint||this.get('sync-endpoint').value.trim(),room=this.get('sync-room').value.trim();
  this.get('sync-invitation').hidden=!endpoint||!room;
  if(!endpoint||!room)return;
  let base;
  try{base=normalizeEndpoint(endpoint);}catch{return;}
  const variant=['1','2','3'].includes(this.get('sync-variant').value)?this.get('sync-variant').value:'3';
  const url=new URL('./leader'+variant+'.html',location.href);
  url.searchParams.set('room',room);url.searchParams.set('ws',base);
  this.get('sync-leader-link').value=url.href;
  const node=this.get('sync-qr');node.replaceChildren();
  const draw=()=>{if(globalThis.QRCode){node.replaceChildren();new QRCode(node,{text:url.href,width:128,height:128,correctLevel:QRCode.CorrectLevel.M});}};
  if(globalThis.QRCode)draw();
  else if(!this.qrLoading) {
   this.qrLoading=true;
   const script=document.createElement('script');
   script.src='https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
   script.onload=()=>{this.qrLoading=false;this.renderInvite();};
   script.onerror=()=>{this.qrLoading=false;node.textContent='QR 函式庫載入失敗，請改用上方連結。';};
   document.head.append(script);
  }
 }
 connect() {
  try{
   const endpoint=normalizeEndpoint(this.get('sync-endpoint').value.trim());
   let room=localStorage.getItem('present-show-host-room'),key=localStorage.getItem('present-show-host-key');
   if(!room||!key){room=newSyncRoom();key=newHostKey();}
   this.client?.close();
   this.get('sync-endpoint').value=endpoint;this.get('sync-room').value=room;
   localStorage.setItem('present-show-relay-url',endpoint);
   localStorage.setItem('present-show-host-room',room);
   localStorage.setItem('present-show-host-key',key);
   this.client=createSyncClient({room,endpoint,role:'controller',hostKey:key,
    onStatus:s=>this.status(s),
    onOpen:()=>{this.publish();this.renderInvite();},
    onNavigate:t=>this.navigate(t),
    onPresence:online=>this.status(online?'主控 WebSocket 已連線':'主控 WebSocket 已中斷')
   });
   this.client.endpoint=endpoint;
   this.get('sync-toggle').textContent='停止同步';
   this.renderInvite();
  }catch(err){this.status(err.message);}
 }
 disconnect(){this.client?.close();this.client=null;this.get('sync-toggle').textContent='啟用同步';this.status('同步已停止');this.position=null;}
 snapshot() {
  const show=this.getShow(),raw=this.getRaw();
  if(!show||!raw)return null;
  const data=leaderSnapshot(show,raw),at=this.getIndex();
  let active={singing:false,slideIndex:at};
  const routeIndex=data.route.findIndex(entry=>entry.slideIndices.includes(at));
  if(routeIndex>=0){
    const part=data.route[routeIndex],routePage=part.slideIndices.indexOf(at);
    active={singing:true,slideIndex:at,songIndex:part.song,sectionIndex:part.section??-1,
      utility:part.utility||null,page:routePage,routeIndex};
  }
  this.position=active.singing?active:null;
  this.pending=null;
  return {...data,active};
 }
 publish(){
  if(!this.client?.connected)return;
  try{const s=this.snapshot();if(s)this.client.send({type:'publish',snapshot:s});}
  catch(e){this.status('無法同步設定：'+e.message);}
 }
 navigate(target){
  const show=this.getShow(),raw=this.getRaw();
  if(!show||!raw)return;
  try{
    const data=leaderSnapshot(show,raw);
    let index=-1;
    const planned=data.route[target.routeIndex];
    const same=planned?.song===target.songIndex &&
      (target.utility ? planned.utility===target.utility : planned.section===target.sectionIndex);
    if(same){
      const routePage=Number.isInteger(target.routePage)?target.routePage:
        planned.pageRefs.indexOf(target.page);
      index=planned.slideIndices[routePage]??-1;
    }
    if(index<0){
      const source=show.songs[target.songIndex],section=data.songs[target.songIndex]?.sections[target.sectionIndex];
      if(!source)return;
      index=show.items.findIndex(item=>item.song?.id===source.id
        &&!item.song.titlePage&&!item.song.boundary
        &&(target.utility?item.song.utility===target.utility:
          item.song.sectionId===section?.sectionId&&item.song.sectionPage===target.page+1));
    }
    if(index<0){this.status('指定段落不在主控的播放編排中');return;}
    this.pending=target;this.onTake(index);
  }catch(e){this.status('切換失敗：'+e.message);}
 }
}
