import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
const root=fileURLToPath(new URL('../cloudflare/',import.meta.url));
const require=createRequire(path.join(root,'package.json'));
const WebSocket=require('ws');
const remote=process.env.PRESENTSHOW_SYNC_URL?.replace(/\/$/,'');
const child=remote?null:spawn(process.execPath,[path.join(root,'node_modules','wrangler','bin','wrangler.js'),'dev','--local','--ip','127.0.0.1','--port','8799'],{cwd:root,env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});
let logs='';for(const stream of child?[child.stdout,child.stderr]:[])stream.on('data',chunk=>{logs+=chunk.toString();if(logs.length>30000)logs=logs.slice(-30000);});
const wait=ms=>new Promise(ok=>setTimeout(ok,ms)),sockets=[];
async function ready(){
 if(remote){assert.ok((await fetch(remote+'/health')).ok);return;}
 for(let i=0;i<120;i++){
  if(child.exitCode!==null)throw Error('Worker process stopped: '+logs);
  try{if((await fetch('http://127.0.0.1:8799/health')).ok)return;}catch{}
  await wait(250);
 }
 throw Error('Worker start timeout: '+logs);
}
const room=randomBytes(16).toString('hex'),key=randomBytes(32).toString('hex'),controlKey=randomBytes(32).toString('hex'),base=(remote?remote.replace(/^http/,'ws'):'ws://127.0.0.1:8799')+'/ws/'+room;
async function open(role,origin='https://present-show.vercel.app',control){
 const params=new URLSearchParams({role});
 if(role==='controller'){params.set('key',key);params.set('controlKey',controlKey);}
 if(control)params.set('control',control);
 const ws=new WebSocket(base+'?'+params,{headers:{Origin:origin}});
 sockets.push(ws);ws.messages=[];
 ws.received=new Map();
 ws.on('message',b=>{try{const message=JSON.parse(b.toString());if(message.type==='state')ws.received.set(message.revision,performance.now());ws.messages.push(message);}catch{}});
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
 return ws;
}
async function message(ws,type,predicate=()=>true){
 for(let n=0;n<200;n++){
  const found=ws.messages.find(m=>m.type===type&&predicate(m));
  if(found)return found;
  await wait(25);
 }
 throw Error('Missing '+type+': '+JSON.stringify(ws.messages).slice(-1000)+'\n'+logs.slice(-3000));
}
try{
 await ready();
 const host=await open('controller'),a=await open('leader',undefined,controlKey),b=await open('leader');
 const secondControl=await open('leader',undefined,controlKey);
 assert.equal((await message(a,'access')).canControl,true);assert.equal((await message(secondControl,'access')).canControl,true);assert.equal((await message(b,'access')).canControl,false);
 const denied=await open('leader',undefined,randomBytes(32).toString('hex'));await message(denied,'denied');
 const mobile=await open('leader','http://192.168.1.103:4173');
 await message(mobile,'presence',m=>m.controllerOnline===true);
 await message(a,'presence',m=>m.controllerOnline===true);
 const snapshot={schema:1,showName:'測試',songs:[{title:'歌',sections:[{sectionId:1,name:'Verse',kind:'verse',pages:['歌詞']}]}],plans:['Verse'],active:{singing:true,slideIndex:2,songIndex:0,sectionIndex:0,page:0,routeIndex:0}};
 host.send(JSON.stringify({type:'publish',snapshot}));
 assert.equal((await message(a,'state',m=>m.snapshot?.showName==='測試')).revision,1);
 assert.equal((await message(b,'state',m=>m.revision===1)).snapshot.active.slideIndex,2);
 await message(mobile,'state',m=>m.revision===1);
 for(const ws of [a,b,mobile,secondControl])ws.send(JSON.stringify({type:'ack',revision:1}));
 await message(host,'presence',m=>m.leaderCount===4&&m.controlCount===2&&m.viewCount===2);
 host.send(JSON.stringify({type:'ping'}));await message(host,'pong');
 const target={songIndex:0,sectionIndex:0,page:0,routeIndex:0};
 a.send(JSON.stringify({type:'navigate',target}));
 assert.deepEqual((await message(host,'navigate')).target,target);
 host.messages=[];b.send(JSON.stringify({type:'navigate',target}));await message(b,'error',m=>m.error.includes('瀏覽'));assert.ok(!host.messages.some(m=>m.type==='navigate'));
 secondControl.send(JSON.stringify({type:'navigate',target}));await message(host,'navigate');
 b.send(JSON.stringify({type:'publish',snapshot:{...snapshot,showName:'偽造'}}));
 await wait(100);
 host.messages=[];
 b.close();await new Promise(resolve=>b.once('close',resolve));
 await message(host,'presence',m=>m.leaderCount===3&&m.controlCount===2&&m.viewCount===1);
 const newLeader=await open('leader'),stored=await message(newLeader,'state',m=>m.revision===1);
 assert.equal(stored.snapshot.showName,'測試');
 newLeader.send(JSON.stringify({type:'ack',revision:1}));
 await message(host,'presence',m=>m.leaderCount===4&&m.controlCount===2&&m.viewCount===2);
 host.messages=[];
 host.send(JSON.stringify({type:'publish',snapshot:{...snapshot,active:{singing:false,slideIndex:0,area:'before'}}}));
 await message(a,'state',m=>m.revision===2);
 a.send(JSON.stringify({type:'navigate',target}));
 await message(a,'error',m=>m.error.includes('唯讀'));
 assert.ok(!host.messages.some(m=>m.type==='navigate'));
 const latencies=[];
 for(let n=0;n<10;n++){
  const sent=performance.now(),revision=n+3;
  host.send(JSON.stringify({type:'publish',snapshot:{...snapshot,active:{...snapshot.active,slideIndex:n}}}));
  await message(a,'state',m=>m.revision===revision);
  latencies.push(a.received.get(revision)-sent);
 }
 const late=await open('leader'),latest=await message(late,'state',m=>m.revision===12);
 assert.equal(latest.snapshot.active.slideIndex,9);
 console.log('Live relay timing ('+(remote?'production':'local')+' ms): '+JSON.stringify({median:latencies.toSorted((a,b)=>a-b)[5].toFixed(1),maximum:Math.max(...latencies).toFixed(1)}));
 console.log('Durable Object WebSocket integration passed: multiple shared controllers, multiple viewers, view-only enforcement, invalid-link rejection, separate counts, reconnect and readonly stages');
} finally{
 for(const ws of sockets)try{ws.close();}catch{}
 if(child){child.kill('SIGTERM');await wait(250);if(child.exitCode===null)child.kill('SIGKILL');}
}
