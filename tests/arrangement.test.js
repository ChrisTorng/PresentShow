import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compile} from '../src/config/model.js';
import {parseConfig} from '../src/config/format.js';
import {parseSongs} from '../src/config/songs.js';
import {editArrangement,upgradeSongArrangements} from '../src/config/arrangement.js';
import {replaceSongText} from '../src/config/editing.js';
import {leaderSnapshot} from '../src/leader/leader-sync-data.js';
import {ControllerSync} from '../src/leader/controller-sync.js';

const raw={
  name:'真正的原主控',
  songTitlePage:false,
  songs:'# 歌曲甲\n\n[Verse 1]\n甲1\n甲2\n\n[Chorus]\n副歌第一行\n副歌第二行\n\n[Verse 2]\n乙1\n乙2',
  leaderPlans:{1:'前奏-主歌1-副歌-主歌2-副歌-副歌-尾奏'},
  sections:[{id:'opening',bookends:false,sequence:[{text:'開始'}]},
    {id:'song',bookends:false,sequence:[{song:1}]},
    {id:'closing',bookends:false,sequence:[{text:'結束'}]}]
};

test('section labels in English and Chinese become identical Chinese display names',()=>{
 const a=parseSongs(raw.songs)[0].pages.map(page=>page.sectionLabel);
 const b=parseSongs(raw.songs.replace('[Verse 1]','[主歌1]').replace('[Chorus]','[副歌]').replace('[Verse 2]','[主歌2]'))[0].pages.map(page=>page.sectionLabel);
 assert.deepEqual(a,b);
 assert.deepEqual(a,['主歌1','副歌','主歌2']);
});
test('original controller expands repeat order without duplicating source lyrics',()=>{
 const show=compile(raw),pages=show.items.filter(item=>item.song&&!item.song.titlePage);
 assert.deepEqual(pages.map(item=>item.song.sectionLabel||item.song.utility),['前奏','主歌1','副歌','主歌2','副歌','副歌','尾奏']);
 assert.equal(show.songs[0].pages.length,3);
 assert.equal(show.items[0].blocks[0].text,'開始');
 assert.equal(show.items.at(-1).blocks[0].text,'結束');
 const choruses=pages.filter(item=>item.song.sectionLabel==='副歌');
 assert.equal(choruses.length,3);
 assert.equal(new Set(choruses.map(item=>item.blocks[0].text)).size,1);
 assert.equal(new Set(choruses.map(item=>item.id)).size,3);
 const snapshot=leaderSnapshot(show,raw);
 assert.equal(snapshot.route.length,7);
 assert.equal(snapshot.route[5].section,snapshot.route[2].section);
 assert.notEqual(snapshot.route[5].slideIndices[0],snapshot.route[2].slideIndices[0]);
});
test('the Leader selects precisely the requested repeated occurrence',()=>{
 const show=compile(raw),snapshot=leaderSnapshot(show,raw);
 let actual=show.items.findIndex(item=>item.song?.utility==='前奏');
 const sync=Object.create(ControllerSync.prototype);
 sync.getShow=()=>show;sync.getRaw=()=>raw;sync.getIndex=()=>actual;
 sync.status=message=>{throw Error(message);};
 sync.onTake=index=>{actual=index;};
 sync.navigate({songIndex:0,sectionIndex:1,page:0,routePage:0,routeIndex:5});
 assert.equal(actual,snapshot.route[5].slideIndices[0]);
 assert.equal(sync.snapshot().active.routeIndex,5);
 sync.navigate({songIndex:0,sectionIndex:-1,utility:'尾奏',page:0,routePage:0,routeIndex:6});
 assert.equal(sync.snapshot().active.utility,'尾奏');
});
test('copy, move, and delete edit references, not the original song source',()=>{
 const show=compile(raw);
 const target=show.items.find(item=>item.song?.sectionLabel==='副歌');
 const copied=editArrangement(raw,show,target.origin,'copy');
 const afterCopy=compile(copied);
 assert.equal(afterCopy.songs[0].pages.length,3);
 assert.equal(afterCopy.items.length,show.items.length+1);
 assert.equal(copied.songs,raw.songs);
 const clone=afterCopy.items.find(item=>item.origin.slot===3&&item.song?.sectionLabel==='副歌');
 assert.ok(clone);
 const moved=editArrangement(copied,afterCopy,clone.origin,'move',afterCopy.items.find(item=>item.song?.sectionLabel==='主歌2').origin);
 assert.equal(compile(moved).items.length,afterCopy.items.length);
 const deleted=editArrangement(moved,compile(moved),compile(moved).items.find(item=>item.song?.sectionLabel==='副歌').origin,'delete');
 assert.equal(compile(deleted).items.length,show.items.length);
 assert.equal(deleted.songs,raw.songs);
});
test('a private YAML without Leader plans converts in place and stays editable',()=>{
 const privateRaw={songs:'# 私有歌\n[Verse]\n原始句\n\n[Chorus]\n另一句',sections:[{id:'private',sequence:[{song:1}]}]};
 const upgraded=upgradeSongArrangements(privateRaw,compile(privateRaw));
 assert.equal(upgraded.sections[0].sequence[0].arrangement.length,2);
 assert.deepEqual(upgraded.sections[0].sequence[0].arrangement,[{section:'主歌',page:1},{section:'副歌',page:1}]);
 const repeated=editArrangement(upgraded,compile(upgraded),compile(upgraded).items.find(item=>item.song?.sectionKey==='C').origin,'copy');
 assert.equal(compile(repeated).items.filter(item=>item.song?.sectionKey==='C').length,2);
 assert.equal(parseSongs(repeated.songs)[0].pages.length,2);
 const updated='# 私有歌\n[Verse]\n修改後\n\n[Chorus]\n另一句';
 const next=replaceSongText(repeated,updated,parseSongs(repeated.songs),parseSongs(updated));
 assert.equal(compile(next).items.filter(item=>item.song?.sectionKey==='V')[0].blocks[0].text,'修改後');
});
test('full legacy sample YAML retains the complete meeting and repeats its songs',async()=>{
 const yaml=await readFile(new URL('../examples/sample.yml',import.meta.url),'utf8');
 const candidate=parseConfig(yaml),compiled=compile(candidate);
 assert.ok(compiled.sections.length>9);
 assert.ok(compiled.items.some(item=>item.label==='聚會 1 · 預備開始'));
 assert.equal(compiled.items.filter(item=>item.song?.id===1&&item.song?.sectionKey==='C').length,3);
 assert.equal(compiled.items.filter(item=>item.song?.id===2&&item.song?.sectionKey==='C').length,4);
});
