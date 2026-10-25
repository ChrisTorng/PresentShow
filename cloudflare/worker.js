// Cloudflare Worker + SQLite-backed Durable Object. Deploy separately from the static website.
import {DurableObject} from 'cloudflare:workers';
import {validOrigin} from './origin-policy.js';

const ROOM = /^[a-f0-9]{32}$/;
const json = (body, status=200) => new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

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
  constructor(ctx,env) {
    super(ctx,env);this.ctx=ctx;
    ctx.blockConcurrencyWhile(async()=>{
      const saved=await ctx.storage.get(['snapshot','revision','controlKey']);
      this.saved=saved.get('snapshot');this.revision=saved.get('revision')||0;this.controlKey=saved.get('controlKey');
    });
  }
  send(ws,data) {try{ws.send(JSON.stringify(data));}catch{}}
  broadcast(data,filter=()=>true) {
    for(const ws of this.ctx.getWebSockets())if(filter(ws.deserializeAttachment()||{}))this.send(ws,data);
  }
  online() {return this.ctx.getWebSockets().some(ws=>ws.deserializeAttachment()?.role==='controller' && ws.readyState===1);}
  presence() {
    const leaders=this.ctx.getWebSockets().filter(ws=>{
      const state=ws.deserializeAttachment();return ws.readyState===1&&state?.role==='leader'&&state.synced;
    });
    const controlCount=leaders.filter(ws=>ws.deserializeAttachment().canControl===true).length;
    return {type:'presence',controllerOnline:this.online(),leaderCount:leaders.length,controlCount,viewCount:leaders.length-controlCount};
  }
  async fetch(request) {
    const url=new URL(request.url),role=url.searchParams.get('role'),key=url.searchParams.get('key')||'';
    if(role==='controller') {
      const owner=await this.ctx.storage.get('owner');
      if(owner && owner!==key)return json({error:'Room owned by another controller'},403);
      if(!owner)await this.ctx.storage.put('owner',key);
      const controlKey=url.searchParams.get('controlKey');
      if(controlKey){
        if(!/^[a-f0-9]{64}$/.test(controlKey))return json({error:'Invalid control key'},400);
        if(this.controlKey&&controlKey!==this.controlKey)return json({error:'Control key differs; reset the room to change it'},409);
        await this.ctx.storage.put('controlKey',controlKey);this.controlKey=controlKey;
      }
    }
    const token=url.searchParams.get('control');
    const canControl=role==='leader'&&!!token&&token===this.controlKey;
    const pair=new WebSocketPair(),[client,server]=Object.values(pair);
    this.ctx.acceptWebSocket(server);
    if(role==='leader'&&token&&!canControl){
      server.serializeAttachment({role:'rejected'});this.send(server,{type:'denied',error:'控制網址無效，請向主控取得新的網址。'});server.close(4403,'Invalid control link');
      return new Response(null,{status:101,webSocket:client});
    }
    server.serializeAttachment({role,canControl,uid:crypto.randomUUID()});
    if(role==='leader')this.send(server,{type:'access',canControl});
    if(this.saved)this.send(server,{type:'state',revision:this.revision,snapshot:this.saved});
    this.broadcast(this.presence());
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
      const revision=++this.revision;this.saved=s;
      this.broadcast({type:'state',revision,snapshot:s});
      // Live cues are transient: deliver immediately, persist the latest state
      // atomically without holding WebSocket output behind the storage gate.
      await this.ctx.storage.put({snapshot:s,revision},{allowUnconfirmed:true});
    } else if(msg?.type==='ack' && who.role==='leader' && Number.isInteger(msg.revision)) {
      const revision=this.revision;
      if(msg.revision===revision&&!who.synced){ws.serializeAttachment({...who,synced:true});this.broadcast(this.presence());}
    } else if(msg?.type==='ping') {
      this.send(ws,{type:'pong'});
    } else if(msg?.type==='navigate' && who.role==='leader') {
      if(!who.canControl)return this.send(ws,{type:'error',error:'此網址僅供瀏覽，無法控制主控'});
      if(!this.saved?.active?.singing)return this.send(ws,{type:'error',error:'目前為唯讀階段'});
      const t=msg.target;
      if(!t || !Number.isInteger(t.songIndex)||!Number.isInteger(t.sectionIndex)||
         !Number.isInteger(t.page)||t.songIndex<0||t.sectionIndex<0||t.page<0 ||
         t.songIndex>99||t.sectionIndex>999||t.page>999) return this.send(ws,{type:'error',error:'Invalid navigation target'});
      if(!this.online())return this.send(ws,{type:'error',error:'主控目前離線，無法切換投影片'});
      this.broadcast({type:'navigate',target:t,requestId:crypto.randomUUID()},a=>a.role==='controller');
    } else if(msg?.type==='request') {
      if(this.saved)this.send(ws,{type:'state',revision:this.revision,snapshot:this.saved});
    }
  }
  webSocketClose(ws) {
    try{ws.close();}catch{}
    this.broadcast(this.presence());
  }
  webSocketError(ws) {
    try{ws.close(1011,'WebSocket error');}catch{}
    this.broadcast(this.presence());
  }
}
