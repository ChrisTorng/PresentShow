import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compile,resolveAsset,youtubeId} from '../src/config/model.js';
const sample=JSON.parse(await readFile(new URL('../examples/sample.json',import.meta.url)));
test('requested stages, date default, media continuity and stop',()=>{
  const show=compile(sample,new Date(2026,8,17));
  assert.equal(show.variables.date,'2026 / 9 / 17');assert.equal(show.items.length,17);
  assert.equal(show.items[2].track.key,show.items[3].track.key);
  assert.notEqual(show.items[3].track.key,show.items[4].track.key);
  assert.equal(show.items[5].track,null);
  assert.equal(show.items[7].autoNext,8);assert.equal(show.items[10].autoNext,7);assert.equal(show.items[11].id,'main1');
});
test('non-looping carousel stops, or explicitly continues',()=>{
  const config=structuredClone(sample);config.sequence[7].loop=false;
  assert.equal(compile(config).items[10].autoNext,null);
  config.sequence[7].continue=true;assert.equal(compile(config).items[10].autoNext,11);
});
test('direct jump into keep resolves original track',()=>{const {items}=compile(sample);assert.equal(items[3].track.src,items[2].track.src);assert.equal(items[3].track.loop,true);});
test('invalid config rejected',()=>{
  assert.throws(()=>compile({...sample,sequence:['missing']}),/找不到頁面/);
  assert.throws(()=>compile({...sample,sequence:[{pages:['pre1'],seconds:-1}]}),/seconds/);
  assert.throws(()=>compile({...sample,sequence:[{pages:[]}]}),/不可為空/);
  const broken=structuredClone(sample);delete broken.variables.venue;assert.throws(()=>compile(broken),/找不到變數/);
});
test('nested deployment, remote and local assets',()=>{
  assert.equal(resolveAsset('media/a.mp3','https://example.com/PresentShow/config/show.json'),'https://example.com/PresentShow/config/media/a.mp3');
  assert.equal(resolveAsset('media/a.mp3','https://example.com/',new Map([['media/a.mp3','blob:local']])),'blob:local');
  assert.throws(()=>resolveAsset('C:\\music.mp3','https://example.com/'),/本機路徑/);
  assert.throws(()=>resolveAsset('javascript:alert(1)','https://example.com/'),/僅支援/);
});
test('YouTube URL parsing',()=>{
  assert.equal(youtubeId('https://www.youtube.com/watch?v=k0e7VVu3th8'),'k0e7VVu3th8');
  assert.equal(youtubeId('https://youtu.be/3NycM9lYdRI?t=3'),'3NycM9lYdRI');assert.equal(youtubeId('https://evil.youtube.com/watch?v=no'),null);
});
