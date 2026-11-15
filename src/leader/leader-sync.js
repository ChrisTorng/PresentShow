// Platform-independent WebSocket transport for Cloudflare Durable Objects.
const hex = size => Array.from(crypto.getRandomValues(new Uint8Array(size)),v=>v.toString(16).padStart(2,'0')).join('');
export const newSyncRoom = () => hex(16);
export const newHostKey = () => hex(32);
export const validSyncRoom = room => /^[a-f0-9]{32}$/.test(room);
export const accessLabels={view:'瀏覽',cue:'預約',control:'控制'};
export function normalizeEndpoint(value) {
  const url=new URL(value);
  if(!['wss:','ws:','https:','http:'].includes(url.protocol))throw Error('同步網址須為 Worker 的 HTTPS 或 WSS 網址');
  if(['http:','ws:'].includes(url.protocol)&&!['localhost','127.0.0.1'].includes(url.hostname))throw Error('公用同步服務必須使用 HTTPS／WSS');
  url.protocol=url.protocol==='https:'?'wss:':url.protocol==='http:'?'ws:':url.protocol;
  url.pathname=url.pathname.replace(/\/$/,'');url.search='';url.hash='';
  return url.toString().replace(/\/$/,'');
}
export function createSyncClient({endpoint,room,role,hostKey,controlKey,playbackKey,clientKey,invite,variant,onStatus=()=>{},onOpen=()=>{},onState=()=>{},onNavigate=()=>{},onPlayback=()=>{},onPresence=()=>{},onInvite=()=>{},onAccess=()=>{},onDenied=()=>{}}) {
  if(!validSyncRoom(room))throw Error('連線代碼必須是 32 位十六進位字元');
  if(role!=='leader' && role!=='controller')throw Error('Invalid role');
  const base=normalizeEndpoint(endpoint), params=new URLSearchParams({role});
  if(role==='controller') {
    if(!/^[a-f0-9]{64}$/.test(hostKey||''))throw Error('Invalid host key');
    params.set('key',hostKey);
    if(controlKey)params.set('controlKey',controlKey);
  }else{
    if(controlKey)params.set('control',controlKey);
    if(clientKey)params.set('client',clientKey);
    if(invite)params.set('invite',invite);
    if(variant)params.set('variant',variant);
  }
  if(playbackKey)params.set(role==='controller'?'playbackKey':'playback',playbackKey);
  const target=base+'/ws/'+room+'?'+params.toString();
  let socket,active=true,tries=0,timer,heartbeat,connected=false,revision=0,lastPong=0;
  const status=message=>{if(active)onStatus(message);};
  function connect() {
    if(!active)return;
    status('連線中…');
    try{socket=new WebSocket(target);}catch(e){status(e.message);schedule();return;}
    socket.onopen=()=>{
      connected=true;tries=0;lastPong=Date.now();status('已連線');onOpen();
      clearInterval(heartbeat);heartbeat=setInterval(()=>{
        if(Date.now()-lastPong>45000){socket.close();return;}
        send({type:'ping'});
      },15000);
    };
    socket.onmessage=e=>{
      if(!active)return;
      try {
        const msg=JSON.parse(e.data);
        if(msg.type==='state' && Number.isInteger(msg.revision) && msg.revision>=revision) {
          revision=msg.revision;const applied=onState(msg.snapshot,msg.revision);
          if(role==='leader'&&applied!==false)send({type:'ack',revision});
        } else if(msg.type==='navigate' && role==='controller')onNavigate(msg.target);
        else if(msg.type==='playback' && role==='controller')onPlayback(msg);
        else if(msg.type==='presence')onPresence(msg.controllerOnline,msg.leaderCount??0,{
          control:msg.cueCount===undefined?0:msg.controlCount??0,cue:msg.cueCount??msg.controlCount??0,view:msg.viewCount??msg.leaderCount??0},msg.clients,msg.clientInvites===true);
        else if(msg.type==='inviteReady'&&role==='controller')onInvite(msg);
        else if(msg.type==='access')onAccess(msg.level??(msg.canControl?'cue':'view'),msg.id);
        else if(msg.type==='denied'){connected=false;clearInterval(heartbeat);onDenied(msg.error);active=false;socket.close();}
        else if(msg.type==='pong')lastPong=Date.now();
        else if(msg.type==='error')status('同步錯誤：'+msg.error);
      }catch(err){status('接收資料錯誤：'+err.message);}
    };
    socket.onerror=()=>status('WebSocket 網路錯誤');
    socket.onclose=event=>{
      connected=false;clearInterval(heartbeat);
      if(!active)return;
      if(event.code===4001){active=false;onDenied('此邀請已在另一個視窗開啟，請使用主控目前顯示的新邀請。');}
      else schedule();
    };
  }
  function schedule() {
    const seconds=Math.min(20,2**Math.min(tries++,4));
    status('中斷，'+seconds+' 秒後重新連線');
    timer=setTimeout(connect,seconds*1000);
  }
  function send(message) {
    if(!connected || socket.readyState!==WebSocket.OPEN)return false;
    socket.send(JSON.stringify(message));return true;
  }
  function close(){active=false;connected=false;clearTimeout(timer);clearInterval(heartbeat);socket?.close();}
  connect();
  return {send,close,get connected(){return connected;}};
}
