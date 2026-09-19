import {backgroundPlan,mixColor} from './config.js';
const renderers=new Map();
export function registerBackgroundStyle(type,factory){renderers.set(type,factory);}
// A factory receives a dedicated root and returns destroy(), optionally resume().
// Custom JS/CSS renderers belong in trusted project files, never in imported YAML.
function animated({root,config,epoch}){
  const animations=[];
  root.style.background=`linear-gradient(130deg, ${config.colors[0]}, ${config.colors[1]})`;
  for(const plan of backgroundPlan(config)){
    const blob=document.createElement('div');blob.className='background-blob';
    const ribbon=config.type==='ribbons',mist=config.type==='mist';
    Object.assign(blob.style,{left:`${plan.left}%`,top:`${plan.top}%`,width:`${ribbon?110:plan.size}vw`,height:`${ribbon?22:mist?45:plan.size}vh`,filter:`blur(${config.blur/19.2}vw)`});
    root.append(blob);
    const animation=blob.animate(plan.frames,{duration:plan.duration,iterations:Infinity,easing:'ease-in-out'});
    animation.playbackRate=config.speed;
    animation.currentTime=Math.max(0,Date.now()-epoch)*config.speed+plan.phase*plan.duration;
    if(config.speed===0)animation.pause();
    animations.push(animation);
  }
  return {destroy(){animations.forEach(a=>a.cancel());}};
}
for(const type of ['abstract','ribbons','mist'])registerBackgroundStyle(type,animated);
registerBackgroundStyle('audio-reactive',({root,config,epoch})=>{
  const clouds=document.createElement('div');clouds.className='audio-clouds';root.append(clouds);
  const base=animated({root:clouds,config,epoch});let level=0,pitch=0,last=performance.now();
  return {audio(signal){
    const now=performance.now(),dt=Math.min(.2,(now-last)/1000);last=now;
    const smoothing=1-Math.pow(config.response,dt*60);
    level+=(Math.min(1,signal.level*config.sensitivity)-level)*smoothing;pitch+=(signal.pitch-pitch)*smoothing;
    clouds.style.transform=`translate(${(pitch-.25)*1.5}%,${-level*.8}%) scale(${1+level*.035})`;
    clouds.style.opacity=String(.7+level*.25);
    root.style.background=mixColor(config.colors,Math.max(0,Math.min(1,.3+pitch*.3+level*.15)));
    root.dataset.audioLevel=level.toFixed(3);
  },destroy(){base.destroy();}};
});
registerBackgroundStyle('solid',({root,config})=>{root.style.background=`linear-gradient(130deg,${config.colors[0]},${config.colors[1]})`;return {destroy(){}};});
registerBackgroundStyle('image',({root,config,onError})=>{
  const image=document.createElement('img');image.src=config.src;image.alt='';image.style.objectFit=config.fit||'cover';
  image.onerror=()=>onError('背景圖片無法載入，請檢查網址或選取本機素材資料夾。');root.append(image);
  return {destroy(){image.onerror=null;image.remove();}};
});
registerBackgroundStyle('video',({root,config,epoch,onError})=>{
  const video=document.createElement('video');video.muted=true;video.loop=true;video.autoplay=true;video.playsInline=true;if(config.poster)video.poster=config.poster;video.src=config.src;video.style.objectFit=config.fit||'cover';
  let alive=true;
  const resume=()=>video.play().then(()=>{if(alive)onError('');}).catch(e=>{if(alive && e.name!=='AbortError')onError('背景影片播放受阻，請按控制台的「啟用播放」。');});
  video.onloadedmetadata=()=>{if(Number.isFinite(video.duration) && video.duration>0)video.currentTime=((Date.now()-epoch)/1000)%video.duration;resume();};
  video.onerror=()=>onError('背景影片無法載入或格式不支援，請檢查素材。');root.append(video);
  return {resume,destroy(){alive=false;video.onloadedmetadata=null;video.onerror=null;video.pause();video.removeAttribute('src');video.load();video.remove();}};
});
export class BackgroundManager {
  constructor(host,onError=()=>{}){this.host=host;this.onError=onError;this.key='';this.exiting=new Set();}
  set(config,epoch,transition={type:'none',duration:0}){
    const key=JSON.stringify(config);
    if(this.key===key)return; // Changing foreground never resets the background or its video.
    for(const finish of this.exiting)finish();this.exiting.clear();
    const previous=this.instance,previousRoot=this.root;this.key=key;
    const root=document.createElement('div');root.className=`background-scene background-${config.type}`;
    root.style.background=mixColor(config.colors,.5);this.host.append(root);this.root=root;
    this.host.dataset.background=config.id;this.host.dataset.seed=String(config.seed);
    const factory=renderers.get(config.type);
    if(!factory){this.onError(`背景樣式 ${config.type} 尚未註冊播放器。`);this.instance=null;}
    else {this.onError('');this.instance=factory({root,config,epoch,onError:message=>{if(this.root===root)this.onError(message);}});}
    const duration=transition.type==='fade'?transition.duration*1000:0;
    if(previousRoot && duration){
      const opacity=getComputedStyle(previousRoot).opacity;previousRoot.getAnimations().forEach(a=>a.cancel());
      root.animate([{opacity:0},{opacity:1}],{duration,easing:'ease-in-out'});
      let done=false;const finish=()=>{if(done)return;done=true;previous?.destroy();previousRoot.getAnimations().forEach(a=>a.cancel());previousRoot.remove();this.exiting.delete(finish);};
      this.exiting.add(finish);previousRoot.animate([{opacity},{opacity:0}],{duration,easing:'ease-in-out'}).onfinish=finish;
    }else{previous?.destroy();previousRoot?.remove();}
  }
  resume(){this.instance?.resume?.();}
  audio(signal){this.instance?.audio?.(signal);}
  destroy(){for(const finish of this.exiting)finish();this.instance?.destroy();this.host.replaceChildren();this.key='';this.root=null;}
}
