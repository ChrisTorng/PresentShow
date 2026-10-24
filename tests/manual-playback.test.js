import test from 'node:test';import assert from 'node:assert/strict';import {ManualShield} from '../src/player/manual-shield.js';import {MediaDeck} from '../src/player/media-deck.js';import {compile} from '../src/config/model.js';import {embedURL} from '../src/config/web.js';
test('manual cover reveals over two seconds and reblocking cancels pending restore immediately',()=>{
 let time=0,callback,cancelled=0;const cover={hidden:true,style:{}},deck={outputGain:1,settings(){}};const shield=new ManualShield(cover,deck,f=>{callback=f;return 1},()=>cancelled++,()=>time);
 shield.set(true);assert.equal(deck.outputGain,0);assert.equal(cover.style.opacity,'1');shield.set(false);time=1000;callback(time);assert.equal(deck.outputGain,.5);const obsolete=callback;shield.set(true);assert.equal(deck.outputGain,0);obsolete(2000);assert.equal(deck.outputGain,0);assert.equal(cover.hidden,false);shield.set(false);time=3000;callback(time);assert.equal(deck.outputGain,1);assert.equal(cover.hidden,true);assert.ok(cancelled>=4);
});
test('unchanged volume and status reads never rewrite YouTube volume or seek/play',()=>{
 const commands=[];const deck=new MediaDeck({},()=>{});deck.current={active:true,ready:true,gain:1,track:{key:'one'},player:{setVolume:v=>commands.push(v),getPlayerState:()=>1,getCurrentTime:()=>20,getDuration:()=>200}};
 deck.settings();for(let i=0;i<100;i++){deck.status();deck.settings();}assert.deepEqual(commands,[80]);assert.equal(deck.loopTimer,undefined);deck.volume=50;deck.settings();assert.deepEqual(commands,[80,50]);
});
test('Canva edit URL uses embedded view; unsafe web URLs rejected',()=>{
 assert.equal(embedURL('https://www.canva.com/design/demo/token/edit?foo=1'),'https://www.canva.com/design/demo/token/view?embed');assert.throws(()=>embedURL('javascript:alert(1)'));
});
test('web section has no adjacent generated blanks when explicitly disabled',()=>{
 const c=compile({pages:{a:{type:'text'},web:{type:'web',src:'https://example.com'},b:{type:'text'}},sections:[{id:'a',bookends:false,sequence:['a']},{id:'web',bookends:false,sequence:['web']},{id:'b',startBlank:false,sequence:['b']}]});assert.deepEqual(c.items.map(x=>x.id),['a','web','b','b-end']);
});

import {WebStage} from '../src/player/web-stage.js';
test('embedded web page is not reloaded on render and is removed when leaving',()=>{
 const previous=globalThis.document;let created=0,removed=0;globalThis.document={createElement(){created++;return {setAttribute(){},remove(){removed++}}}};
 const host={hidden:true,replaceChildren(){}},web=new WebStage(host,()=>{}),page={type:'web',src:'https://example.com',label:'Example'};
 try{web.set(page,true);web.set(page,true);assert.equal(created,1);assert.equal(host.hidden,false);web.set({type:'text'},true);assert.equal(removed,1);assert.equal(web.frame,null);assert.equal(host.hidden,true);web.set(page,false);assert.equal(created,1);}finally{globalThis.document=previous}
});
import {forwardStageKey} from '../src/player/keyboard.js';
import {BackgroundManager,registerBackgroundStyle} from '../src/backgrounds/index.js';
test('web page owns all projection keys, including outer-document arrow input',()=>{
 const sent=[];let prevented=0;
 for(const key of ['ArrowRight','ArrowLeft','PageDown','PageUp',' ','Escape','F8','v'])forwardStageKey({key,target:{closest:()=>null},preventDefault(){prevented++;}},{type:'web'},(...args)=>sent.push(args));
 assert.equal(prevented,0);assert.deepEqual(sent,[]);
 forwardStageKey({key:'ArrowRight',preventDefault(){prevented++;}},{type:'text'},(...args)=>sent.push(args));assert.equal(prevented,1);assert.deepEqual(sent,[['key',{key:'ArrowRight'}]]);
});
test('web iframe receives focus on entry and load without reloading on subsequent renders',()=>{
 const previous=globalThis.document;let focused=0,loaded=0;
 globalThis.document={createElement(){return {setAttribute(){},focus(){focused++;},contentWindow:{focus(){loaded++;}},remove(){}}}};
 try{const web=new WebStage({replaceChildren(){}},()=>{}),page={type:'web',src:'https://example.com'};web.set(page,true);const frame=web.frame;assert.equal(focused,1);frame.onload();assert.equal(focused,2);assert.equal(loaded,2);web.set(page,true);assert.equal(web.frame,frame);web.destroy();frame.onload();assert.equal(focused,2);}finally{globalThis.document=previous;}
});
test('covered background pauses and resumes the same instance without rebuilding',()=>{
 const previous=globalThis.document;let built=0,destroyed=0;const suspended=[];
 globalThis.document={createElement(){return {style:{},remove(){}}}};
 registerBackgroundStyle('pause-test',()=>{built++;return {suspend:value=>suspended.push(value),destroy(){destroyed++;}}});
 try{const manager=new BackgroundManager({dataset:{},append(){},replaceChildren(){}});const config={type:'pause-test',colors:['#ffffff','#000000']};manager.setSuspended(true);manager.set(config,0);manager.set(config,0);manager.setSuspended(false);assert.equal(built,1);assert.equal(destroyed,0);assert.deepEqual(suspended,[true,false]);manager.destroy();assert.equal(destroyed,1);}finally{globalThis.document=previous;}
});
test('YouTube events report state without changing volume or correcting playback',()=>{
 let reads=0,emitted;const deck=new MediaDeck({},()=>{},state=>{emitted=state;});const e={alive:true,active:true,ready:true,gain:1,track:{key:'yt',kind:'youtube'},player:{getPlayerState(){reads++;return 3;},getCurrentTime(){reads++;return 12;},getDuration(){reads++;return 120;}}};deck.current=e;
 deck.publish(e);assert.equal(reads,3);assert.equal(emitted.playing,false);assert.equal(emitted.estimated,true);assert.equal(emitted.time,12);
 deck.publish({...e});assert.equal(reads,3);
});

import {playbackPolicy} from '../src/player/playback-policy.js';
test('YouTube soundtracks keep solid backgrounds and only show video on media pages',()=>{
 for(const type of ['media','image','text','blank']){const item={type,layout:'roster',track:{kind:'youtube'},background:{type:'video',src:'bg.mp4',colors:['#fff','#ddd']}};const p=playbackPolicy(item);assert.equal(p.background.type,'solid');assert.equal(p.background.src,undefined);assert.equal(p.visible,type==='media');assert.equal(item.background.type,'video');}
 const next={type:'text',background:{type:'abstract'}};assert.equal(playbackPolicy(next,true).background.type,'solid');assert.equal(playbackPolicy(next,false).background.type,'abstract');
});

test('switching YouTube to image and roster retains the exact player without playback commands',async()=>{
 const classes=[];const track={key:'prayer',kind:'youtube',src:'https://youtu.be/abcdefghijk'};
 const deck=new MediaDeck({},()=>{});const entry={track,active:true,root:{classList:{toggle:(...args)=>classes.push(args)}}};deck.current=entry;
 for(const type of ['image','text']){const policy=playbackPolicy({type,track,background:{type:'abstract'}});await deck.set({...track},{active:true,visible:policy.visible},()=>{});assert.equal(deck.current,entry);}
 assert.deepEqual(classes,[['audio-only',true],['audio-only',true]]);
});

test('outgoing video remains hidden while the silent audio loads and crossfades',async()=>{
 const originalRequest=globalThis.requestAnimationFrame,originalCancel=globalThis.cancelAnimationFrame;
 let tick,loaded;globalThis.requestAnimationFrame=callback=>{tick=callback;return 1;};globalThis.cancelAnimationFrame=()=>{};
 const classes=new Set(),old={track:{key:'prayer',kind:'youtube'},gain:1,active:true,root:{style:{},classList:{add:name=>classes.add(name)}}};
 const deck=new MediaDeck({},()=>{});deck.current=old;deck.settings=()=>{};deck.dispose=()=>{};
 deck.create=async()=>{await new Promise(resolve=>{loaded=resolve;});deck.current={gain:0,root:{style:{}}};};
 try{
  const ready=deck.set({key:'silent',kind:'audio'},{active:true,visible:false,fade:1},()=>{});
  assert.ok(classes.has('audio-only'));assert.equal(deck.outgoing,old);
  loaded();await ready;assert.ok(classes.has('audio-only'));assert.equal(typeof tick,'function');
  tick(performance.now()+500);assert.ok(old.gain>0&&old.gain<1);assert.ok(deck.current.gain>0&&deck.current.gain<1);
 }finally{globalThis.requestAnimationFrame=originalRequest;globalThis.cancelAnimationFrame=originalCancel;}
});
