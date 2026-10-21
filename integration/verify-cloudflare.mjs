import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../cloudflare/',import.meta.url));
const require=createRequire(path.join(root,'package.json'));
const WebSocket=require('ws');
const child=spawn(process.execPath,[path.join(root,'node_modules','wrangler','bin','wrangler.js'),'dev','--local','--ip','127.0.0.1','--port','8799'],{cwd:root,env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});
let logs='';for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{logs+=chunk.toString();if(logs.length>30000)logs=logs.slice(-30000);});
const wait=ms=>new Promise(ok=>setTimeout(ok,ms)),sockets=[];
async function ready(){
 for(let i=0;i<120;i++){
  if(child.exitCode!==null)throw Error('Worker process stopped: '+logs);
  try{if((await fetch('http://127.0.0.1:8799/health')).ok)return;}catch{}
  await wait(250);
 }
 throw Error('Worker start timeout: '+logs);
}
const room='a'.repeat(32),key='b'.repeat(64),base='ws://127.0.0.1:8799/ws/'+room;
async function open(role){
 const params=new URLSearchParams({role});
 if(role==='controller')params.set('key',key);
 const ws=new WebSocket(base+'?'+params,{headers:{Origin:'https://present-show.vercel.app'}});
 sockets.push(ws);ws.messages=[];
 ws.on('message',b=>{try{ws.messages.push(JSON.parse(b.toString()));}catch{}});
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
 const host=await open('controller'),a=await open('leader'),b=await open('leader');
 await message(a,'presence',m=>m.controllerOnline===true);
 const snapshot={schema:1,showName:'測試',songs:[{title:'歌',sections:[{sectionId:1,name:'Verse',kind:'verse',pages:['歌詞']}]}],plans:['Verse'],active:{singing:true,slideIndex:2,songIndex:0,sectionIndex:0,page:0,routeIndex:0}};
 host.send(JSON.stringify({type:'publish',snapshot}));
 assert.equal((await message(a,'state',m=>m.snapshot?.showName==='測試')).revision,1);
 assert.equal((await message(b,'state',m=>m.revision===1)).snapshot.active.slideIndex,2);
 const target={songIndex:0,sectionIndex:0,page:0,routeIndex:0};
 a.send(JSON.stringify({type:'navigate',target}));
 assert.deepEqual((await message(host,'navigate')).target,target);
 b.send(JSON.stringify({type:'publish',snapshot:{...snapshot,showName:'偽造'}}));
 await wait(100);
 const newLeader=await open('leader'),stored=await message(newLeader,'state',m=>m.revision===1);
 assert.equal(stored.snapshot.showName,'測試');
 console.log('Durable Object WebSocket integration passed');
} finally{
 for(const ws of sockets)try{ws.close();}catch{}
 child.kill('SIGTERM');await wait(250);if(child.exitCode===null)child.kill('SIGKILL');
}
