import { youtubeId } from '../config/model.js';
import {BackgroundManager} from '../backgrounds/index.js';
import {SONG_KEYS} from '../config/songs.js';
import {ForegroundManager} from './foreground.js';
import {AudioMeter} from './audio-meter.js';
const params = new URLSearchParams(location.search);
const embedded = params.has('preview');
const cuePreview=params.has('cue');
document.body.classList.toggle('preview',embedded);
const owner = embedded ? parent : opener;
const token = params.get('session');
const fg = document.querySelector('#foreground');
const layer = document.querySelector('#media-layer');
const errorBox = document.querySelector('#stage-error');
let track = null, player = null, native = null, ready = false, failed = false, generation = 0, active = true;
let desiredPlay = false, volume = 80, loop = true, pendingSeek = 0;
let apiPromise;
const send = (type, data={}) => owner?.postMessage({presentShow:token,type,...data},location.origin);
const error = message => { errorBox.textContent=message; errorBox.hidden=!message; send('error',{message}); };
const background=new BackgroundManager(document.querySelector('#ambient'),error);
const foreground=new ForegroundManager(fg,error);
const meter=new AudioMeter();let reactive=false;
function youtubeAPI() {
  if (window.YT?.Player) return Promise.resolve();
  if (!apiPromise) apiPromise = new Promise((resolve,reject)=>{
    const timeout = setTimeout(()=>{ apiPromise=null; reject(new Error('YouTube 載入逾時，請檢查網路並重新選取此頁。')); },15000);
    window.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);resolve();};
    const script=document.createElement('script'); script.src='https://www.youtube.com/iframe_api';
    script.onerror=()=>{clearTimeout(timeout);apiPromise=null;reject(new Error('無法載入 YouTube，請檢查網路。'));};
    document.head.append(script);
  });
  return apiPromise;
}
function destroy() {
  generation++; ready=false;failed=false;meter.detach();
  if (native) {native.pause();native.removeAttribute('src');native.load();native=null;}
  player?.destroy?.();player=null;layer.replaceChildren();track=null;
}
async function playback(play) {
  desiredPlay=play;
  if (!active) return;
  if (native) {
    if (play) {try {await native.play();error('');if(reactive)meter.attach(native);}catch(e){if(e.name!=='AbortError')error('瀏覽器尚未允許播放。請在投影視窗按「啟用播放／聲音」。');}}
    else native.pause();
  } else if (ready) {if(play)player.playVideo();else player.pauseVideo();}
}
function seek(time) {
  pendingSeek=Number(time)||0;
  if (native && native.readyState) native.currentTime=pendingSeek;
  else if (ready) player.seekTo(pendingSeek,true);
}
function settings() {
  if(native){native.volume=volume/100;native.loop=loop;}
  if(ready)player.setVolume(volume);
}
function status() {
  const time=native?.currentTime ?? (ready ? player.getCurrentTime():0);
  const duration=native?.duration ?? (ready ? player.getDuration():0);
  const playing=native ? !native.paused : ready ? player.getPlayerState()===1 : false;
  send('status',{time:Number.isFinite(time)?time:0,duration:Number.isFinite(duration)?duration:0,playing,trackKey:track?.key || null});
}
async function setTrack(next, resume, shouldPlay) {
  if (!active) {destroy();return;}
  if (!failed && next?.key === track?.key && next?.src === track?.src) return;
  destroy();error('');
  if(!next)return;
  track=next;loop=next.loop;pendingSeek=resume||0;desiredPlay=shouldPlay;
  const version=generation;
  if(next.kind==='youtube'){
    try{
      await youtubeAPI();if(version!==generation)return;
      const mount=document.createElement('div');layer.append(mount);
      player=new YT.Player(mount,{videoId:youtubeId(next.src),playerVars:{playsinline:1,controls:1,rel:0,origin:location.origin},events:{
        onReady:()=>{if(version!==generation)return;ready=true;failed=false;settings();if(pendingSeek)seek(pendingSeek);playback(desiredPlay);},
        onStateChange:event=>{if(version!==generation)return;if(event.data===0 && loop){player.seekTo(0,true);playback(true);}status();},
        onAutoplayBlocked:()=>error('請在投影視窗按「啟用播放／聲音」以允許 YouTube 播放。'),
        onError:event=>{failed=true;error(`YouTube 無法播放（${event.data}）。影片可能禁止嵌入、已移除或需要登入。可改用有權使用的本機媒體。`);}
      }});
      setTimeout(()=>{if(version===generation && !ready){failed=true;error('YouTube 播放器尚未回應。請檢查網路或使用 Chrome／Edge 開啟網站，再重新選取此頁。');}},15000);
    }catch(e){if(version===generation){error(e.message);track=null;}}
  }else{
    native=document.createElement(next.kind==='audio'?'audio':'video');
    native.playsInline=true;native.preload='auto';if(next.cors)native.crossOrigin='anonymous';native.src=next.src;layer.append(native);settings();
    native.addEventListener('loadedmetadata',()=>{seek(pendingSeek);playback(desiredPlay);});
    native.addEventListener('error',()=>{failed=true;error('找不到媒體或格式不支援。請檢查網址，或重新選取素材資料夾。');});
    for(const name of ['play','pause','ended','durationchange'])native.addEventListener(name,status);
  }
}
function render(item) {
  foreground.render(item,active,cuePreview);
  const visibleVideo=item.type==='media' && item.track?.kind!=='audio';
  layer.classList.toggle('audio-only',!visibleVideo);
}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin || event.source!==owner || event.data?.presentShow!==token)return;
  const msg=event.data;
  if(msg.type==='render'){
    active=cuePreview?msg.item.track?.kind==='video':msg.active;volume=cuePreview?0:msg.volume??volume;
    background.set(msg.item.background,msg.backgroundEpoch,msg.item.transition);
    reactive=msg.item.background.type==='audio-reactive';if(reactive && active && native)meter.attach(native);
    setTrack(msg.item.track,msg.resume,cuePreview?false:msg.playing);render(msg.item);
  }else if(msg.type==='audio'){background.audio(msg.signal);
  }else if(msg.type==='command'){
    if(msg.action==='play')playback(msg.value);
    if(msg.action==='seek')seek(msg.value);
    if(msg.action==='loop'){loop=msg.value;settings();}
    if(msg.action==='volume'){volume=msg.value;settings();}
  }
});
async function fullscreen(){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{error('無法進入全螢幕，請使用瀏覽器全螢幕功能。');}}
document.querySelector('#fullscreen').onclick=fullscreen;
document.querySelector('#enable-sound').onclick=()=>{error('');playback(true);background.resume();if(reactive && native)meter.attach(native);};
document.addEventListener('dblclick',event=>{if(!event.target.closest('button,iframe'))fullscreen();});
document.addEventListener('keydown',event=>{if(event.ctrlKey || event.metaKey || event.altKey || event.repeat)return;if(['ArrowLeft','ArrowRight',' ','Escape',...SONG_KEYS].includes(event.key.length===1 && event.key!==' '?event.key.toUpperCase():event.key) && !event.target.closest('input,textarea')){event.preventDefault();send('key',{key:event.key});}});
let hideTools;
document.addEventListener('mousemove',()=>{if(embedded)return;const el=document.querySelector('#projector-tools');el.style.opacity='1';clearTimeout(hideTools);hideTools=setTimeout(()=>el.style.opacity='',2200);});
let lastAudio=0;
function audioFrame(now){
  if(active && reactive){const signal=meter.read();background.audio(signal);if(now-lastAudio>80){send('audio',{signal});lastAudio=now;}}
  requestAnimationFrame(audioFrame);
}
requestAnimationFrame(audioFrame);
setInterval(status,400);
send('ready');
