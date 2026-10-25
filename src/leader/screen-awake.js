export class ScreenAwake {
 constructor({document:doc=globalThis.document,navigator:nav=globalThis.navigator,onStatus=()=>{}}={}){
  this.doc=doc;this.nav=nav;this.onStatus=onStatus;this.lock=null;this.pending=null;this.stopped=false;
  this.refresh=()=>this.request();
  doc.addEventListener('visibilitychange',this.refresh);doc.addEventListener('pointerdown',this.refresh);doc.addEventListener('fullscreenchange',this.refresh);
  this.request();
 }
 async request(){
  if(this.stopped||this.doc.visibilityState==='hidden'||this.lock||this.pending)return;
  if(!this.nav?.wakeLock){this.onStatus('常亮需支援的 HTTPS 瀏覽器',false);return;}
  try{
   this.pending=this.nav.wakeLock.request('screen');
   const lock=await this.pending;
   if(this.stopped){await lock.release();return;}
   this.lock=lock;this.onStatus('螢幕常亮',true);
   lock.addEventListener('release',()=>{
    if(this.lock===lock)this.lock=null;this.onStatus('點一下恢復常亮',false);
    if(!this.stopped&&this.doc.visibilityState==='visible')this.retry=setTimeout(()=>this.request(),500);
   });
  }catch{this.onStatus('點一下啟用螢幕常亮',false);}
  finally{this.pending=null;}
 }
 destroy(){this.stopped=true;clearTimeout(this.retry);for(const event of ['visibilitychange','pointerdown','fullscreenchange'])this.doc.removeEventListener(event,this.refresh);this.lock?.release();this.lock=null;}
}
