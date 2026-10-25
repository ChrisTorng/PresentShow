import test from 'node:test';
import assert from 'node:assert/strict';
import {compile} from '../src/config/model.js';
import {leaderSnapshot} from '../src/leader/leader-sync-data.js';
import {uiLabels} from '../src/config/ui-labels.js';
import {ControllerSync} from '../src/leader/controller-sync.js';

test('one-time labels reach the Leader snapshot without changing lyrics or exposing other variables',()=>{
 const raw={variables:{leaderName:' 帶領者 ',worshipName:'讚美',account:'private'},songs:'# 歌\n[副歌]\n敬拜主領我們',sequence:[{song:1}]};
 const show=compile(raw),snapshot=leaderSnapshot(show,raw);
 assert.deepEqual(snapshot.labels,{leader:'帶領者',worship:'讚美'});
 assert.equal(snapshot.songs[0].sections[0].pages[0],'敬拜主領我們');
 assert.ok(!JSON.stringify(snapshot).includes('private'));
 assert.deepEqual(uiLabels({leaderName:'',worshipName:12}),{leader:'主領',worship:'敬拜'});
});

test('synchronized with no Leaders is green; connected Leaders are red with separate access counts',()=>{
 const previous=globalThis.document;globalThis.document={querySelectorAll:()=>[]};
 const classes=new Set(),button={classList:{toggle:(key,value)=>value?classes.add(key):classes.delete(key)}};
 const sync=Object.create(ControllerSync.prototype);sync.get=()=>button;sync.getShow=()=>({labels:{leader:'帶領者',worship:'讚美'}});sync.client={connected:true};sync.leaderCount=0;
 try{
  sync.renderStatus();assert.equal(button.textContent,'帶領者 同步中 · 0');assert.ok(!classes.has('connected'));assert.ok(!classes.has('synced'));
  sync.synced=true;sync.renderStatus();assert.equal(button.textContent,'帶領者 已同步 · 0');assert.ok(classes.has('synced'));assert.ok(!classes.has('connected'));
  sync.leaderCount=2;sync.counts={control:1,view:1};sync.renderStatus();assert.equal(button.textContent,'帶領者 已連線 · 控制 1／瀏覽 1');assert.ok(classes.has('connected'));assert.ok(!classes.has('synced'));
  sync.client.connected=false;sync.renderStatus();assert.equal(button.textContent,'帶領者 未同步 · 0');assert.equal(classes.size,0);
 }finally{globalThis.document=previous;}
});
