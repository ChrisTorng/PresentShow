export function spectrumFeatures(samples,frequencies,sampleRate=48000){
  let power=0,weighted=0,total=0,bass=0,treble=0,strongest=0,dominant=0;
  for(const sample of samples)power+=sample*sample;
  frequencies.forEach((value,index)=>{const hz=index*sampleRate/(frequencies.length*2),energy=(value/255)**2;total+=energy;weighted+=hz*energy;if(hz<250)bass+=energy;if(hz>2000)treble+=energy;if(hz>=45 && hz<=2000 && energy>strongest){strongest=energy;dominant=hz;}});
  return {rms:Math.sqrt(power/Math.max(samples.length,1)),centroid:total?weighted/total:0,dominant,bass:total?bass/total:0,treble:total?treble/total:0};
}
export class AudioMeter {
  constructor(){this.context=null;this.element=null;this.source=null;this.analyser=null;this.request=0;this.nodes=new WeakMap();this.peak=.03;}
  async attach(element){
    if(this.element===element || !element)return;
    // Capturing a cross-origin media element without CORS silences it. Leave those sources untouched.
    const url=new URL(element.currentSrc || element.src,location.href);
    if(url.protocol!=='blob:' && url.origin!==location.origin && element.crossOrigin!=='anonymous')return;
    const request=++this.request;
    try{
      this.context ||= new (window.AudioContext || window.webkitAudioContext)();
      await this.context.resume();
      if(request!==this.request || !element.isConnected || this.context.state!=='running')return;
      this.releaseSource();
      this.analyser ||= this.context.createAnalyser();this.analyser.fftSize=2048;this.analyser.smoothingTimeConstant=.88;
      if(!this.connected){this.analyser.connect(this.context.destination);this.connected=true;}
      this.source=this.nodes.get(element) || this.context.createMediaElementSource(element);this.nodes.set(element,this.source);
      this.source.disconnect();this.source.connect(this.analyser);this.element=element;
      this.samples=new Float32Array(this.analyser.fftSize);this.frequencies=new Uint8Array(this.analyser.frequencyBinCount);
    }catch{ /* Keep native playback available when Web Audio is unavailable. */ }
  }
  read(){
    if(!this.analyser || !this.element || this.element.paused)return {level:0,bass:0,treble:0,pitch:0,available:false};
    this.analyser.getFloatTimeDomainData(this.samples);this.analyser.getByteFrequencyData(this.frequencies);
    const value=spectrumFeatures(this.samples,this.frequencies,this.context.sampleRate);
    this.peak=Math.max(.015,value.rms,this.peak*.998);
    return {level:Math.min(1,value.rms/this.peak),bass:value.bass,treble:value.treble,pitch:Math.max(0,Math.min(1,Math.log2(Math.max(55,value.dominant)/55)/6)),available:true};
  }
  releaseSource(){if(this.source){this.source.disconnect();this.source.connect(this.context.destination);}}
  detach(){this.request++;this.releaseSource();this.source=null;this.element=null;}
}
