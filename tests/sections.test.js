import test from 'node:test';
import assert from 'node:assert/strict';
import {compile} from '../src/config/model.js';
import {setBackgroundCue,replaceSongText} from '../src/config/editing.js';
import {parseSongs} from '../src/config/songs.js';
import {spectrumFeatures} from '../src/player/audio-meter.js';
const fixture={backgrounds:{a:{type:'abstract'},b:{type:'ribbons'}},pages:{title:{type:'text',blocks:[{kind:'title',text:'Hello'}]},music:{type:'media',media:{kind:'audio',src:'one.wav'}},image:{type:'image',src:'one.png',media:'keep'}},sections:[{id:'first',title:'First',background:'a',sequence:['music','image']},{id:'second',title:'Second',background:'a',sequence:['title']},{id:'third',title:'Third',background:'b',transition:{duration:.3},sequence:['title']}]};
test('sections share one blank for same backgrounds and retain two for different backgrounds',()=>{
  const {items,sections}=compile(fixture);
  assert.equal(items.length,9);assert.equal(sections[0].start,0);assert.equal(sections[0].end,3);
  assert.equal(items[3].type,'blank');assert.equal(items[4].type,'text');
  assert.equal(items[5].type,'blank');assert.equal(items[5].background.id,'a');assert.equal(items[6].type,'blank');assert.equal(items[6].background.id,'b');
  assert.equal(items[8].type,'blank');
});
test('image keeps original music track; automatic closing blank stops it',()=>{
  const {items}=compile(fixture);assert.equal(items[1].track.key,items[2].track.key);assert.equal(items[3].track,null);
});
test('transitions inherit across pages and blank boundaries',()=>{
  const {items}=compile(fixture);assert.equal(items[4].transition.duration,.1);assert.equal(items[6].transition.duration,.3);assert.equal(items[8].transition.duration,.3);
  const changed=structuredClone(fixture);changed.sections[0].sequence[1]={page:'image',transition:{duration:.4}};
  assert.equal(compile(changed).items[2].transition.duration,.4);assert.equal(compile(changed).items[3].transition.duration,.4);
});
test('background edit inside section targets correct page; bookend changes persist',()=>{
  const show=compile(fixture);const next=setBackgroundCue(fixture,show.items[2],'b');assert.equal(next.sections[0].sequence[1].background,'b');assert.equal(compile(next).items[2].background.id,'b');
  const end=setBackgroundCue(fixture,show.items[3],'b');assert.equal(end.sections[0].endBackground,'b');assert.equal(compile(end).items[3].background.id,'b');
});
test('media identity remains stable when preceding background boundaries change',()=>{
  const a=structuredClone(fixture);a.sections[1].sequence=['music'];const first=compile(a).items.find(item=>item.section.index===1 && item.type==='media');
  a.sections[1].background='b';const second=compile(a).items.find(item=>item.section.index===1 && item.type==='media');assert.equal(first.track.key,second.track.key);
});
test('audio analysis reflects volume and dominant frequency, including silence',()=>{
  const low=new Uint8Array(1024),high=new Uint8Array(1024);low[5]=255;high[42]=255;
  const a=spectrumFeatures(new Float32Array([.2,-.2,.2,-.2]),low),b=spectrumFeatures(new Float32Array([.1,-.1,.1,-.1]),high);
  assert.ok(a.rms>b.rms);assert.ok(a.dominant<b.dominant);assert.ok(a.bass>b.bass);
  const silence=spectrumFeatures(new Float32Array(8),new Uint8Array(1024));assert.equal(silence.rms,0);assert.equal(silence.dominant,0);
});
test('song editing preserves section ownership and adds a new group',()=>{
  const songs='# First\nhello';const raw={songs,sections:[{id:'song1',title:'First',sequence:[{song:1}]}]};
  const next=replaceSongText(raw,songs+'\n\n# Second\nworld',parseSongs(songs),parseSongs(songs+'\n\n# Second\nworld'));
  assert.equal(next.sections.length,2);assert.equal(next.sections[0].id,'song1');assert.equal(compile(next).songs.length,2);
});
