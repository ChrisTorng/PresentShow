import test from 'node:test';
import assert from 'node:assert/strict';
import {compile} from '../src/config/model.js';
import {sectionTarget} from '../src/config/songs.js';
import {readingRows} from '../src/config/text.js';
import {fadeGains} from '../src/player/media-deck.js';
import {CueNavigation} from '../src/ui/navigation.js';
test('numbered paragraphs preserve hanging numbers and continuation lines',()=>{
 assert.deepEqual(readingRows('1. Long first item\ncontinued\n2. Second item'),[{number:'1.',text:'Long first item\ncontinued'},{number:'2.',text:'Second item'}]);
});
test('song boundary shortcuts belong to the adjacent song without rendering lyrics',()=>{
 const {items,sections}=compile({songs:'# First\n[Verse]\nOne\n\n[Chorus]\nTwo\n\n# Second\n[Verse]\nThree',sections:[{sequence:[{song:1}]},{sequence:[{song:2}]}]});
 assert.equal(items[0].type,'blank');assert.equal(items[0].blocks,undefined);assert.equal(items[sectionTarget(items,0,'C')].song.sectionKey,'C');
 assert.equal(items[sectionTarget(items,sections[0].end,'V')].song.id,1);assert.equal(items[sectionTarget(items,sections[1].end,'V')].song.id,2);
});
test('carousel auto-start and next preview follow the actual loop; manual page has no timer',()=>{
 const {items}=compile({pages:{a:{type:'text'},b:{type:'text'},c:{type:'text'}},sequence:[{pages:['a','b'],seconds:5,loop:true},'c']});
 assert.ok(items[0].autoStart);assert.equal(items[1].autoNext,0);assert.equal(new CueNavigation().next(items,1),0);assert.equal(items[2].seconds,0);
});
test('crossfade endpoints and halfway gains do not amplify audio',()=>{
 assert.deepEqual(fadeGains(0),{out:1,in:0});assert.deepEqual(fadeGains(.5),{out:.5,in:.5});assert.deepEqual(fadeGains(1),{out:0,in:1});
});

import {AudioMeter} from '../src/player/audio-meter.js';
test('detaching analysis keeps the outgoing audio connected for its remaining fade',()=>{
 const meter=new AudioMeter(),calls=[],destination={};meter.context={destination};meter.source={disconnect(){calls.push('disconnect')},connect(node){calls.push(node)}};meter.element={paused:false};meter.detach();assert.deepEqual(calls,['disconnect',destination]);assert.equal(meter.element,null);assert.equal(meter.source,null);
});
