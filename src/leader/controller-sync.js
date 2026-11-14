import {accessLabels,createSyncClient,newSyncRoom,newHostKey,normalizeEndpoint} from './leader-sync.js';
import {leaderSnapshot,leaderPosition} from './leader-sync-data.js';
import {applyUILabels,uiLabels} from '../config/ui-labels.js';

export function leaderInvitation(href,endpoint,variant,room,{canControl=false,controlKey}={}){
 const source=new URL(href),relay=new URL(endpoint);
 // A local controller can still share the HTTPS client through the public relay,
 // so phones have a secure context for screen wake lock without local TLS setup.
 const base=source.protocol==='http:'&&relay.protocol==='wss:'&&relay.hostname==='present-show-sync.christorng.workers.dev'
   ? 'https://present-show.vercel.app/' : source.href;
 const url=new URL('./leader'+variant+'.html',base);
 url.searchParams.set('room',room);url.searchParams.set('ws',endpoint);
 url.searchParams.set('mode',canControl?'control':'view');
 if(canControl&&controlKey)url.searchParams.set('control',controlKey);
 return url;
}

export class ControllerSync {
 constructor({getShow,getRaw,getIndex,getCue,getNext,getPrevious,getPlayback,getIteration,onCue,onPlayback}) {
  this.getShow=getShow;this.getRaw=getRaw;this.getIndex=getIndex;this.getCue=getCue;this.getNext=getNext;this.onCue=onCue;
  this.getIteration=getIteration;
  this.getPrevious=getPrevious;this.getPlayback=getPlayback;this.onPlayback=onPlayback;
  this.client=null;this.position=null;this.pending=null;
  this.synced=false;this.leaderCount=0;this.counts={control:0,cue:0,view:0};
  const get=id=>document.getElementById(id);this.get=get;
  get('sync-endpoint').value=localStorage.getItem('present-show-relay-url')||'https://present-show-sync.christorng.workers.dev';
  get('sync-room').value=localStorage.getItem('present-show-host-room')||'';
  get('sync-toggle').onclick=()=>this.client?this.disconnect():this.connect();
  get('sync-variant').onchange=()=>this.renderInvite();
  get('sync-control').onchange=()=>this.renderInvite();
  get('sync-new-room').onclick=()=>{this.disconnect();localStorage.removeItem('present-show-host-room');localStorage.removeItem('present-show-host-key');localStorage.removeItem('present-show-host-control-key');get('sync-room').value='';this.renderInvite();this.status('已重設連線代碼');};
  get('sync-endpoint').addEventListener('change',()=>{try{localStorage.setItem('present-show-relay-url',normalizeEndpoint(get('sync-endpoint').value.trim()));}catch{}});
  this.renderStatus();this.renderInvite();
 }
 status(message){this.get('sync-status').textContent=message;this.renderStatus();}
 renderStatus(){
  const button=this.get('sync-menu-button');
  const labels=this.getShow()?.labels||uiLabels();applyUILabels(document,labels);
  const connected=!!this.client?.connected;
  const synced=this.synced&&!!this.client?.connected;
  const joined=connected&&this.leaderCount>0,counts=this.counts;
  button.classList.toggle('synced',synced&&!joined);
  button.classList.toggle('connected',joined);
  const summary=`瀏覽 ${counts.view}／預約 ${counts.cue}／控制 ${counts.control}`;
  button.textContent=`${labels.leader} ${joined?'已連線':synced?'已同步':connected?'同步中':'未同步'} · ${joined?summary:0}`;
  button.title=joined?summary:`${labels.leader}即時同步設定`;
 }
 renderClients(clients){
  const list=this.get('sync-clients'),empty=this.get('sync-clients-empty');
  empty.textContent=clients===undefined?'同步服務需要更新才能管理個別連線。':'目前沒有連線。';
  empty.hidden=!!clients?.length;
  const ids=new Set((clients||[]).map(client=>client.id));
  for(const row of list.children){if(!ids.has(row.dataset.id))row.remove();}
  for(const {id,variant,level,synced} of clients||[]){
   let row=[...list.children].find(element=>element.dataset.id===id);
   if(!row){
    row=document.createElement('label');row.dataset.id=id;
    const name=document.createElement('span'),select=document.createElement('select');
    for(const [value,label] of Object.entries(accessLabels)){
     if(value!=='control'||variant==='4')select.add(new Option(label,value));
    }
    select.onchange=()=>this.client?.send({type:'setAccess',id,level:select.value});
    row.append(name,select);list.append(row);
   }
   const name=`${this.getShow()?.labels?.leader||uiLabels().leader}${variant?' '+variant:''} · ${id.slice(0,8)}`;
   row.firstChild.textContent=name+(synced?'':'（同步中）');
   row.lastChild.setAttribute('aria-label',name+' 權限');row.lastChild.value=level;
  }
 }
 renderInvite() {
  const endpoint=this.client?.endpoint||this.get('sync-endpoint').value.trim(),room=this.get('sync-room').value.trim();
  this.get('sync-invitation').hidden=!endpoint||!room;
  if(!endpoint||!room)return;
  let base;
  try{base=normalizeEndpoint(endpoint);}catch{return;}
  const variant=['1','2','3','4'].includes(this.get('sync-variant').value)?this.get('sync-variant').value:'4';
  const canControl=this.get('sync-control').checked;
  let controlKey=localStorage.getItem('present-show-host-control-key');
  if(!controlKey){controlKey=newHostKey();localStorage.setItem('present-show-host-control-key',controlKey);}
  const url=leaderInvitation(location.href,base,variant,room,{canControl,controlKey});
  this.get('sync-link-mode').textContent=canControl?'預約網址 · 可多人共用':'瀏覽網址 · 可多人共用';
  this.get('sync-leader-link').value=url.href;
  this.get('sync-leader-open').href=url.href;
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
   const controlKey=localStorage.getItem('present-show-host-control-key')||newHostKey();
   localStorage.setItem('present-show-host-control-key',controlKey);
   this.client?.close();
   this.get('sync-endpoint').value=endpoint;this.get('sync-room').value=room;
   localStorage.setItem('present-show-relay-url',endpoint);
   localStorage.setItem('present-show-host-room',room);
   localStorage.setItem('present-show-host-key',key);
   this.client=createSyncClient({room,endpoint,role:'controller',hostKey:key,controlKey,
    onStatus:s=>{if(s.includes('中斷')||s==='WebSocket 網路錯誤'){this.synced=false;this.leaderCount=0;this.renderClients([]);}this.status(s);},
    onOpen:()=>{this.supportsAccess=false;this.publish();this.renderInvite();},
    onNavigate:t=>this.navigate(t),
    onPlayback:command=>this.playback(command),
    onState:()=>{this.synced=true;this.status('主控 WebSocket 已同步');},
    onPresence:(online,count,counts,clients)=>{
     const supportsAccess=Array.isArray(clients),changed=this.supportsAccess!==supportsAccess;
     this.supportsAccess=supportsAccess;this.leaderCount=count;this.counts=counts;this.renderClients(clients);
     this.status(online?'主控 WebSocket 已連線':'主控 WebSocket 已中斷');if(changed&&supportsAccess)this.publish();
    }
   });
   this.client.endpoint=endpoint;
   this.get('sync-toggle').textContent='停止同步';
   this.renderInvite();
  }catch(err){this.status(err.message);}
 }
 disconnect(){this.client?.close();this.client=null;this.synced=false;this.supportsAccess=false;this.leaderCount=0;this.renderClients([]);this.get('sync-toggle').textContent='啟用同步';this.status('同步已停止');this.position=null;}
 data(show=this.getShow(),raw=this.getRaw()){
  if(this.cachedShow!==show||this.cachedRaw!==raw){this.cachedShow=show;this.cachedRaw=raw;this.cachedData={...leaderSnapshot(show,raw),contentVersion:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`};}
  return this.cachedData;
 }
 rebase(previous,next,map){
  if(this.historyShow!==previous)return;
  const oldData=leaderSnapshot(previous,this.getRaw()),newData=leaderSnapshot(next,{}),history={};
  for(const position of Object.values(this.history||{})){
   const at=oldData.route[position.routeIndex]?.slideIndices[position.page||0];
   const mapped=map(at),target=mapped===null?null:leaderPosition(next,newData,mapped);
   if(target?.singing)history[target.songIndex]={routeIndex:target.routeIndex,page:target.page};
  }
  this.historyShow=next;this.history=history;
 }
 snapshot() {
  const show=this.getShow(),raw=this.getRaw();
  if(!show||!raw)return null;
  const data=this.data(show,raw),at=this.getIndex();
  const active=leaderPosition(show,data,at);
  if(active.singing)active.iteration=this.getIteration?.(at)||1;
  if(this.historyShow!==show){this.historyShow=show;this.history={};}
  if(active.singing)this.history[active.songIndex]={routeIndex:active.routeIndex,page:active.page};
  this.position=active.singing?active:null;
  this.pending=null;
  const cueIndex=this.getCue?.();
  const cue=Number.isInteger(cueIndex)?leaderPosition(show,data,cueIndex):null;
  const nextIndex=this.getNext?.()??Math.min(at+1,show.items.length-1);
  const next=leaderPosition(show,data,cueIndex??nextIndex);
  const previousIndex=this.getPrevious?.();
  const previous=Number.isInteger(previousIndex)?leaderPosition(show,data,previousIndex):null;
  return {...data,active,cue,next,previous,playback:this.getPlayback?.(),slideCount:show.items.length,history:{...this.history},sentAt:Date.now()};
 }
 playback({action,slideIndex,contentVersion}){
  const show=this.getShow(),raw=this.getRaw();if(!show||!raw)return;
  if(action==='next'||action==='previous')this.onPlayback(action);
  else if(action==='jump'&&Number.isInteger(slideIndex)&&show.items[slideIndex]&&contentVersion===this.data(show,raw).contentVersion){
   this.onPlayback(action,slideIndex);
  }
 }
 publish(){
  try{
   const s=this.snapshot();if(!s||!this.client?.connected)return;
   if(!this.supportsAccess)delete s.extraPages;
   this.client.send({type:'publish',snapshot:s});
  }
  catch(e){this.status('無法同步設定：'+e.message);}
 }
 navigate(target){
  const show=this.getShow(),raw=this.getRaw();
  if(!show||!raw)return;
  try{
    const data=this.data(show,raw);
    if(!leaderPosition(show,data,this.getIndex()).singing){this.status(`目前為唯讀階段，${show.labels?.leader||'主領'}無法修改主控。`);return;}
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
    this.pending=target;this.onCue(index);
  }catch(e){this.status('預選失敗：'+e.message);}
 }
}
