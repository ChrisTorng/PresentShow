import {BackgroundManager} from '../backgrounds/index.js';
import {SONG_KEYS} from '../config/songs.js';
import {ForegroundManager} from './foreground.js';
import {AudioMeter} from './audio-meter.js';
import {MediaDeck} from './media-deck.js';
const params=new URLSearchParams(location.search),embedded=params.has('preview'),cue=params.has('cue'),monitor=params.has('monitor'),owner=embedded?parent:opener,token=params.get('session');
document.body.classList.toggle('preview',embedded);
const send=(type,data={})=>owner?.postMessage({presentShow:token,type,...data},location.origin);
// Operational notices belong exclusively to the controller, never on the projected canvas.
const errors=new Map();
function error(source,message){if(errors.get(source)===message)return;errors.set(source,message);send('error',{source,message});}
const background=new BackgroundManager(document.querySelector('#ambient'),message=>error('background',message));
const foreground=new ForegroundManager(document.querySelector('#foreground'),message=>error('foreground',message));
const deck=new MediaDeck(document.querySelector('#media-layer'),message=>error('media',message));
const meter=new AudioMeter();let active=false,item=null,shield=false,renderVersion=0;
function foregroundItem(){if(monitor)return item;if(shield && item?.track?.kind==='youtube')return {...item,type:'media',blocks:[]};if(shield)return {...item,type:'blank',blocks:[]};return item;}
function drawForeground(){if(!item)return;const display=foregroundItem();foreground.render(display,(!shield||monitor)&&(active||(item.track?.kind==='video'&&!!deck.current)),cue);if(deck.current)deck.current.root.classList.toggle('audio-only',(shield&&!monitor)||item.type!=='media'||item.track?.kind==='audio');}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==owner||event.data?.presentShow!==token)return;
 const msg=event.data;
 if(msg.type==='render'){
  const version=++renderVersion;item=msg.item;active=!!msg.active&&!cue;shield=!!msg.shield;deck.volume=msg.volume??80;deck.shield=shield;deck.settings();
  const fade=msg.crossfade??item.crossfade??0;
  deck.set(item.track,{active,playing:active?msg.playing:false,resume:msg.resume||0,fade,visible:item.type==='media'&&!shield},()=>{
   if(version!==renderVersion)return;
   const transition=fade?{type:'fade',duration:fade}:item.transition;
   item={...item,transition};background.set(item.background,msg.backgroundEpoch,transition);drawForeground();
   if(active&&item.background.type==='audio-reactive'&&deck.current?.native)meter.attach(deck.current.native);else meter.detach();
  });
 }else if(msg.type==='sync')deck.sync(msg.state);
 else if(msg.type==='audio')background.audio(msg.signal);
 else if(msg.type==='command'){
  if(msg.action==='play')deck.play(msg.value);
  if(msg.action==='seek')deck.seek(msg.value);
  if(msg.action==='loop')deck.loop(msg.value);
  if(msg.action==='volume'){deck.volume=msg.value;deck.settings();}
  if(msg.action==='shield'){shield=!!msg.value;deck.shield=shield;deck.settings();drawForeground();}
  if(msg.action==='enable'){deck.play(true);background.resume();if(item?.background.type==='audio-reactive'&&deck.current?.native)meter.attach(deck.current.native);}
 }
});
async function fullscreen(){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{error('fullscreen','無法進入全螢幕，請使用瀏覽器全螢幕功能。');}}
document.querySelector('#fullscreen').onclick=fullscreen;
document.querySelector('#enable-sound').onclick=()=>{deck.play(true);background.resume();if(deck.current?.native)meter.attach(deck.current.native);};
document.addEventListener('dblclick',e=>{if(!e.target.closest('button,iframe'))fullscreen();});
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||e.target.closest('input,textarea'))return;if(['ArrowLeft','ArrowRight',' ','Escape','F8',...SONG_KEYS].includes(e.key.length===1&&e.key!==' '?e.key.toUpperCase():e.key)){e.preventDefault();send('key',{key:e.key});}});
let hideTools;document.addEventListener('mousemove',()=>{if(embedded)return;const el=document.querySelector('#projector-tools');el.style.opacity='1';clearTimeout(hideTools);hideTools=setTimeout(()=>el.style.opacity='',2200);});
let lastAudio=0;function audioFrame(now){if(active&&item?.background.type==='audio-reactive'){const signal=meter.read();background.audio(signal);if(now-lastAudio>80){send('audio',{signal});lastAudio=now;}}requestAnimationFrame(audioFrame);}requestAnimationFrame(audioFrame);
setInterval(()=>{if(active)send('status',deck.status());},250);
window.addEventListener('beforeunload',()=>{deck.destroy();meter.detach();background.destroy();});send('ready');
