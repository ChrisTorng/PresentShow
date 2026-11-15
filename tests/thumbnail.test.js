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
test('invitations show their actual access levels and carry only the matching credential',()=>{
 const args=['http://localhost:4173/','ws://127.0.0.1:8799','4','a'.repeat(32)];
 const cueKey='b'.repeat(64),playbackKey='c'.repeat(64);
 for(const [level,credential] of [['view',{}],['cue',{cue:cueKey}],['control',{playback:playbackKey}]]){
  const url=leaderInvitation(...args,{level,cueKey,playbackKey});
  assert.deepEqual(Object.fromEntries(url.searchParams),{room:args[3],ws:args[1],mode:level,...credential});
 }
 const id='d'.repeat(64);
 const url=leaderInvitation(...args,{level:'control',id,cueKey,playbackKey});
 assert.deepEqual(Object.fromEntries(url.searchParams),{room:args[3],ws:args[1],mode:'control',id});
});
test('start and end boundaries can be configured independently without recreating a response ending blank',()=>{
 const show=compile({pages:{a:{type:'text'},b:{type:'text'}},sections:[{id:'response',endBlank:false,sequence:['a']},{id:'closing',startBlank:false,sequence:['b']}]});
 assert.deepEqual(show.items.map(item=>item.id),['response-start','a','b','closing-end']);
});
