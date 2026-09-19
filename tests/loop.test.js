import test from 'node:test';import assert from 'node:assert/strict';import {loopWindow,loopEnvelope} from '../src/player/loop-envelope.js';import {MediaDeck} from '../src/player/media-deck.js';
test('early loop bounds support trim, explicit end and short-video guards',()=>{
 assert.deepEqual(loopWindow({loop:true,loopTrimEnd:20,loopFade:1.5},300),{start:0,end:280,fade:1.5});
 assert.equal(loopWindow({loop:true,loopEnd:200,loopTrimEnd:20},300).end,200);
 assert.equal(loopWindow({loop:true,loopTrimEnd:20},10),null);assert.equal(loopWindow({loop:false},300),null);
});
test('fade out, seek while silent, buffer silently, fade in by actual playback time',()=>{
 const w={start:0,end:280,fade:1.5};assert.equal(loopEnvelope(w,279.25,true).gain,.5);
 assert.deepEqual(loopEnvelope(w,280,true),{gain:0,phase:'seeking',seek:0});
 assert.equal(loopEnvelope(w,280,false,'seeking').gain,0);assert.equal(loopEnvelope(w,0,false,'seeking').gain,0);
 assert.deepEqual(loopEnvelope(w,.75,true,'seeking'),{gain:.5,phase:'rising'});assert.equal(loopEnvelope(w,1.5,true,'rising').gain,1);
 assert.equal(loopEnvelope(w,280,false).seek,undefined);
});
test('YouTube adapter mutes before seek and shields the fade-in',()=>{
 let time=280,state=1,volume=80;const calls=[];const deck=new MediaDeck({},()=>{});
 deck.current={alive:true,ready:true,active:true,gain:1,track:{loop:true,loopTrimEnd:20,loopFade:1.5},player:{getDuration:()=>300,getCurrentTime:()=>time,getPlayerState:()=>state,setVolume:v=>{volume=v;calls.push(['volume',v])},seekTo:v=>calls.push(['seek',v]),playVideo:()=>{}}};
 try{deck.tickLoops();assert.deepEqual(calls.slice(0,2),[['volume',0],['seek',0]]);state=3;time=0;deck.tickLoops();assert.equal(volume,0);state=1;time=.75;deck.tickLoops();assert.equal(volume,40);deck.shield=true;time=1.5;deck.tickLoops();assert.equal(volume,0);deck.loop(false);assert.equal(deck.current.loopGain,1);}finally{clearInterval(deck.loopTimer)}
});
