import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMediaTime,mediaStart,mediaResume} from '../src/config/media-time.js';
import {compile} from '../src/config/model.js';
import {setMediaSource} from '../src/config/editing.js';
import {MediaDeck} from '../src/player/media-deck.js';

test('media time accepts seconds or minutes:seconds, with explicit zero overriding the URL',()=>{
 for(const [value,expected] of [[62,62],['1:02',62],['90',90],['1m2s',62],['1h2m3s',3723],['',null],[0,0]])assert.equal(parseMediaTime(value),expected);
 const src='https://youtu.be/DPsG8d07g3k?si=example&t=62';
 assert.equal(mediaStart({src}),62);assert.equal(mediaStart({src,start:''}),62);
 assert.equal(mediaStart({src,start:'2:03'}),123);assert.equal(mediaStart({src,start:0}),0);
 assert.equal(mediaStart({src:'song.mp3?t=1m2s'}),62);
 assert.equal(mediaStart({src:'song.mp3'}),0);
 for(const value of ['1:60',-1,'abc','1:2:3'])assert.throws(()=>parseMediaTime(value));
 assert.equal(mediaResume({start:62}),62);assert.equal(mediaResume({start:62},17),17);assert.equal(mediaResume({start:62},0),0);
});

test('editing retained media updates its source variables and changes playback identity when start changes',()=>{
 const raw={variables:{url:'https://youtu.be/DPsG8d07g3k?t=62',time:'',title:'歡迎歌'},pages:{song:{type:'media',media:{kind:'youtube',src:'{{url}}',start:'{{time}}',label:'{{title}}'}},roster:{type:'text',media:'keep'}},sequence:['song','roster']};
 const show=compile(raw);assert.equal(show.items[0].track.start,62);assert.equal(show.items[1].track.key,show.items[0].track.key);
 const changed=setMediaSource(raw,show,1,{src:'https://youtu.be/DPsG8d07g3k?t=90',start:'1:02',label:'新曲名'});
 assert.equal(changed.variables.time,'1:02');assert.equal(changed.pages.song.media.start,'{{time}}');assert.equal(changed.variables.title,'新曲名');
 assert.equal(compile(changed).items[0].track.start,62);
 const zero=setMediaSource(raw,show,1,{start:'0'});
 assert.equal(compile(zero).items[0].track.start,0);assert.notEqual(compile(zero).items[0].track.key,show.items[0].track.key);
 assert.equal(raw.variables.time,'');
});

test('YouTube receives start=62 before playing and looping returns to the configured start',async()=>{
 const original={window:globalThis.window,YT:globalThis.YT,document:globalThis.document,location:globalThis.location},calls=[];let options;
 const element=()=>({style:{},classList:{toggle(){}},append(){},remove(){}});
 globalThis.document={createElement:element};
 globalThis.YT={Player:class{
  constructor(node,input){options=input;queueMicrotask(()=>input.events.onReady());}
  setVolume(){}seekTo(value){calls.push(['seek',value]);}playVideo(){calls.push(['play']);}
  getPlayerState(){return 2;}getCurrentTime(){return 62;}getDuration(){return 200;}destroy(){}
 }};
 globalThis.window={YT:globalThis.YT};
 globalThis.location={origin:'http://localhost:4173'};
 const deck=new MediaDeck({append(){}},()=>{});
 try{
  await deck.create({key:'welcome',kind:'youtube',src:'https://youtu.be/DPsG8d07g3k?t=62',start:62,loop:true},{active:true,playing:true});
  assert.equal(options.playerVars.start,62);assert.deepEqual(calls,[['seek',62],['play']]);
  options.events.onStateChange({data:0});assert.deepEqual(calls.slice(-2),[['seek',62],['play']]);
 }finally{clearTimeout(deck.current?.timeout);deck.dispose(deck.current);Object.assign(globalThis,original);}
});

test('native audio seeks before playback and preserves the same starting offset on repeat',async()=>{
 const original=globalThis.document;let media;
 globalThis.document={createElement(tag){
  const node={style:{},classList:{toggle(){}},append(){},remove(){},removeAttribute(){},pause(){},load(){},currentTime:0,muted:false};
  if(tag==='audio'){
   media=node;Object.defineProperty(node,'src',{set(){queueMicrotask(()=>{node.onloadedmetadata?.();node.onloadeddata?.();});}});
  }
  return node;
 }};
 const deck=new MediaDeck({append(){}},()=>{});
 try{
  await deck.create({key:'audio',kind:'audio',src:'song.mp3',start:62,loop:true},{active:true,playing:false});
  assert.equal(media.currentTime,62);assert.equal(media.loop,false);
  media.currentTime=200;media.onended();assert.equal(media.currentTime,62);
 }finally{deck.dispose(deck.current);globalThis.document=original;}
});
