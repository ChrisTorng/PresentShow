// Playback-time envelope: buffering or pausing never advances the fade-in.
export function loopWindow(track,duration){
 if(!track.loop||!Number.isFinite(duration)||duration<=0)return null;
 const start=Math.max(0,track.loopStart??0),end=Math.min(duration,track.loopEnd??duration-(track.loopTrimEnd??0));
 if(end<=start+.5)return null;
 return {start,end,fade:Math.min(track.loopFade??1.5,(end-start)/3)};
}
export function loopEnvelope(window,time,playing,phase='normal'){
 if(!window)return {gain:1,phase:'normal'};
 const {start,end,fade}=window;
 if(phase==='seeking'){
  if(!playing||time>=end-Math.max(fade,.25))return {gain:0,phase};
  phase='rising';
 }
 if(phase==='rising'){
  const gain=fade?Math.max(0,Math.min(1,(time-start)/fade)):1;
  return {gain,phase:gain===1?'normal':'rising'};
 }
 if(!playing)return {gain:fade?Math.max(0,Math.min(1,(end-time)/fade)):1,phase};
 if(time>=end)return {gain:0,phase:'seeking',seek:start};
 return {gain:fade?Math.max(0,Math.min(1,(end-time)/fade)):1,phase:'normal'};
}
