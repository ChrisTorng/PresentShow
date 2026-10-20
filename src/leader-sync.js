// ntfy provides WebSocket subscriptions and HTTP publishing on a public,
// host-independent relay. Do not send private presentation settings on public topics.
const encoder = new TextEncoder(), decoder = new TextDecoder();
const randomId = () => crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), b=>b.toString(16).padStart(2,'0')).join('');
export function newSyncRoom() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), b=>b.toString(16).padStart(2,'0')).join('');
}
export function validSyncRoom(room) { return /^[a-zA-Z0-9_-]{8,64}$/.test(room); }
export function createSyncClient({room,role,onStatus=()=>{},onMessage=()=>{},onOpen=()=>{}}) {
  if (!validSyncRoom(room)) throw new Error('連線代碼須為 8–64 個英數字、底線或連字號。');
  const topic = 'present-show-' + room, sender = randomId();
  const url = 'https://ntfy.sh/' + encodeURIComponent(topic);
  const buffers = new Map();
  let ws, retryTimer, active = true, open = false, retry = 0;
  let queue = Promise.resolve();
  const status = (message) => { if(active)onStatus(message); };
  function accept(envelope) {
    if (envelope?.protocol !== 'present-show/1' || envelope.sender === sender ||
        envelope.role !== (role === 'leader' ? 'controller' : 'leader') ||
        !Number.isInteger(envelope.total) || envelope.total < 1 || envelope.total > 128 ||
        !Number.isInteger(envelope.part) || envelope.part < 0 || envelope.part >= envelope.total ||
        typeof envelope.data !== 'string' || envelope.data.length > 2100) return;
    const key = envelope.sender + ':' + envelope.id;
    const now = Date.now();
    for (const [id,item] of buffers) if (now - item.at > 30000)buffers.delete(id);
    let item = buffers.get(key);
    if(!item){item = {at:now, parts:Array(envelope.total), total:envelope.total};buffers.set(key,item);}
    if(item.total !== envelope.total)return;
    item.parts[envelope.part] = envelope.data;
    if(item.parts.some(part => part === undefined))return;
    buffers.delete(key);
    try {
      const b64 = item.parts.join('');
      if(b64.length > 250000)return;
      const bytes = Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
      const message = JSON.parse(decoder.decode(bytes));
      if(message?.type === 'snapshot' || message?.type === 'request')onMessage(message);
    } catch(e) {status('同步資料無法解碼：' + e.message);}
  }
  function connect() {
    if(!active)return;
    status('連線中…');
    ws = new WebSocket('wss://ntfy.sh/' + encodeURIComponent(topic) + '/ws');
    ws.onopen = () => {open=true;retry=0;status('WebSocket 已連線');onOpen();};
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if(message?.event !== 'message')return;
        accept(JSON.parse(message.message));
      }catch { /* Ignore ntfy open/keepalive and unrelated topic messages. */ }
    };
    ws.onerror = () => {status('WebSocket 發生連線錯誤');};
    ws.onclose = () => {
      open=false;
      if(!active)return;
      const seconds=Math.min(30,Math.pow(2,Math.min(retry++,5)));
      status('連線中斷，' + seconds + ' 秒後重試');
      retryTimer=setTimeout(connect,seconds*1000);
    };
  }
  async function send(type,payload={}) {
    if(!active || !open)throw new Error('WebSocket 尚未連線。');
    const raw=encoder.encode(JSON.stringify({type,payload}));
    if(raw.length>160000)throw new Error('同步資料太大（超過 160 KB）。');
    let binary='';for(const b of raw)binary+=String.fromCharCode(b);
    const encoded=btoa(binary),chunkSize=1800;
    const total=Math.max(1,Math.ceil(encoded.length/chunkSize)),id=randomId();
    const packets=Array.from({length:total},(_,part)=>JSON.stringify({
      protocol:'present-show/1',role,sender,id,part,total,data:encoded.slice(part*chunkSize,(part+1)*chunkSize)
    }));
    const publish=async()=>{
      for(const packet of packets){
        const response=await fetch(url+'?cache=no&firebase=no',{method:'POST',body:packet});
        if(!response.ok)throw new Error('訊息發送失敗：HTTP '+response.status);
      }
    };
    const result=queue.catch(()=>{}).then(publish);
    queue=result;
    return result;
  }
  function close(){active=false;clearTimeout(retryTimer);ws?.close();buffers.clear();}
  connect();
  return {send,close,get connected(){return active && open;}};
}
