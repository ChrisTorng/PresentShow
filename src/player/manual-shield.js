// Only explicit user commands change this envelope. No playback/ad monitoring.
export class ManualShield {
  constructor(cover,deck,raf=callback=>requestAnimationFrame(callback),cancel=id=>cancelAnimationFrame(id),now=()=>performance.now()) {
    Object.assign(this,{cover,deck,raf,cancel,now});this.blocked=false;this.frame=0;this.revision=0;
  }
  set(blocked,animate=true){
    if(this.blocked===blocked)return;
    this.blocked=blocked;this.cancel(this.frame);const revision=++this.revision;
    this.cover.hidden=false;
    if(blocked){this.cover.style.opacity='1';this.deck.outputGain=0;this.deck.settings();return;}
    const gain=this.deck.outputGain,start=this.now(),duration=animate?2000:0;
    const tick=now=>{
      if(revision!==this.revision)return;
      const p=duration?Math.min(1,(now-start)/duration):1;
      this.deck.outputGain=gain+(1-gain)*p;this.deck.settings();this.cover.style.opacity=String(1-this.deck.outputGain);
      if(p<1)this.frame=this.raf(tick);else this.cover.hidden=true;
    };
    tick(start);
  }
  destroy(){this.revision++;this.cancel(this.frame);}
}
