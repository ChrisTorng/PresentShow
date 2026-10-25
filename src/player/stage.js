import {playbackPolicy} from './playback-policy.js';
import {ManualShield} from './manual-shield.js';
import {WebStage} from './web-stage.js';
import {BackgroundManager} from '../backgrounds/index.js';
import {forwardStageKey} from './keyboard.js';
import {ForegroundManager} from './foreground.js';
import {AudioMeter} from './audio-meter.js';
import {MediaDeck} from './media-deck.js';
const params=new URLSearchParams(location.search),embedded=params.has('preview'),cue=params.has('cue'),owner=embedded?parent:opener,token=params.get('session');
document.body.classList.toggle('preview',embedded);
const send=(type,data={})=>owner?.postMessage({presentShow:token,type,...data},location.origin);
// Operational notices belong exclusively to the controller, never on the projected canvas.
const errors=new Map();
function error(source,message){if(errors.get(source)===message)return;errors.set(source,message);send('error',{source,message});}
const background=new BackgroundManager(document.querySelector('#ambient'),message=>error('background',message));
const foreground=new ForegroundManager(document.querySelector('#foreground'),message=>error('foreground',message));
const deck=new MediaDeck(document.querySelector('#media-layer'),message=>error('media',message),state=>{if(active)send('status',state);});
const meter=new AudioMeter();let active=false,item=null,shield=false,renderVersion=0;
const cover=document.querySelector('#manual-shield'),manual=new ManualShield(cover,deck);
const web=new WebStage(document.querySelector('#web-layer'),message=>error('web',message));
function drawForeground(){if(!item)return;foreground.render(item,active||(item.track?.kind==='video'&&!!deck.current),cue);if(deck.current)deck.current.root.classList.toggle('audio-only',item.type!=='media'||item.track?.kind==='audio');
 const poster=document.querySelector('#shield-poster');const src=item.track?.poster||'';if(poster.getAttribute('src')!==src){if(src)poster.src=src;else poster.removeAttribute('src');}poster.hidden=!src;document.querySelector('#shield-title').textContent=item.track?.label||item.label||'';
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==owner||event.data?.presentShow!==token)return;
 const msg=event.data;
 if(msg.type==='render'){
  const version=++renderVersion;item=msg.item;active=!!msg.active&&!cue;shield=!!msg.shield;deck.volume=msg.volume??80;manual.set(shield);deck.settings();
  web.set(item,active&&!cue);document.body.classList.toggle('web-active',item.type==='web'&&active&&!cue);
  const policy=playbackPolicy(item,msg.quietBackground);
  document.body.classList.toggle('youtube-underlay',policy.youtube&&item.type!=='media');
  document.body.style.setProperty('--quiet-background',`linear-gradient(130deg,${policy.background.colors[0]},${policy.background.colors[1]})`);
  const fade=msg.crossfade??item.crossfade??0;
  deck.set(item.track,{active,playing:active?msg.playing:false,resume:msg.resume,fade,visible:policy.visible},()=>{
   if(version!==renderVersion)return;
   const transition=fade?{type:'fade',duration:fade}:item.transition;
   item={...item,transition};background.setSuspended(policy.quiet||item.type==='web'||(item.type==='media'&&['youtube','video'].includes(item.track?.kind)));background.set(policy.background,msg.backgroundEpoch,policy.quiet?{type:'none',duration:0}:transition);drawForeground();
   if(active&&item.background.type==='audio-reactive'&&deck.current?.native)meter.attach(deck.current.native);else meter.detach();startAudioFrames();
  });
 }else if(msg.type==='sync')deck.sync(msg.state);
 else if(msg.type==='audio')background.audio(msg.signal);
 else if(msg.type==='command'){
  if(msg.action==='focus-web')web.focus();
  if(msg.action==='play')deck.play(msg.value);
  if(msg.action==='seek')deck.seek(msg.value);
  if(msg.action==='loop')deck.loop(msg.value);
  if(msg.action==='volume'){deck.volume=msg.value;deck.settings();}
  if(msg.action==='shield'){shield=!!msg.value;manual.set(shield);}
  if(msg.action==='enable'){deck.play(true);background.resume();if(item?.background.type==='audio-reactive'&&deck.current?.native)meter.attach(deck.current.native);}
 }
});
async function fullscreen(){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{error('fullscreen','無法進入全螢幕，請使用瀏覽器全螢幕功能。');}}
document.querySelector('#fullscreen').onclick=fullscreen;
document.querySelector('#enable-sound').onclick=()=>{deck.play(true);background.resume();if(deck.current?.native)meter.attach(deck.current.native);};
document.addEventListener('dblclick',e=>{if(item?.type!=='web'&&!e.target.closest('button,iframe'))fullscreen();});
document.addEventListener('keydown',e=>forwardStageKey(e,item,send));
window.addEventListener('focus',()=>{if(item?.type==='web'&&active)web.focus();});
document.addEventListener('pointerdown',e=>{if(item?.type==='web'&&active&&!e.target.closest('button'))web.focus();});
let hideTools;document.addEventListener('mousemove',()=>{if(embedded)return;const el=document.querySelector('#projector-tools');el.style.opacity='1';clearTimeout(hideTools);hideTools=setTimeout(()=>el.style.opacity='',2200);});
let lastAudio=0,audioFrameId=0;
function startAudioFrames(){
 cancelAnimationFrame(audioFrameId);audioFrameId=0;
 if(!active||item?.background.type!=='audio-reactive'||!deck.current?.native)return;
 const tick=now=>{const signal=meter.read();background.audio(signal);if(now-lastAudio>80){send('audio',{signal});lastAudio=now;}audioFrameId=requestAnimationFrame(tick);};
 audioFrameId=requestAnimationFrame(tick);
}
// Native media still synchronizes previews. YouTube reports only on player events,
// never through a recurring API poll or corrective playback commands.
setInterval(()=>{if(active&&deck.current?.native)send('status',deck.status());},1000);
window.addEventListener('beforeunload',()=>{cancelAnimationFrame(audioFrameId);manual.destroy();web.destroy();deck.destroy();meter.detach();background.destroy();});send('ready');
