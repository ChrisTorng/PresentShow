import test from 'node:test';
import assert from 'node:assert/strict';
import {songs,defaultPlans} from '../src/leader/singer-data.js';
import {SingerSequence} from '../src/leader/singer-sequence.js';
import {fixedShortcutSlots,expandedRoute,navigationTarget,nextShortcutRow} from '../src/leader/leader4-flow.js';

const plan = new SingerSequence(defaultPlans,songs);
const rows = expandedRoute(plan.route,songs);

test('Leader 4 keeps shortcut positions stable across all three songs',()=>{
 const slots=fixedShortcutSlots(songs);
 const labels=slots.map(s=>s.label);
 assert.deepEqual(labels,['前奏','主歌1','主歌2','前副歌','副歌','副歌2','小副歌','橋段','間奏','尾句','尾奏']);
 assert.ok(!labels.includes('變奏'));
 const song1=new Set(rows.filter(r=>r.song===0).map(r=>r.slot));
 const song3=new Set(rows.filter(r=>r.song===2).map(r=>r.slot));
 assert.ok(song1.has('prechorus:1')&&!song3.has('prechorus:1'));
 assert.ok(song3.has('chorus:2')&&!song1.has('chorus:2'));
 assert.ok(slots.some(slot=>slot.label==='橋段')); // Present but disabled in all sample songs.
});

test('All playback occurrences are expanded in their actual sequence',()=>{
 assert.equal(rows.length,plan.route.length);
 const choruses=rows.filter(r=>r.song===0&&r.name==='副歌');
 assert.equal(choruses.length,5); // Every repeated chorus has its own visible occurrence.
 assert.deepEqual(choruses.map(r=>r.occurrence),[1,2,3,4,5]);
 assert.ok(choruses.every(r=>r.pages.length===2));
 const verse=rows.find(r=>r.song===0&&r.name==='主歌 1');
 assert.equal(verse.pages.length,2);
 assert.deepEqual(verse.pages.map(page=>page.lines),songs[0].sections[0].pages.map(text=>text.split('\n')));
 const multiline=expandedRoute([{song:0,section:0,pageRefs:[0]}],[{sections:[{name:'主歌',kind:'verse',pages:['一行\n二行\n三行']}]}])[0];
 assert.equal(multiline.pages[0].lines.length,3);
 const instrumental=rows.find(r=>r.utility==='間奏');
 assert.equal(instrumental.pages[0].lines.length,1);
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
