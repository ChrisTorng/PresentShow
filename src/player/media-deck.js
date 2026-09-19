import {youtubeId} from '../config/model.js';
let apiPromise;
function youtubeAPI(){
  if(window.YT?.Player)return Promise.resolve();
  if(!apiPromise)apiPromise=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{apiPromise=null;reject(new Error('YouTube 載入逾時。'));},15000);
    window.onYouTubeIframeAPIReady=()=>{clearTimeout(timer);resolve();};
    const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{clearTimeout(timer);apiPromise=null;reject(new Error('無法載入 YouTube。'));};document.head.append(script);
  });return apiPromise;
}
export function fadeGains(progress){const p=Math.max(0,Math.min(1,progress));return {out:1-p,in:p};}
export class MediaDeck{
  constructor(host,onError){this.host=host;this.onError=onError;this.current=null;this.outgoing=null;this.version=0;this.volume=80;this.shield=false;this.frame=0;}
  dispose(entry){if(!entry)return;entry.alive=false;entry.cancelReady?.();clearTimeout(entry.timeout);if(entry.native){entry.native.pause();entry.native.removeAttribute('src');entry.native.load();}entry.player?.destroy?.();entry.root.remove();}
  finish(){cancelAnimationFrame(this.frame);this.dispose(this.outgoing);this.outgoing=null;if(this.current){this.current.gain=1;this.current.root.style.opacity='1';}this.settings();}
  settings(){for(const e of [this.current,this.outgoing])if(e){const gain=(this.shield||!e.active?0:this.volume/100)*e.gain;if(e.native){e.native.muted=!e.active;e.native.volume=gain;e.native.loop=e.track.loop;}if(e.ready)e.player?.setVolume(gain*100);}}
  async create(track,opts){
    const root=document.createElement('div');root.className='media-entry';this.host.append(root);
    const e={root,track,active:opts.active,alive:true,gain:opts.fade?0:1,ready:false,wants:opts.playing};this.current=e;
    root.classList.toggle('audio-only',track.kind==='audio'||!opts.visible);root.style.opacity=String(e.gain);
    if(track.kind==='youtube'){
      try{
        await youtubeAPI();if(!e.alive)return;
        await new Promise(resolve=>{
          e.cancelReady=resolve;const mount=document.createElement('div');root.append(mount);
          e.player=new YT.Player(mount,{videoId:youtubeId(track.src),playerVars:{playsinline:1,controls:1,rel:0,origin:location.origin},events:{
            onReady:()=>{if(!e.alive)return;e.ready=true;clearTimeout(e.timeout);this.settings();if(opts.resume)e.player.seekTo(opts.resume,true);if(e.wants)e.player.playVideo();resolve();},
            onStateChange:event=>{if(!e.alive)return;if(event.data===1&&this.current===e)this.onError('');if(event.data===0 && e.track.loop){e.player.seekTo(0,true);e.player.playVideo();}},
            onAutoplayBlocked:()=>{if(e.alive&&this.current===e)this.onError('YouTube 尚未允許播放，請按「啟用播放」。');},
            onError:event=>{if(e.alive&&this.current===e){this.onError(`YouTube 無法播放（${event.data}）。可改用本機媒體。`);resolve();}}
          }});
          e.timeout=setTimeout(()=>{if(e.alive&&this.current===e)this.onError('YouTube 播放器未回應。請重新選取或改用 Chrome／Edge。');resolve();},15000);
        });
      }catch(error){if(e.alive&&this.current===e)this.onError(error.message);}
    }else{
      e.native=document.createElement(track.kind==='audio'?'audio':'video');const media=e.native;media.playsInline=true;media.preload='auto';media.muted=!opts.active;if(track.cors)media.crossOrigin='anonymous';media.src=track.src;root.append(media);this.settings();
      await new Promise(resolve=>{e.cancelReady=resolve;e.timeout=setTimeout(resolve,8000);media.onloadeddata=()=>{if(e.alive && opts.resume)media.currentTime=opts.resume;clearTimeout(e.timeout);resolve();};media.onerror=()=>{if(e.alive&&this.current===e)this.onError('找不到媒體或格式不支援。');clearTimeout(e.timeout);resolve();};});
      if(e.alive && e.wants)await this.playEntry(e,true);
    }
    return e;
  }
  async set(track,opts,onReady=()=>{}){
    // Mirrors never instantiate YouTube or audio: no second soundtrack, ad stream, or autoplay.
    if(!opts.active && track?.kind!=='video')track=null;
    if(this.current?.track.key===track?.key && this.current?.track.src===track?.src && this.current?.active===opts.active){this.current?.root.classList.toggle('audio-only',track?.kind==='audio'||!opts.visible);return onReady();}
    this.finish();const version=++this.version,old=this.current;this.current=null;this.outgoing=old;
    if(!opts.fade){this.dispose(old);this.outgoing=null;}this.onError('');
    if(track)await this.create(track,opts);
    if(version!==this.version)return;
    onReady();const duration=opts.fade*1000;
    if(!duration){this.settings();return;}
    const start=performance.now();const tick=now=>{if(version!==this.version)return;const p=Math.min(1,(now-start)/duration),g=fadeGains(p);if(this.current){this.current.gain=g.in;this.current.root.style.opacity=String(g.in);}if(this.outgoing){this.outgoing.gain=g.out;this.outgoing.root.style.opacity=String(g.out);}this.settings();if(p<1)this.frame=requestAnimationFrame(tick);else this.finish();};this.frame=requestAnimationFrame(tick);
  }
  async playEntry(e,play){if(!e?.alive)return;e.wants=play;if(e.native){if(play)try{await e.native.play();if(e.alive&&this.current===e)this.onError('');}catch(error){if(e.alive&&this.current===e&&error.name!=='AbortError')this.onError('瀏覽器尚未允許播放，請按「啟用播放」。');}else e.native.pause();}else if(e.ready){play?e.player.playVideo():e.player.pauseVideo();}}
  play(play){this.playEntry(this.current,play);if(!play)this.playEntry(this.outgoing,false);}
  seek(time){const e=this.current;if(e?.native?.readyState)e.native.currentTime=Number(time)||0;else if(e?.ready)e.player.seekTo(Number(time)||0,true);}
  loop(value){if(this.current)this.current.track.loop=value;this.settings();}
  status(){const e=this.current,playing=e?.native?!e.native.paused:e?.ready?e.player.getPlayerState()===1:false;const time=e?.native?.currentTime??(e?.ready?e.player.getCurrentTime():0),duration=e?.native?.duration??(e?.ready?e.player.getDuration():0);return {time:Number.isFinite(time)?time:0,duration:Number.isFinite(duration)?duration:0,playing,trackKey:e?.track.key||null};}
  sync(state){const e=this.current;if(!e||e.active||e.track.key!==state.trackKey)return;if(Math.abs(this.status().time-state.time)>.5)this.seek(state.time);if(this.status().playing!==state.playing)this.playEntry(e,state.playing);}
  destroy(){this.version++;this.finish();this.dispose(this.current);this.current=null;}
}
