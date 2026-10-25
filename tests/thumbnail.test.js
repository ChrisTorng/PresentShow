import test from 'node:test';
import assert from 'node:assert/strict';
import {compile} from '../src/config/model.js';
import {thumbnailLabel} from '../src/ui/grid.js';
import {leaderInvitation} from '../src/leader/controller-sync.js';
test('thumbnail repeat counters remain separate from the physical pages in finite and infinite choruses',()=>{
 const show=compile({songTitlePage:false,songs:'# 歌\n副歌x2-主歌-副歌x*\n[主歌]\n主歌\n[副歌]\n一\n\n二\n\n三',sequence:[{song:1}]});
 assert.deepEqual(show.items.slice(0,6).map(item=>thumbnailLabel(item)),['副歌 · 1/2','副歌 · 1/2','副歌 · 1/2','副歌 · 2/2','副歌 · 2/2','副歌 · 2/2']);
 assert.deepEqual(show.items.slice(0,3).map(item=>[item.song.sectionPage,item.song.sectionPages]),[[1,3],[2,3],[3,3]]);
 assert.equal(thumbnailLabel(show.items.at(-1),2),'副歌 · 2/∞');
});
test('view-only invitations never contain the control credential and use distinct URLs',()=>{
 const args=['http://localhost:4173/','ws://127.0.0.1:8799','4','a'.repeat(32)];
 const controlled=leaderInvitation(...args,{canControl:true,controlKey:'b'.repeat(64)});
 const view=leaderInvitation(...args,{canControl:false,controlKey:'b'.repeat(64)});
 assert.equal(controlled.searchParams.get('control'),'b'.repeat(64));assert.equal(controlled.searchParams.get('mode'),'control');
 assert.equal(view.searchParams.get('mode'),'view');assert.equal(view.searchParams.has('control'),false);assert.notEqual(view.href,controlled.href);
});
test('start and end boundaries can be configured independently without recreating a response ending blank',()=>{
 const show=compile({pages:{a:{type:'text'},b:{type:'text'}},sections:[{id:'response',endBlank:false,sequence:['a']},{id:'closing',startBlank:false,sequence:['b']}]});
 assert.deepEqual(show.items.map(item=>item.id),['response-start','a','b','closing-end']);
});
