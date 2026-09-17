import { youtubeId } from './model.js';
const params = new URLSearchParams(location.search);
const embedded = params.has('preview');
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
  generation++; ready=false;failed=false;
  if (native) {native.pause();native.removeAttribute('src');native.load();native=null;}
  player?.destroy?.();player=null;layer.replaceChildren();track=null;
}
async function playback(play) {
  desiredPlay=play;
  if (!active) return;
  if (native) {
    if (play) {try {await native.play();error('');}catch(e){if(e.name!=='AbortError')error('瀏覽器尚未允許播放。請在投影視窗按「啟用播放／聲音」。');}}
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
    native.playsInline=true;native.preload='auto';native.src=next.src;layer.append(native);settings();
    native.addEventListener('loadedmetadata',()=>{seek(pendingSeek);playback(desiredPlay);});
    native.addEventListener('error',()=>{failed=true;error('找不到媒體或格式不支援。請檢查網址，或重新選取素材資料夾。');});
    for(const name of ['play','pause','ended','durationchange'])native.addEventListener(name,status);
  }
}
function fitText() {
  const content=fg.querySelector('.slide-content');if(!content)return;
  content.style.setProperty('--fit',1);
  const available=fg.clientHeight-parseFloat(getComputedStyle(fg).paddingTop)*2;
  content.style.setProperty('--fit',Math.min(1,available/content.scrollHeight));
}
new ResizeObserver(fitText).observe(fg);
function render(item) {
  fg.replaceChildren();fg.className='foreground';
  if(item.type==='image'){
    fg.classList.add('image-slide');const img=document.createElement('img');img.src=item.src;img.alt=item.alt||'';img.className=item.fit==='original'?'original':'contain';
    img.onerror=()=>error('圖片無法載入，請檢查路徑或選取素材資料夾。');fg.append(img);
  }else if(item.type==='text'){
    const content=document.createElement('div');content.className=`slide-content ${item.align==='left'?'align-left':''}`;
    for(const block of item.blocks||[]){const node=document.createElement('p');node.className=`block ${block.kind || 'text'}`;node.textContent=block.text;content.append(node);}
    fg.append(content);requestAnimationFrame(fitText);
  }
  const visibleVideo=item.type==='media' && item.track?.kind!=='audio';
  layer.classList.toggle('audio-only',!visibleVideo);
  // Preview never duplicates the projector's audio/video player.
  if(!active && visibleVideo){fg.classList.add('media-placeholder');const label=document.createElement('div');label.className='slide-content';label.textContent=`▶ ${item.label}\n正在投影視窗播放`;fg.append(label);}
}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin || event.source!==owner || event.data?.presentShow!==token)return;
  const msg=event.data;
  if(msg.type==='render'){
    active=msg.active;volume=msg.volume??volume;
    setTrack(msg.item.track,msg.resume,msg.playing);render(msg.item);
  }else if(msg.type==='command'){
    if(msg.action==='play')playback(msg.value);
    if(msg.action==='seek')seek(msg.value);
    if(msg.action==='loop'){loop=msg.value;settings();}
    if(msg.action==='volume'){volume=msg.value;settings();}
  }
});
async function fullscreen(){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{error('無法進入全螢幕，請使用瀏覽器全螢幕功能。');}}
document.querySelector('#fullscreen').onclick=fullscreen;
document.querySelector('#enable-sound').onclick=()=>{error('');playback(true);};
document.addEventListener('dblclick',event=>{if(!event.target.closest('button,iframe'))fullscreen();});
document.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight',' '].includes(event.key) && !event.target.closest('button')){event.preventDefault();send('key',{key:event.key});}});
let hideTools;
document.addEventListener('mousemove',()=>{if(embedded)return;const el=document.querySelector('#projector-tools');el.style.opacity='1';clearTimeout(hideTools);hideTools=setTimeout(()=>el.style.opacity='',2200);});
document.querySelector('#ambient').style.transform=`rotate(${Math.random()*8-4}deg)`;
document.querySelectorAll('#ambient i').forEach((blob,i)=>{
  blob.style.background=`hsl(${(85+i*52+Math.random()*25)%360} 36% ${81+Math.random()*5}%)`;
  blob.style.animationDelay=`-${Math.random()*90}s, -${Math.random()*120}s`;
});
setInterval(status,400);
send('ready');
