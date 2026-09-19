import test from 'node:test';
import assert from 'node:assert/strict';
import {compile} from '../src/config/model.js';
import {CueNavigation} from '../src/ui/navigation.js';
const raw={songs:'# Song\n[Verse]\nOne\n\nTwo\n\n[Chorus]\nThree\n\n[Verse]\nFour',sections:[{title:'Song',sequence:[{song:1}]},{title:'Reading',sequence:[{text:'First paragraph\n\nSecond paragraph'}]}],songMeta:{1:{title:'標題',english:'Title',credit:'Artist'}}};
const {items}=compile(raw),first=items.findIndex(p=>p.song?.sectionLabel==='Verse 1-1'),second=items.findIndex(p=>p.song?.sectionLabel==='Verse 2');
test('slow lowercase presses stage distinct verses and never take; fast repeat takes staged cue',()=>{
  const nav=new CueNavigation();assert.equal(nav.shortcut(items,first,'v',1000),null);assert.equal(nav.pending,second);
  assert.equal(nav.shortcut(items,first,'v',2000),null);assert.equal(nav.pending,first);
  assert.equal(nav.shortcut(items,first,'v',2150),first);assert.equal(nav.pending,null);
});
test('uppercase takes immediately; mouse requires two selections of the same card regardless of time',()=>{
  const nav=new CueNavigation();assert.equal(nav.shortcut(items,first,'V',0),second);
  assert.equal(nav.click(4),null);assert.equal(nav.click(5),null);assert.equal(nav.next(items,first),5);assert.equal(nav.click(5),5);assert.equal(nav.pending,null);
  nav.click(4);nav.reset();assert.equal(nav.next(items,first),first+1);
});
test('cue targets stay in current song and continuation pages have no shortcut',()=>{
  const nav=new CueNavigation();assert.equal(items[first+1].song.sectionStart,false);assert.equal(items[first+1].song.sectionLabel,'Verse 1-2');
  nav.click(items.length-1);assert.equal(nav.target(items,first,'v'),second);assert.equal(nav.shortcut(items,first,'b',0),null);
});
test('song titles retain credits, lyrics share width measurements, reading pages count paragraphs',()=>{
  const title=items.find(p=>p.layout==='song-title');assert.equal(title.blocks[0].text,'標題');assert.equal(title.credit,'Artist');
  assert.deepEqual(items[first].lyricLines,items[second].lyricLines);
  assert.deepEqual(items.filter(p=>p.layout==='reading').map(p=>p.pagination),['1/2','2/2']);
  assert.ok(items.filter(p=>p.type==='blank').every(p=>p.label===''));
});
