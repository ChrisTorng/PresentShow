import test from 'node:test';
import assert from 'node:assert/strict';
import {songs,defaultPlans} from '../src/leader/singer-data.js';
import {SingerSequence} from '../src/leader/singer-sequence.js';
import {fixedShortcutSlots,expandedRoute,navigationTarget,nextShortcutRow,songBrowseTarget} from '../src/leader/leader4-flow.js';

const plan = new SingerSequence(defaultPlans,songs);
const rows = expandedRoute(plan.route,songs);

test('Leader 4 shows the union of real sections and route utilities, without unused defaults',()=>{
 const slots=fixedShortcutSlots(songs,plan.route);
 const labels=slots.map(s=>s.label);
 assert.deepEqual(labels,['前奏','主歌1','主歌2','前副歌','副歌','副歌2','小副歌','間奏','尾句','尾奏']);
 assert.ok(!labels.includes('變奏'));
 const song1=new Set(rows.filter(r=>r.song===0).map(r=>r.slot));
 const song3=new Set(rows.filter(r=>r.song===2).map(r=>r.slot));
 assert.ok(song1.has('prechorus:1')&&!song3.has('prechorus:1'));
 assert.ok(song3.has('chorus:2')&&!song1.has('chorus:2'));
 assert.ok(!labels.includes('橋段'));
 const simple=[{sections:[{name:'主歌',kind:'verse',pages:['一句']},{name:'副歌',kind:'chorus',pages:['兩句']}]}];
 assert.deepEqual(fixedShortcutSlots(simple,[{song:0,utility:'前奏'}]).map(slot=>slot.label),['前奏','主歌','副歌']);
});

test('All playback occurrences are expanded in their actual sequence',()=>{
 assert.equal(rows.length,plan.route.length);
 const choruses=rows.filter(r=>r.song===0&&r.name==='副歌');
 assert.equal(choruses.length,5); // Every repeated chorus has its own visible occurrence.
 assert.deepEqual(choruses.map(r=>r.occurrence),[1,1,2,1,2]);
 assert.ok(choruses.every(r=>r.pages.length===2));
 const verse=rows.find(r=>r.song===0&&r.name==='主歌1');
 assert.equal(verse.pages.length,2);
 assert.deepEqual(verse.pages.map(page=>page.lines),songs[0].sections[0].pages.map(text=>text.split('\n')));
 const multiline=expandedRoute([{song:0,section:0,pageRefs:[0]}],[{sections:[{name:'主歌',kind:'verse',pages:['一行\n二行\n三行']}]}])[0];
 assert.equal(multiline.pages[0].lines.length,3);
 const instrumental=rows.find(r=>r.utility==='間奏');
 assert.equal(instrumental.pages[0].lines.length,1);
});

test('unnumbered and first numbered sections share a slot while each song supplies its label',()=>{
 const catalog=[{sections:[{name:'主歌1',kind:'verse'},{name:'主歌2',kind:'verse'}]},{sections:[{name:'主歌',kind:'verse'}]}];
 assert.deepEqual(fixedShortcutSlots(catalog,[],0).map(slot=>slot.label),['主歌1','主歌2']);
 assert.deepEqual(fixedShortcutSlots(catalog,[],1).map(slot=>slot.label),['主歌','主歌2']);
 const route=[{song:1,utility:'禱告'},{song:1,utility:'講話'}];
 assert.ok(fixedShortcutSlots(catalog,route).some(slot=>slot.label==='禱告'));
 assert.ok(fixedShortcutSlots(catalog,route).some(slot=>slot.label==='講話'));
 const utilities=[{song:0,utility:'前奏1'},{song:0,utility:'前奏2'},{song:1,utility:'前奏'}];
 const first=fixedShortcutSlots(catalog,utilities,0).filter(slot=>slot.category==='intro');
 const second=fixedShortcutSlots(catalog,utilities,1).filter(slot=>slot.category==='intro');
 assert.equal(first[0].id,second[0].id);assert.equal(first[0].label,'前奏1');assert.equal(second[0].label,'前奏');
});

test('song tabs return to the live position, remember past songs and start unplayed songs at the top',()=>{
 const active={singing:true,songIndex:1,routeIndex:8},history=new Map([[0,{routeIndex:5}],[1,{routeIndex:7}]]);
 assert.equal(songBrowseTarget(1,active,history),8);
 assert.equal(songBrowseTarget(0,active,history),5);
 assert.equal(songBrowseTarget(2,active,history),null);
});

test('Every clickable occurrence and lyrics page maps to the correct controller target',()=>{
 const choruses=rows.filter(r=>r.song===0&&r.name==='副歌');
 const a=navigationTarget(choruses[0],0),b=navigationTarget(choruses[1],0);
 assert.notEqual(a.routeIndex,b.routeIndex);
 assert.equal(a.page,b.page);
 const page2=navigationTarget(choruses[1],1);
 assert.equal(page2.routePage,1);
 assert.equal(page2.page,1);
 const after=nextShortcutRow(rows,'chorus:1',0,choruses[0].routeIndex);
 assert.equal(after.routeIndex,choruses[1].routeIndex);
 const utility=navigationTarget(rows.find(r=>r.utility==='間奏'));
 assert.equal(utility.sectionIndex,0); // Current deployed Worker rejects negative indices.
 assert.equal(utility.utility,'間奏');
 assert.equal(navigationTarget(rows.at(-1)),null);
});

test('Page-subsets preserve physical source page indices',()=>{
 const route=[{song:0,section:0,pageRefs:[1],slideIndices:[10]}];
 const row=expandedRoute(route,songs)[0];
 assert.equal(row.pages.length,1);
 assert.deepEqual(row.pages[0].lines,songs[0].sections[0].pages[1].split('\n'));
 assert.deepEqual(navigationTarget(row),{
  songIndex:0,sectionIndex:0,utility:null,routeIndex:0,routePage:0,page:1
 });
});
