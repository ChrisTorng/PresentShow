import test from 'node:test';
import assert from 'node:assert/strict';
import {compile} from '../src/config/model.js';
import {leaderSnapshot,leaderPosition} from '../src/leader/leader-sync-data.js';
import {SingerSequence,parsePlan,pagesOf} from '../src/leader/singer-sequence.js';
import {ControllerSync} from '../src/leader/controller-sync.js';
import {songs,defaultPlans} from '../src/leader/singer-data.js';

function fixture() {
 const lyrics=songs.map(song=>'# '+song.title+'\n\n'+song.sections.map(s=>'['+s.name+']\n'+s.pages.join('\n\n')).join('\n\n')).join('\n\n');
 const raw={name:'測試',songs:lyrics,songTitlePage:false,leaderPlans:Object.fromEntries(defaultPlans.map((p,i)=>[i+1,p])),sections:songs.map((s,i)=>({id:'song'+i,title:s.title,sequence:[{song:i+1}]}))};
 return {raw,show:compile(raw)};
}

test('Leader snapshot uses controller songs and identical prototype play plans',()=>{
 const {raw,show}=fixture(),data=leaderSnapshot(show,raw);
 assert.equal(data.songs.length,3);
 assert.deepEqual(data.plans,defaultPlans);
 assert.equal(data.songs[0].title,'高聲唱');
 assert.equal(data.songs[0].sections[0].sectionId,1);
 assert.equal(data.songs[0].sections[0].pages[0],songs[0].sections[0].pages[0]);
 const sequence=new SingerSequence(data.plans,data.songs);
 assert.equal(sequence.route[1].section,0);
 assert.equal(parsePlan(0,data.plans[0],data.songs).length,16);
 assert.equal(pagesOf(sequence.route[1],data.songs).length,2);
});

test('Leader selections queue actual slides without advancing playback, even on repeated clicks',()=>{
 const {raw,show}=fixture();
 let current=show.items.findIndex(item=>item.song?.id===1&&item.song?.sectionId===1&&item.song?.sectionPage===1);
 let main=Object.create(ControllerSync.prototype);
 main.getShow=()=>show;main.getRaw=()=>raw;main.getIndex=()=>current;
 main.position=null;main.pending=null;main.status=msg=>{throw Error(msg);};
 let queued=null;main.getCue=()=>queued;
 main.onCue=next=>{queued=next;};
 const initial=main.snapshot();
 assert.equal(initial.active.singing,true);
 assert.equal(initial.active.songIndex,0);
 assert.equal(initial.active.sectionIndex,0);
 assert.equal(initial.active.routeIndex,1);
 main.navigate({songIndex:0,sectionIndex:2,page:1,routeIndex:3});
 main.navigate({songIndex:0,sectionIndex:2,page:1,routeIndex:3});
 assert.equal(main.snapshot().active.routeIndex,1);
 assert.equal(main.snapshot().cue.routeIndex,3);
 current=queued;queued=null;
 const next=main.snapshot();
 assert.equal(next.active.sectionIndex,2);
 assert.equal(next.active.page,1);
 assert.equal(next.active.routeIndex,3);
 assert.equal(show.items[current].song.sectionPage,2);
 // A repeated chorus now has a distinct physical slide in the controller.
 // Both occurrences reference the same original lyric source.
 const occurrences=show.items.map((item,i)=>({item,i})).filter(({item})=>item.song?.id===1&&item.song?.sectionId===3&&item.song?.sectionPage===1);
 assert.ok(occurrences.length>=3);
 current=occurrences[1].i;
 assert.equal(main.snapshot().active.routeIndex,7);
 assert.equal(occurrences[0].item.blocks[0].text,occurrences[1].item.blocks[0].text);
 current=0;
 assert.equal(main.snapshot().active.singing,true); // Opening song blank is worship.
});

test('worship stays visible through three songs, their titles, blanks and instrumentals',()=>{
 const raw={songs:'# 甲\n[Verse]\n甲歌詞\n\n# 乙\n[Verse]\n乙歌詞\n\n# 丙\n[Verse]\n丙歌詞',
  pages:{blank:{type:'blank'}},leaderPlans:{1:'前奏-主歌-尾奏',2:'前奏-主歌-尾奏',3:'前奏-主歌-尾奏'},
  sections:[{sequence:[{text:'開場'}]},{sequence:[{song:1},'blank',{song:2}]},{sequence:[{song:3}]},{sequence:[{text:'信息'}]}]};
 const show=compile(raw),data=leaderSnapshot(show,raw);
 for (const section of show.sections.slice(1,3)) for(let at=section.start;at<=section.end;at++) {
  const position=leaderPosition(show,data,at);
  assert.equal(position.singing,true,'worship slide '+at);
  assert.ok(data.route[position.routeIndex]);
 }
 for(const at of [show.sections[0].start,show.sections.at(-1).end]) assert.equal(leaderPosition(show,data,at).singing,false);
});

test('Custom songs without matching prototype receive a valid fallback plan',()=>{
 const raw={name:'測試',songs:'# 自訂一首歌\n[Verse]\n一句話',sections:[{id:'s',title:'歌',sequence:[{song:1}]}]};
 const data=leaderSnapshot(compile(raw),raw);
 assert.equal(data.songs.length,1);
 assert.equal(parsePlan(0,data.plans[0],data.songs).length,3);
});

test('controller shares the last played position of earlier songs with newly joined Leaders',()=>{
 const {raw,show}=fixture();let current=show.items.findIndex(item=>item.song?.id===1&&item.song.sectionPage===2);
 const sync=Object.create(ControllerSync.prototype);sync.getShow=()=>show;sync.getRaw=()=>raw;sync.getIndex=()=>current;
 const first=sync.snapshot();
 current=show.items.findIndex(item=>item.song?.id===2&&item.song.sectionPage===1);
 const second=sync.snapshot();
 assert.equal(second.history[0].routeIndex,first.active.routeIndex);assert.equal(second.history[0].page,1);
 assert.equal(second.history[1].routeIndex,second.active.routeIndex);
 // Offline playback updates history without sending any configuration.
 current=show.items.findIndex(item=>item.song?.id===3&&item.song.sectionPage===1);
 sync.publish();assert.equal(sync.history[2].routeIndex,sync.snapshot().active.routeIndex);
});
