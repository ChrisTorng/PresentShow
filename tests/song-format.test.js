import test from 'node:test';
import assert from 'node:assert/strict';
import {compile} from '../src/config/model.js';
import {parseSongs} from '../src/config/songs.js';
import {leaderSnapshot} from '../src/leader/leader-sync-data.js';
import {upgradeSongArrangements} from '../src/config/arrangement.js';

const raw={songs:`# 中文歌名 - It's a Test - 測試來源
前奏-主歌x2-副歌-小副歌x2-間奏-講話-禱告-尾句-尾奏
[主歌]
甲行

乙行
[副歌]
副歌行
[小副歌]
小副歌行
[尾句]
明列的尾句`,sections:[{sequence:[{song:1}]}]};

test('song headers and inline plans are metadata and never become projected lyrics',()=>{
 const [song]=parseSongs(raw.songs),show=compile(raw),snapshot=leaderSnapshot(show,raw);
 assert.equal(song.title,'中文歌名');assert.equal(song.english,"It's a Test");assert.equal(song.credit,'測試來源');
 assert.equal(song.pages.length,5);assert.equal(song.pages[3].sectionName,'小副歌');
 assert.equal(snapshot.plans[0],song.plan);
 assert.deepEqual(snapshot.route.map(entry=>entry.utility||snapshot.songs[0].sections[entry.section].name),['前奏','主歌','主歌','副歌','小副歌','小副歌','間奏','講話','禱告','尾句','尾奏']);
 assert.equal(show.items.filter(item=>item.song?.titlePage).length,0);
 for(const utility of ['前奏','間奏','講話','禱告']){
  const item=show.items.find(item=>item.song?.utility===utility);
  assert.equal(item.layout,'song-title');assert.equal(item.blocks[0].text,'中文歌名');assert.equal(item.blocks[1].text,"It's a Test");assert.equal(item.credit,'測試來源');
 }
 assert.equal(show.items.find(item=>item.song?.utility==='尾奏').type,'blank');
 const tail=show.items.find(item=>item.song?.sectionName==='尾句');assert.equal(tail.blocks[0].text,'明列的尾句');
 const upgraded=upgradeSongArrangements(raw,show);assert.ok(upgraded.sections[0].sequence[0].arrangement.length>10);
});

test('legacy Bridge and Chinese names display as 小副歌 and still accept old plan names',()=>{
 const show=compile({songs:'# Legacy\n[Bridge]\n一句',leaderPlans:{1:'橋段'},sequence:[{song:1}]});
 assert.equal(show.songs[0].pages[0].sectionName,'小副歌');
 assert.equal(leaderSnapshot(show,{}).songs[0].sections[0].kind,'tag');
});
