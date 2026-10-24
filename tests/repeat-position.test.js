import test from 'node:test';
import assert from 'node:assert/strict';
import {compile} from '../src/config/model.js';
import {leaderSnapshot} from '../src/leader/leader-sync-data.js';
import {expandedRoute} from '../src/leader/leader4-flow.js';
import {CueNavigation} from '../src/ui/navigation.js';
import {remapPosition} from '../src/ui/playback-position.js';
import {upgradeSongArrangements} from '../src/config/arrangement.js';
import {SingerSequence} from '../src/leader/singer-sequence.js';
const raw={songTitlePage:false,songs:'# 測試歌曲\n前奏-主歌-副歌x2-主歌-副歌x*-尾奏\n[主歌]\n甲\n\n乙\n[副歌]\n一\n\n二',sections:[{id:'worship',bookends:false,sequence:[{song:1}]}]};

test('unbounded chorus uses one route entry, wraps all its pages, counts iterations and exits by cue',()=>{
 const show=compile(raw),data=leaderSnapshot(show,raw),nav=new CueNavigation();
 const loop=data.route.find(part=>part.loop),start=loop.slideIndices[0],last=loop.slideIndices.at(-1);
 assert.equal(data.route.filter(part=>part.loop).length,1);
 assert.equal(expandedRoute(data.route,data.songs).filter(row=>row.loop).length,1);
 assert.equal(loop.slideIndices.length,2);
 let at=start;
 for(let count=0;count<40;count++){
  const next=nav.next(show.items,at);nav.advance(show.items,at,next);at=next;
 }
 assert.equal(at,start);assert.equal(nav.iteration(show.items,at),21);
 assert.equal(nav.next(show.items,last),start);
 const outro=show.items.findIndex(item=>item.song?.utility==='尾奏');
 nav.pending=outro;assert.equal(nav.next(show.items,last),outro);
 nav.advance(show.items,last,outro);nav.reset();assert.notEqual(nav.next(show.items,outro),start);
 const upgraded=upgradeSongArrangements(raw,show),again=compile(upgraded);
 assert.equal(again.items.filter(item=>item.loopNext!==undefined).length,1);
 const local=new SingerSequence(data.plans,data.songs,data.route);
 local.cursor=data.route.indexOf(loop);local.page=1;
 assert.equal(local.nextPage.item,local.current);assert.equal(local.nextPage.page,0);
});

test('editing lyrics and inserting a preceding page preserves both current and queued occurrences',()=>{
 const before=compile(raw),data=leaderSnapshot(before,raw);
 const choruses=data.route.filter(part=>part.section===1);
 const current=choruses[1].slideIndices[1],queued=choruses[2].slideIndices[0];
 const changed=structuredClone(raw);changed.songs=changed.songs.replace('甲\n\n乙','甲\n\n新增\n\n乙');
 changed.pages={pre1:{type:'text',label:'pre1 · 奉獻'}};
 changed.sections[0].sequence.unshift('pre1');
 const after=compile(changed);
 const currentAfter=remapPosition(before,after,current),queuedAfter=remapPosition(before,after,queued);
 assert.equal(after.items[currentAfter].blocks[0].text,'二');
 assert.ok(after.items[queuedAfter].loopGroup);
 assert.equal(after.items[queuedAfter].blocks[0].text,'一');
 assert.notEqual(currentAfter,current);
 assert.equal(after.items[0].label,'奉獻');
 assert.equal(remapPosition(before,after,null),null);
});
