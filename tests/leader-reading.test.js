import test from 'node:test';
import assert from 'node:assert/strict';
import {compile} from '../src/config/model.js';
import {leaderSnapshot,leaderPosition} from '../src/leader/leader-sync-data.js';
import {ControllerSync,leaderInvitation} from '../src/leader/controller-sync.js';
import {repeatRatio} from '../src/config/repeats.js';
import {CueNavigation} from '../src/ui/navigation.js';
const raw={songTitlePage:false,songs:'# 歌\n前奏-副歌x2-主歌-副歌x*-尾奏\n[主歌]\n主歌\n[副歌]\n第一頁\n\n第二頁',
 pages:{a:{type:'text',label:'會前'},b:{type:'text',label:'歡迎',blocks:[{kind:'title',text:'大家好'}]},c:{type:'web',label:'消息',src:'https://example.com'}},
 sections:[{id:'prayer',title:'會前',bookends:false,sequence:['a']},{id:'prep',title:'預備',bookends:false,sequence:['b']},{id:'worship',title:'敬拜',bookends:false,sequence:[{song:1}]},{id:'after',title:'報告消息',bookends:false,sequence:['c']}]};

test('LAN controllers share the HTTPS Leader for screen wake lock when using the production relay',()=>{
 const relay='wss://present-show-sync.christorng.workers.dev',room='a'.repeat(32);
 const secure=leaderInvitation('http://192.168.1.103:4173/',relay,'4',room);
 assert.equal(secure.origin,'https://present-show.vercel.app');assert.equal(secure.pathname,'/leader4.html');
 assert.equal(secure.searchParams.get('room'),room);assert.equal(secure.searchParams.get('ws'),relay);
 const local=leaderInvitation('http://localhost:4173/','ws://127.0.0.1:8799','4',room);
 assert.equal(local.origin,'http://localhost:4173');
 const custom=leaderInvitation('https://christorng.idv.tw/PresentShow/',relay,'4',room);
 assert.equal(custom.origin,'https://christorng.idv.tw');assert.equal(custom.pathname,'/PresentShow/leader4.html');
});

test('read-only views exclude premeeting and all worship slides, but retain current/next physical positions',()=>{
 const show=compile(raw),data=leaderSnapshot(show,raw);
 assert.deepEqual(data.readOnly.before.map(item=>item.name),['歡迎']);
 assert.deepEqual(data.readOnly.before[0].lines,['大家好']);
 assert.deepEqual(data.readOnly.after.map(item=>item.name),['消息']);
 assert.equal(leaderPosition(show,data,1).area,'before');
 assert.equal(leaderPosition(show,data,show.items.length-1).area,'after');
 assert.ok(![...data.readOnly.before,...data.readOnly.after].some(item=>show.items[item.slideIndex].song));
});

test('controller rejects Leader commands outside worship and caches static data across position changes',()=>{
 const show=compile(raw);let current=1,queued=null,status='';
 const sync=Object.create(ControllerSync.prototype);sync.getShow=()=>show;sync.getRaw=()=>raw;sync.getIndex=()=>current;
 sync.onCue=at=>{queued=at;};sync.status=message=>{status=message;};
 const a=sync.snapshot();sync.navigate({songIndex:0,sectionIndex:0,page:0,routeIndex:0});
 assert.equal(queued,null);assert.match(status,/唯讀/);
 current=show.items.findIndex(item=>item.song?.utility==='前奏');const b=sync.snapshot();
 assert.equal(a.route,b.route);assert.equal(a.readOnly,b.readOnly);assert.equal(a.contentVersion,b.contentVersion);
 sync.navigate({songIndex:0,utility:'前奏',sectionIndex:0,page:0,routeIndex:0});assert.equal(queued,current);
});

test('LAN HTTP controllers can cache sync content without the secure-context randomUUID API',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis.crypto,'randomUUID');
 Object.defineProperty(globalThis.crypto,'randomUUID',{value:undefined,configurable:true});
 try{
  const show=compile(raw),sync=Object.create(ControllerSync.prototype);sync.getShow=()=>show;sync.getRaw=()=>raw;sync.getIndex=()=>1;
  const snapshot=sync.snapshot();assert.equal(typeof snapshot.contentVersion,'string');assert.ok(snapshot.contentVersion.length>0);
 }finally{if(descriptor)Object.defineProperty(globalThis.crypto,'randomUUID',descriptor);else delete globalThis.crypto.randomUUID;}
});

test('controller and Leader share finite repeat ratios and predict the next infinite iteration',()=>{
 const show=compile(raw),data=leaderSnapshot(show,raw),nav=new CueNavigation();
 const repeated=data.route.filter(part=>part.section===1&&!part.loop);
 assert.deepEqual(repeated.map(part=>repeatRatio(part.repeat)),['1/2','2/2']);
 for(const part of repeated)assert.ok(part.slideIndices.every(index=>repeatRatio(show.items[index].song.repeat)===repeatRatio(part.repeat)));
 const loop=data.route.find(part=>part.loop),first=loop.slideIndices[0],last=loop.slideIndices.at(-1);
 assert.equal(nav.nextIteration(show.items,last,first),2);
 nav.advance(show.items,last,first);assert.equal(repeatRatio(show.items[first].song.repeat,nav.iteration(show.items,first)),'2/∞');
});
