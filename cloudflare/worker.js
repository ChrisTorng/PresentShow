// Cloudflare Worker + SQLite-backed Durable Object. Deploy separately from the static website.
import {DurableObject} from 'cloudflare:workers';

const ROOM = /^[a-f0-9]{32}$/;
const json = (body, status=200) => new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const validOrigin = (origin, env) => {
  if (!origin) return false;
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return true;
  return (env.ALLOWED_ORIGINS || 'https://christorng.idv.tw,http://christorng.idv.tw,https://present-show.vercel.app,https://christorng.github.io')
    .split(',').map(x=>x.trim()).includes(origin);
};

export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    if(url.pathname==='/health')return json({ok:true, service:'present-show-sync'});
    const match=/^\/ws\/([a-f0-9]{32})$/.exec(url.pathname);
    if(!match)return json({error:'Not found'},404);
    if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket required'},426);
    if(!validOrigin(request.headers.get('Origin'),env))return json({error:'Origin denied'},403);
    const role=url.searchParams.get('role');
    if(role!=='controller' && role!=='leader')return json({error:'Invalid role'},400);
    if(role==='controller' && !/^[a-f0-9]{64}$/.test(url.searchParams.get('key')||''))return json({error:'Invalid host key'},401);
    const id=env.SHOW_ROOMS.idFromName(match[1]);
    return env.SHOW_ROOMS.get(id).fetch(request);
  }
};

export class ShowRoom extends DurableObject {
  constructor(ctx,env) {super(ctx,env);this.ctx=ctx;}
  send(ws,data) {try{ws.send(JSON.stringify(data));}catch{}}
  broadcast(data,filter=()=>true) {
    for(const ws of this.ctx.getWebSockets())if(filter(ws.deserializeAttachment()||{}))this.send(ws,data);
  }
  online() {return this.ctx.getWebSockets().some(ws=>ws.deserializeAttachment()?.role==='controller' && ws.readyState===1);}
  async fetch(request) {
    const url=new URL(request.url),role=url.searchParams.get('role'),key=url.searchParams.get('key')||'';
    if(role==='controller') {
      const owner=await this.ctx.storage.get('owner');
      if(owner && owner!==key)return json({error:'Room owned by another controller'},403);
      if(!owner)await this.ctx.storage.put('owner',key);
    }
    const pair=new WebSocketPair(),[client,server]=Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({role,uid:crypto.randomUUID()});
    const saved=await this.ctx.storage.get('snapshot');
    if(saved)this.send(server,{type:'state',revision:await this.ctx.storage.get('revision')||0,snapshot:saved});
    this.broadcast({type:'presence',controllerOnline:this.online()});
    return new Response(null,{status:101,webSocket:client});
  }
  async webSocketMessage(ws,message) {
    const who=ws.deserializeAttachment()||{};
    if(typeof message!=='string'||message.length>220000)return this.send(ws,{type:'error',error:'Invalid message size'});
    let msg;
    try{msg=JSON.parse(message);}catch{return;}
    if(msg?.type==='publish' && who.role==='controller') {
      const s=msg.snapshot;
      if(!s||s.schema!==1||!Array.isArray(s.songs)||!Array.isArray(s.plans)||
         s.songs.length!==s.plans.length||s.songs.length>100||!s.active||
         !Number.isInteger(s.active.slideIndex)||JSON.stringify(s).length>180000)return this.send(ws,{type:'error',error:'Invalid snapshot'});
      const revision=(await this.ctx.storage.get('revision')||0)+1;
      await this.ctx.storage.put('snapshot',s);
      await this.ctx.storage.put('revision',revision);
      this.broadcast({type:'state',revision,snapshot:s});
    } else if(msg?.type==='navigate' && who.role==='leader') {
      const t=msg.target;
      if(!t || !Number.isInteger(t.songIndex)||!Number.isInteger(t.sectionIndex)||
         !Number.isInteger(t.page)||t.songIndex<0||t.sectionIndex<0||t.page<0 ||
         t.songIndex>99||t.sectionIndex>999||t.page>999) return this.send(ws,{type:'error',error:'Invalid navigation target'});
      if(!this.online())return this.send(ws,{type:'error',error:'主控目前離線，無法切換投影片'});
      this.broadcast({type:'navigate',target:t,requestId:crypto.randomUUID()},a=>a.role==='controller');
    } else if(msg?.type==='request') {
      const saved=await this.ctx.storage.get('snapshot');
      if(saved)this.send(ws,{type:'state',revision:await this.ctx.storage.get('revision')||0,snapshot:saved});
    }
  }
  webSocketClose(ws) {
    try{ws.close();}catch{}
    this.broadcast({type:'presence',controllerOnline:this.online()});
  }
  webSocketError(ws) {
    try{ws.close(1011,'WebSocket error');}catch{}
    this.broadcast({type:'presence',controllerOnline:this.online()});
  }
}
